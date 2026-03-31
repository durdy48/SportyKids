# SportyKids — MVP to Product: Fase 2 — Seguridad Mobile & Moderación

**Fase**: 2 de 6 — Seguridad y estabilidad
**Prioridad**: CRÍTICA — crash = rechazo Apple; fail-open = riesgo reputacional con menores
**Dependencias**: Fase 1 (compliance) puede ir en paralelo
**Estimación**: 3–4 días
**Contexto**: Análisis estratégico v3 (2026-03-28) — Blockers P0 de seguridad

---

## Objetivo

Blindar la app mobile contra crashes no controlados, proteger los tokens JWT con almacenamiento seguro del sistema operativo, resolver el problema de contenido no moderado de YouTube en Reels, y cambiar la moderación de contenido a modo fail-closed en producción. Estos cuatro cambios son independientes entre sí y pueden implementarse en paralelo por dos personas.

---

## Problema actual

1. **Sin error boundary**: cualquier excepción no capturada en React Native mata la app sin feedback. Apple rechaza automáticamente si detecta un crash durante su testing.
2. **Tokens en AsyncStorage**: los JWT de acceso y refresco se guardan en texto plano. AsyncStorage es accesible mediante herramientas de debugging. Para un producto con menores de edad, es un riesgo de seguridad inaceptable en producción.
3. **YouTube embeds sin sandbox**: los Reels usan iframes de YouTube que pueden mostrar anuncios pre-roll (viola Google Play Families Policy) y vídeos sugeridos al terminar (Apple lo considera "salida no controlada a contenido de terceros").
4. **Moderación fail-open**: si la AI no responde (timeout, rate limit, servicio caído), el contenido se aprueba automáticamente. En un producto para niños, esto significa que contenido potencialmente inapropiado puede llegar a usuarios reales.

---

## Alcance

### 1. Error Boundary en React Native

- Crear componente `ErrorBoundary` que envuelve toda la aplicación en `apps/mobile/src/App.tsx`
- La pantalla de error debe ser kid-friendly: emoji grande, mensaje en el idioma del usuario, botón "Volver a intentarlo" que reinicia el componente
- Capturar el error en Sentry (si está configurado) antes de mostrar la pantalla
- Incluir información de debug en modo desarrollo (stack trace visible)
- En producción: mensaje limpio sin detalles técnicos

```
┌─────────────────────────────────┐
│                                 │
│           😵 ¡Ups!             │
│                                 │
│   Algo salió mal. Vamos a       │
│   intentarlo de nuevo.          │
│                                 │
│      [ Reintentar ]             │
│                                 │
└─────────────────────────────────┘
```

- Tests: simular un componente hijo que lanza error y verificar que ErrorBoundary lo captura

### 2. Tokens JWT en expo-secure-store

- Instalar `expo-secure-store` en `apps/mobile/package.json`
- Crear `apps/mobile/src/lib/secure-storage.ts` con API compatible con AsyncStorage pero usando `SecureStore.setItemAsync` / `getItemAsync` / `deleteItemAsync`
- Reemplazar en `apps/mobile/src/lib/auth.ts` todos los usos de AsyncStorage para tokens:
  - `ACCESS_TOKEN_KEY`
  - `REFRESH_TOKEN_KEY`
- El resto del estado de usuario (userId, locale, preferencias) puede seguir en AsyncStorage
- Verificar que el logout limpia correctamente el SecureStore
- Tests: mock de expo-secure-store y verificar que save/load/clear funcionan

### 3. YouTube embeds con parámetros sandbox

- En `apps/mobile/src/components/VideoPlayer.tsx` y `apps/web/src/components/VideoPlayer.tsx`, actualizar la URL de embed de YouTube con parámetros de seguridad:
  - `rel=0` — no mostrar vídeos sugeridos al terminar
  - `modestbranding=1` — reducir branding de YouTube
  - `iv_load_policy=3` — desactivar anotaciones
  - `disablekb=1` — desactivar controles de teclado (evita atajos que navegan fuera)
  - `fs=0` — desactivar pantalla completa (mantiene el usuario en la app)
- En mobile (WebView), añadir `mediaPlaybackRequiresUserAction={false}` y `allowsInlineMediaPlayback={true}`
- Añadir atributo `sandbox="allow-scripts allow-same-origin"` en los iframes web
- Crear constante `buildYouTubeEmbedUrl(videoId: string): string` en `packages/shared/src/utils/` para centralizar la construcción de URLs y evitar duplicación
- Tests: verificar que la URL generada incluye todos los parámetros requeridos

### 4. Moderación fail-closed en producción

- En `apps/api/src/services/content-moderator.ts`, cambiar el comportamiento cuando la AI no responde:
  - **Desarrollo** (`NODE_ENV=development`): mantener fail-open (aprueba automáticamente para no bloquear el desarrollo)
  - **Producción** (`NODE_ENV=production`): fail-closed — el contenido queda en `safetyStatus: 'pending'` hasta que la AI lo revise
- Añadir variable de entorno `MODERATION_FAIL_OPEN=true/false` para override explícito
- Crear job de revisión de pendientes: si hay noticias en `pending` durante más de 30 minutos, enviar alerta (log de warning con Pino — la integración de email/Slack es fuera de alcance)
- Añadir endpoint `GET /api/admin/moderation/pending` (requiere role=admin) que devuelve count de noticias pendientes de moderación
- Documentar en `.env.example` la nueva variable
- Tests: mock de ai-client que falla y verificar que en producción el contenido queda en `pending`, no en `approved`

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `apps/mobile/src/components/ErrorBoundary.tsx` | Componente React Native error boundary |
| `apps/mobile/src/lib/secure-storage.ts` | Wrapper de expo-secure-store con API compatible |
| `packages/shared/src/utils/youtube.ts` | `buildYouTubeEmbedUrl()` centralizado |

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `apps/mobile/src/App.tsx` | Envolver NavigationContainer con ErrorBoundary |
| `apps/mobile/src/lib/auth.ts` | Usar secure-storage en lugar de AsyncStorage para tokens |
| `apps/mobile/src/components/VideoPlayer.tsx` | Parámetros sandbox YouTube |
| `apps/web/src/components/VideoPlayer.tsx` | Parámetros sandbox YouTube + atributo sandbox en iframe |
| `apps/api/src/services/content-moderator.ts` | Lógica fail-closed en producción |
| `apps/api/src/routes/` (nuevo endpoint admin) | `GET /api/admin/moderation/pending` |
| `apps/mobile/package.json` | Añadir `expo-secure-store` |
| `.env.example` | `MODERATION_FAIL_OPEN` documentado |
| `packages/shared/src/i18n/es.json` | Clave `error.boundary.message`, `error.boundary.retry` |
| `packages/shared/src/i18n/en.json` | Ídem en inglés |

---

## Criterios de aceptación

- [ ] Un crash en cualquier componente React Native muestra la pantalla ErrorBoundary en lugar de cerrar la app
- [ ] El mensaje de error está en el idioma del usuario (ES/EN)
- [ ] Los tokens JWT se almacenan en iOS Keychain / Android Keystore via expo-secure-store
- [ ] El logout limpia el SecureStore correctamente (tokens no persistentes tras logout)
- [ ] La URL de embed de YouTube incluye `rel=0`, `modestbranding=1`, `iv_load_policy=3`
- [ ] En producción (`NODE_ENV=production`), si la AI falla, el contenido queda en `pending`
- [ ] En desarrollo (`NODE_ENV=development`), si la AI falla, el contenido se aprueba (sin bloquear dev)
- [ ] `GET /api/admin/moderation/pending` devuelve count de noticias en pending
- [ ] Tests unitarios para: ErrorBoundary, secure-storage, buildYouTubeEmbedUrl, moderación fail-closed

---

## Fuera de alcance

- Dashboard visual de moderación manual (P2 post-lanzamiento)
- Integración de Slack/email para alertas de moderación
- Verificación de certificados SSL en WebView (certificate pinning)
- Desactivar completamente YouTube y reemplazar por vídeo nativo (Fase 6)
- Sentry nativo en mobile con crash reporting de capa nativa (esa complejidad va en Fase 4)

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| `expo-secure-store` sobre `react-native-keychain` | Expo-managed, sin need de prebuild, integración nativa con EAS |
| Fail-closed solo en producción | No bloquear el flujo de desarrollo donde Ollama puede estar caído |
| `buildYouTubeEmbedUrl` en shared | Evitar duplicación entre web y mobile, testeable en aislamiento |
| ErrorBoundary como componente, no HOC | Más explícito, fácil de ubicar en el árbol de componentes |
