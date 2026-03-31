# SportyKids — MVP to Product: Fase 5 — Beta Cerrada & Envío a Tiendas

**Fase**: 5 de 6 — Validación con familias reales y envío a revisión
**Prioridad**: ALTA — es el paso final antes de la versión pública
**Dependencias**: Fases 1, 2, 3 y 4 completadas
**Estimación**: 2–3 semanas (incluye tiempo de revisión de Apple y Google)
**Contexto**: Análisis estratégico v3 (2026-03-28) — Fase 5 del proyecto (test con familias)

---

## Objetivo

Validar SportyKids con 5–10 familias reales antes del lanzamiento público, iterar sobre los problemas detectados, y gestionar el proceso de envío y revisión en Apple App Store y Google Play Store. Esta fase es la puente entre "está listo técnicamente" y "está disponible para cualquier familia".

---

## Problema actual

La app nunca ha sido usada por su público objetivo real (niños de 6–14 años y sus padres) fuera del equipo de desarrollo. Los problemas de usabilidad, los contenidos inesperados que pasan la moderación, y los flujos confusos para los padres solo se detectan con usuarios reales. Además, el proceso de revisión de Apple puede tomar 1–7 días y puede incluir rechazos que requieren iteración.

---

## Alcance

### 1. Preparación de la beta

**Distribución:**
- **iOS:** TestFlight — invitar a los beta testers por email
  - Crear grupo interno "Core Testers" (5–10 familias)
  - Duración máxima de TestFlight: 90 días
  - Build de TestFlight: `eas build --profile preview --platform ios`
- **Android:** Google Play Internal Testing
  - Lista de testers por email de Google
  - Build: `eas build --profile preview --platform android`
  - Track: `internal` (no requiere revisión de Google)

**Perfil EAS `preview` para beta:**
```json
{
  "preview": {
    "distribution": "internal",
    "ios": { "simulator": false },
    "android": { "buildType": "apk" },
    "env": {
      "EXPO_PUBLIC_API_BASE": "https://staging.sportykids.app/api"
    }
  }
}
```

**Entorno de staging:**
- API apuntando a `staging.sportykids.app` (misma infra que producción pero con datos de prueba)
- PostgreSQL de staging separado del de producción
- Seed de datos de prueba (noticias recientes, stickers, logros, misiones)

### 2. Protocolo de beta testing

**Selección de familias (5–10):**
- Al menos 2 familias con hijo de 6–8 años
- Al menos 2 familias con hijo de 9–11 años
- Al menos 2 familias con hijo de 12–14 años
- Mix de deportes favoritos (fútbol + al menos otro)
- Al menos 1 familia angloparlante (para validar i18n EN)

**Guía de sesión de testing (para padres):**

```
GUÍA DE TESTING — SportyKids Beta

Semana 1 — Setup:
□ Instala la app y completa el onboarding con tu hijo
□ Configura el PIN parental y las restricciones de horario
□ Deja que tu hijo explore libremente 15-20 minutos

Semana 2 — Uso diario:
□ Tu hijo: lee al menos 3 noticias al día
□ Tu hijo: completa el quiz diario
□ Padre: revisa el panel de actividad semanal
□ Nota cualquier contenido que te parezca inapropiado

Semana 3 — Feedback:
□ Rellena el cuestionario final (link enviado por email)
□ Llama/videollamada de 30 min con el equipo (opcional)
```

**Métricas a monitorizar durante beta:**
- DAU / WAU (usuarios activos diarios/semanales)
- Retention D1, D7 (% usuarios que vuelven al día 1 y 7)
- Tasa de completado del quiz diario
- Errores capturados en Sentry (por tipo y frecuencia)
- Contenido reportado por usuarios (`ContentReport`)
- Feedback del cuestionario de satisfacción

**Cuestionario de beta (Google Forms o Typeform):**

Para padres:
1. ¿Qué tan fácil fue configurar el control parental? (1–5)
2. ¿Te sentiste tranquilo/a con el contenido que veía tu hijo? (1–5)
3. ¿Qué fue lo más confuso durante el setup? (abierta)
4. ¿Faltó algo que necesitabas como padre/madre? (abierta)
5. ¿Recomendarías SportyKids a otro padre? (NPS 0–10)

Para niños (rellenado con el padre presente):
1. ¿Qué es lo que más te gustó? (emojis como opciones)
2. ¿Qué no entendiste bien? (abierta)
3. ¿Usarías SportyKids todos los días? (sí/no/a veces)

### 3. Criterios de paso a producción

Antes de enviar a revisión oficial, se debe cumplir:

| Criterio | Umbral mínimo |
|----------|---------------|
| NPS padres | ≥ 7/10 promedio |
| Satisfacción configuración parental | ≥ 4/5 |
| Crashes críticos en Sentry | 0 (zero crashes que cierren la app) |
| Contenido inapropiado detectado | Resuelto en 24h si se reporta |
| Tests E2E (Fase 4) | 100% passing |
| Blockers de tienda (Fases 1–3) | 100% resueltos |

### 4. Envío a revisión — Apple App Store

**Proceso:**
1. `eas build --profile production --platform ios` — generar IPA de producción
2. `eas submit --platform ios` — subir a App Store Connect
3. En App Store Connect:
   - Completar metadata: descripción, keywords, screenshots, preview video
   - Privacy Nutrition Labels (qué datos se recopilan y por qué)
   - Declarar que contiene contenido para menores (Kids category)
   - Seleccionar Age Rating: 4+ (con parental controls activos)
   - Configurar la URL de Privacy Policy y Support URL
4. Enviar a revisión → tiempo de espera: 1–7 días hábiles

**Checklist previo al submit iOS:**
- [ ] Privacy Policy URL accesible públicamente
- [ ] Support URL activo (puede ser una página simple de contacto)
- [ ] Screenshots cargadas en todos los tamaños requeridos
- [ ] Age Rating configurado con las preguntas del cuestionario de Apple
- [ ] Privacy Nutrition Labels completados (Data Not Collected si aplica)
- [ ] Sign In with Apple activado (obligatorio si hay otro social login)
- [ ] Kids Category seleccionada
- [ ] Versión 1.0.0, build 1

**Posibles causas de rechazo y respuesta preparada:**

| Causa frecuente | Respuesta preparada |
|----------------|---------------------|
| "Insufficient content" | Mostrar en las notas de revisión que hay 182 fuentes RSS activas y contenido real |
| "External links to non-kids content" | Confirmar parámetros sandbox de YouTube; mostrar que no hay links externos sin control |
| "Missing privacy policy" | La URL `/privacy` es pública y accesible sin login |
| "Sign In with Apple required" | Está implementado — mostrar que aparece en la pantalla de login |

### 5. Envío a revisión — Google Play Store

**Proceso:**
1. `eas build --profile production --platform android` — generar AAB
2. `eas submit --platform android` — subir a Google Play Console
3. En Google Play Console:
   - Completar ficha de la tienda: descripción ES + EN, screenshots, feature graphic
   - Configurar Families Policy: declarar que la app está diseñada para menores
   - Content Rating Questionnaire (IARC): completar para obtener clasificación
   - Data Safety form: declarar todos los datos recopilados y si se comparten
   - Families Ads Policy: confirmar que no hay anuncios dirigidos a menores
4. Publicar en track `internal` → `closed testing` → `open testing` → `production`
   - No saltar pasos — Google rechaza publicaciones que no han pasado por testing

**Checklist previo al submit Android:**
- [ ] Families Policy compliance confirmado
- [ ] Data Safety form completado
- [ ] IARC rating obtenido
- [ ] Screenshots y feature graphic cargados
- [ ] YouTube embeds sin ads confirmado (parámetros sandbox de Fase 2)
- [ ] Versión 1.0.0, versionCode 1

### 6. Post-revisión e iteración

**Si hay rechazo:**
1. Analizar el motivo exacto en la notificación
2. Categorizar: ¿es un bug? ¿es compliance? ¿es ambigüedad en las guidelines?
3. Corregir en rama `fix/review-rejection` sin tocar nada más
4. Re-subir con nota explicativa para el revisor
5. Si hay duda sobre la interpretación, usar el canal de apelación de Apple (App Review Board)

**Si hay aprobación:**
1. Activar la versión en producción con rollout gradual (10% → 50% → 100%)
2. Activar monitoring en Sentry y PostHog para la versión 1.0.0
3. Configurar alertas de crash rate > 1% y review negativas en tiendas

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `specs/mvp-to-product-5/beta-guide.md` | Guía de testing para familias |
| `specs/mvp-to-product-5/review-notes.md` | Notas para los revisores de Apple/Google |
| `specs/mvp-to-product-5/store-metadata-es.md` | Textos ASO en español |
| `specs/mvp-to-product-5/store-metadata-en.md` | Textos ASO en inglés |

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `apps/mobile/eas.json` | Completar configuración de submit |
| `apps/mobile/app.json` | `version: "1.0.0"`, `buildNumber: "1"`, `versionCode: 1` |

---

## Criterios de aceptación

- [ ] Al menos 5 familias completan el protocolo de beta testing (3 semanas)
- [ ] NPS promedio ≥ 7/10 en el cuestionario final
- [ ] Cero crashes críticos reportados en Sentry durante la beta
- [ ] El build de producción iOS pasa la validación de App Store Connect sin errores de formato
- [ ] El build de producción Android pasa la validación de Google Play Console
- [ ] La app es aprobada y publicada en App Store (versión 1.0.0)
- [ ] La app es aprobada y publicada en Google Play (versión 1.0.0)
- [ ] Rollout gradual completado al 100% sin incremento de crash rate

---

## Fuera de alcance

- Campaña de marketing o PR para el lanzamiento
- Análisis competitivo de ASO post-lanzamiento
- Respuesta pública a reviews en las tiendas (se gestiona post-lanzamiento)
- Internacionalización a nuevos mercados (los 6 mercados actuales se activan al publicar)
- Programa "Designed for Kids" de Apple (aplicar post-lanzamiento con datos reales)
