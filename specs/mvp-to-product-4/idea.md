# SportyKids — MVP to Product: Fase 4 — Accesibilidad & Calidad de Producción

**Fase**: 4 de 6 — Calidad antes de la versión pública
**Prioridad**: ALTA — Apple puede rechazar sin VoiceOver; crashes en producción sin Sentry son ciegos
**Dependencias**: Fases 1, 2 y 3 completadas (o en paralelo con Fase 3)
**Estimación**: 4–6 días
**Contexto**: Análisis estratégico v3 (2026-03-28) — Blockers P1

---

## Objetivo

Cubrir los tres pilares de calidad que Apple y Google esperan en apps de categoría Kids antes de la versión pública: accesibilidad básica (VoiceOver/TalkBack), observabilidad en producción (Sentry en mobile + crash reporting nativo), y tests E2E mínimos que detecten regressions en los flujos críticos para menores antes de que lleguen a usuarios reales.

---

## Problema actual

- Solo 15 labels de accesibilidad en todo el codebase. Apple puede rechazar apps Kids sin soporte básico de VoiceOver. Las normas WCAG 2.1 AA son la referencia mínima esperada.
- Sentry está integrado en el API pero no en la app mobile. Si la app crashea en el dispositivo de un usuario, no hay trazabilidad — se detecta solo si el usuario reporta manualmente.
- Los 512 tests cubren unitarios e integración, pero cero flujos end-to-end. Un regression en el onboarding, el PIN parental o el schedule lock en UI no se detecta hasta que un usuario lo reporta.

---

## Alcance

### 1. Accesibilidad — Auditoría y corrección sistemática

**Mobile (React Native):**

Aplicar en todos los componentes interactivos:
- `accessible={true}` — marca el elemento como accesible
- `accessibilityLabel="Descripción de la acción"` — qué hace el elemento
- `accessibilityRole="button" | "link" | "tab" | "image" | "header"` — tipo de elemento
- `accessibilityHint="Descripción adicional"` — contexto extra cuando el label no es suficiente
- `accessibilityState={{ disabled, selected, checked }}` — estado del elemento

**Prioridad de componentes a auditar:**

| Componente | Elementos críticos |
|-----------|-------------------|
| `NavBar` / tabs | Cada tab necesita label + role="tab" |
| `PinInput` | Cada dígito: "Posición 1 de 4", role="button" |
| `FiltersBar` | Cada filtro de deporte: label + selected state |
| `NewsCard` | Título, imagen, botón de favorito, botón compartir |
| `ReelCard` | Botón play, like, share |
| `QuizGame` | Opciones de respuesta, feedback correcto/incorrecto |
| `AchievementBadge` | Nombre del logro + estado desbloqueado/bloqueado |
| `StickerCard` | Nombre del sticker + rareza |
| `ErrorState` | Descripción del error + botón reintentar |
| `ParentalPanel` | Todos los toggles, sliders de tiempo, PIN fields |

**Emojis como contenido:**
- Los emojis usados como contenido informativo (no decorativo) deben tener alternativa textual
- Usar `accessibilityLabel` para sobreescribir la lectura automática del emoji
- Ejemplo: `<Text accessibilityLabel="Deporte: fútbol">⚽</Text>`

**Contraste de color:**
- Verificar ratio mínimo 4.5:1 para texto normal y 3:1 para texto grande
- Usar la herramienta Colour Contrast Analyser o similar
- Especial atención al modo dark: colores en `--color-muted` y `--color-border`

**Web (Next.js):**
- Atributos `aria-label`, `aria-role`, `aria-describedby` en todos los botones e iconos interactivos
- Navegación por teclado: todos los elementos interactivos deben ser alcanzables con Tab
- `alt` en todas las imágenes (ya probablemente están, verificar)
- `<label>` asociados a todos los inputs de formulario

**Tests de accesibilidad:**
- Instalar `@testing-library/jest-native` para mobile (extensiones de matchers de accesibilidad)
- Verificar en los tests existentes de componentes que los labels correctos están presentes
- Audit manual con VoiceOver (iOS Simulator) y TalkBack (Android Emulator)

### 2. Sentry en Mobile — Crash reporting nativo

**Instalación:**
```bash
npx expo install @sentry/react-native
```

**Configuración en `apps/mobile/src/App.tsx`:**
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // No enviar datos en development si no hay DSN
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Evitar enviar datos de menores — solo errores técnicos
  beforeSend(event) {
    // Eliminar cualquier dato de usuario del evento
    delete event.user;
    return event;
  },
  tracesSampleRate: 0.1, // 10% de transacciones
});
```

**Wrapping del root component:**
```typescript
export default Sentry.wrap(App);
```

**Configuración EAS + Sentry:**
- Añadir `EXPO_PUBLIC_SENTRY_DSN` a las variables de entorno de producción en EAS
- Configurar upload de source maps en `eas.json` para que los stack traces sean legibles
- Instalar `@sentry/wizard` para automatizar la configuración

**Privacidad:**
- `beforeSend` elimina cualquier identificador de usuario antes de enviar a Sentry
- Solo se envían errores técnicos (stack traces), no datos de comportamiento ni PII
- Documentar en Privacy Policy que Sentry se usa para estabilidad técnica

**Alertas:**
- Configurar en Sentry dashboard: alert si error rate > 1% en 5 minutos
- Alert si nuevo issue critico (crash que afecta >10 usuarios)

### 3. Tests E2E — Flujos críticos

**Framework elegido: Maestro** (más sencillo que Detox, YAML-based, soporta iOS + Android)

```bash
# Instalación
brew install maestro
```

**Flujos a cubrir:**

#### E2E-1: Onboarding completo

```yaml
# specs/e2e/onboarding.yaml
appId: com.sportykids.app
---
- launchApp:
    clearState: true
- assertVisible: "¿Cuántos años tienes?"   # Age gate
- tapOn: "Soy padre/madre"
- assertVisible: "Bienvenido a SportyKids"  # Paso 1 onboarding
- tapOn: "Fútbol"                           # Seleccionar deporte
- tapOn: "Siguiente"
- tapOn: "Real Madrid"                      # Equipo favorito
- tapOn: "Siguiente"
- assertVisible: "Tu feed está listo"       # Confirmación
```

#### E2E-2: PIN parental setup y verificación

```yaml
# specs/e2e/parental-pin.yaml
- launchApp
- tapOn: "Parents" # Tab de padres
- tapOn: "Configurar PIN"
- tapOn: "1"; tapOn: "2"; tapOn: "3"; tapOn: "4"  # PIN: 1234
- tapOn: "1"; tapOn: "2"; tapOn: "3"; tapOn: "4"  # Confirmar
- assertVisible: "PIN configurado correctamente"
- tapOn: "Verificar PIN"
- tapOn: "1"; tapOn: "2"; tapOn: "3"; tapOn: "4"
- assertVisible: "Panel parental"
```

#### E2E-3: Feed de noticias y filtros

```yaml
# specs/e2e/feed-filters.yaml
- launchApp
- assertVisible: "Noticias"
- tapOn: "Fútbol"            # Filtro por deporte
- assertNotVisible: "Tenis"  # Verificar que no aparece otro deporte
- tapOn: "Buscar"
- inputText: "Real Madrid"
- assertVisible: "Real Madrid" # Al menos un resultado
```

#### E2E-4: Quiz completo

```yaml
# specs/e2e/quiz.yaml
- launchApp
- tapOn: "Quiz" # Tab
- tapOn: "Empezar"
- assertVisible: "Pregunta 1"
- tapOn: { index: 0 }  # Primera opción de respuesta
- assertVisible: { oneOf: ["¡Correcto!", "Incorrecto"] }
- tapOn: "Siguiente"
```

#### E2E-5: Schedule lock (bedtime mode)

```yaml
# specs/e2e/schedule-lock.yaml
# Este test requiere mock del reloj del sistema
- launchApp
- tapOn: "Parents"
- verificar PIN...
- tapOn: "Horario permitido"
- configurar 09:00 - 10:00
- mockear hora del sistema a 22:00
- launchApp
- assertVisible: "Ahora es tiempo de descanso"
```

**CI integration:**
- Añadir job `e2e` en `.github/workflows/ci.yml` que corre Maestro en el simulador de iOS
- Solo en branches `main` y `release/*` (los E2E son lentos, no en cada PR)

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `specs/e2e/onboarding.yaml` | Test E2E del onboarding |
| `specs/e2e/parental-pin.yaml` | Test E2E del PIN parental |
| `specs/e2e/feed-filters.yaml` | Test E2E del feed y filtros |
| `specs/e2e/quiz.yaml` | Test E2E del quiz |
| `specs/e2e/schedule-lock.yaml` | Test E2E del schedule lock |

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `apps/mobile/src/App.tsx` | Sentry.init + Sentry.wrap(App) |
| `apps/mobile/package.json` | Añadir `@sentry/react-native` |
| `apps/mobile/src/components/NavBar.tsx` | accessibilityLabel + role="tab" en tabs |
| `apps/mobile/src/components/PinInput.tsx` | Labels accesibles en cada dígito |
| `apps/mobile/src/screens/QuizGame.tsx` | Labels en opciones de respuesta |
| `apps/mobile/src/screens/HomeFeed.tsx` | Labels en NewsCard y controles |
| `apps/mobile/src/screens/Reels.tsx` | Labels en controles de vídeo |
| `apps/mobile/src/screens/Collection.tsx` | Labels en stickers y achievements |
| `apps/mobile/src/screens/ParentalControl.tsx` | Labels en todos los toggles y sliders |
| `apps/web/src/components/*.tsx` | aria-label en botones e iconos |
| `.env.example` | `EXPO_PUBLIC_SENTRY_DSN` documentado |
| `.github/workflows/ci.yml` | Job E2E con Maestro |

---

## Criterios de aceptación

- [ ] VoiceOver en iOS Simulator puede navegar por todas las pantallas sin elementos sin label
- [ ] TalkBack en Android Emulator anuncia correctamente todos los botones principales
- [ ] Todos los tabs de navegación tienen `accessibilityLabel` y `accessibilityRole="tab"`
- [ ] Los 4 dígitos del PinInput tienen labels: "Dígito 1", "Dígito 2", etc.
- [ ] Las opciones del quiz tienen labels que incluyen el texto de la opción
- [ ] Sentry captura errores en producción mobile (verificable en dashboard de Sentry)
- [ ] Los eventos de Sentry no contienen datos de usuario (userId, email, nombre)
- [ ] Los 5 flujos E2E pasan en simulador iOS
- [ ] El job E2E corre en CI en branches `main` sin fallos

---

## Fuera de alcance

- Cumplimiento WCAG 2.1 AA completo y certificado (audit externo — P2)
- Tests E2E para todos los flujos de la app (solo flujos críticos para menores)
- Replay de sesiones de usuario en Sentry (demasiado intrusivo para menores)
- Tests de rendimiento / lighthouse
- Soporte para `reduceMotion` y `largerText` de accesibilidad del sistema (P2)

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| Maestro sobre Detox | Setup más simple (YAML), no requiere cambios en el código de la app, soporta ambas plataformas |
| Sentry `beforeSend` elimina user | Protección de datos de menores — solo errores técnicos, no comportamiento |
| E2E solo en `main` y `release/*` | Los E2E son lentos (5–10 min); en cada PR sería demasiado friction |
| Accesibilidad manual + tests | El audit automático detecta el 30–40% de problemas; la revisión manual es imprescindible |
