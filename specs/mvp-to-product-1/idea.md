# SportyKids — MVP to Product: Fase 1 — Legal & Compliance

**Fase**: 1 de 6 — Fundación legal
**Prioridad**: CRÍTICA — sin esto Apple y Google rechazan la app
**Dependencias**: Ninguna (primera en ejecutar)
**Estimación**: 3–5 días
**Contexto**: Análisis estratégico v3 (2026-03-28) — Blockers P0

---

## Objetivo

Convertir SportyKids en una aplicación legalmente publicable en App Store y Google Play. La app está dirigida a menores de 6–14 años, lo que activa COPPA (US), GDPR-K/LOPDGDD (EU/ES) y las políticas específicas de Apple Kids Category y Google Play Families. Sin resolver esta fase, cualquier envío a tiendas será rechazado.

---

## Problema actual

- No existe privacy policy accesible desde la app ni enlazable desde las fichas de tienda
- No hay age gate al primer uso — cualquier menor puede crear cuenta sin verificación parental
- No hay consentimiento parental verificable antes de recopilar datos (nombre, email, comportamiento, dispositivo)
- No existe endpoint de eliminación de datos (GDPR Art. 17 — derecho al olvido)
- PostHog y Sentry envían datos sin que exista opt-in parental explícito
- La ficha de tienda no puede declarar que es app para menores sin cumplir los requisitos previos

---

## Alcance

### 1. Privacy Policy

- Crear página `/privacy` en la webapp con el contenido legal completo
- Incluir enlace `Política de Privacidad` en: pantalla de login, onboarding (paso 1), footer del panel parental, settings de usuario
- La URL de la policy debe ser pública y estable (necesaria para fichas de tienda)
- Contenido mínimo requerido: qué datos se recogen, cómo se usan, quién los recibe (Sentry, PostHog), derechos del usuario, contacto para ejercer derechos, fecha de última actualización
- Traducción ES + EN (aprovechar i18n existente o documentos estáticos)

### 2. Terms of Service

- Crear página `/terms` con los términos de uso
- Sección específica para menores y responsabilidad parental
- Enlace desde mismo lugar que Privacy Policy

### 3. Age Gate al primer uso

- Pantalla pre-onboarding que pregunta: "¿Eres mayor de 18 años?" (padre) o "¿Cuántos años tienes?"
- Si el usuario declara ser menor de 13 (COPPA) o menor de 14 (LOPDGDD España), requerir email parental para consentimiento
- Si el usuario es padre/madre (18+), flujo normal de setup parental
- Almacenar en `User.authProvider` y `User.role` el resultado del gate
- No bloquear completamente — seguir el modelo "parental gate" que Apple recomienda

### 4. Consentimiento parental verificable

- Durante el setup del PIN parental, añadir checkbox explícito: "Soy el padre/madre/tutor legal de este menor y consiento el uso de SportyKids"
- Almacenar `ParentalProfile.consentGiven: Boolean` y `ParentalProfile.consentDate: DateTime`
- Si no hay consentimiento registrado y el usuario es menor, bloquear acceso a funciones que recopilan datos
- Nueva migración Prisma para los campos de consentimiento

### 5. Endpoint de eliminación de datos

- `DELETE /api/users/:id/data` — elimina todos los datos del usuario y sus registros asociados
  - User record
  - ActivityLog (ya tiene CASCADE)
  - QuizQuestion answers / scores
  - NewsHistory
  - Stickers, Achievements
  - PushTokens (ya tiene CASCADE)
  - RefreshTokens (ya tiene CASCADE)
  - ParentalProfile y ParentalSession (ya tiene CASCADE)
  - ContentReports
  - NewsSummaries (ya tiene CASCADE)
  - DailyMissions
- Endpoint requiere `requireAuth` + confirmación (el usuario debe pasar su password o PIN parental para confirmar)
- Respuesta: `{ deleted: true, userId, deletedAt }` con HTTP 200
- Añadir botón "Eliminar mi cuenta" en settings del usuario (web + mobile)
- Añadir opción en panel parental para eliminar cuenta del hijo

### 6. Audit y opt-in de analytics

- Revisar PostHog: asegurarse de que no envía datos hasta que el consentimiento parental esté registrado
- Revisar Sentry: confirmar que no incluye PII en los eventos (nombres, emails, IDs de usuario vinculables)
- Añadir `ANALYTICS_ENABLED` flag que se activa solo tras consentimiento parental
- Documentar en privacy policy exactamente qué datos envía cada servicio

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `apps/web/src/app/privacy/page.tsx` | Página de política de privacidad |
| `apps/web/src/app/terms/page.tsx` | Página de términos de uso |
| `apps/api/src/routes/users.ts` (modificar) | Añadir `DELETE /api/users/:id/data` |
| `apps/api/prisma/migrations/XXXXX_add_consent_fields/` | Migración Prisma |

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `apps/api/prisma/schema.prisma` | Añadir `consentGiven`, `consentDate` a `ParentalProfile` |
| `apps/web/src/app/onboarding/page.tsx` | Añadir age gate y enlace a privacy |
| `apps/mobile/src/screens/Onboarding.tsx` | Añadir age gate y enlace a privacy |
| `apps/web/src/app/page.tsx` | Enlace a privacy en footer |
| `apps/mobile/src/screens/Login.tsx` | Enlace a privacy y terms |
| `apps/web/src/components/ParentalPanel.tsx` | Checkbox de consentimiento + botón eliminar cuenta |
| `apps/mobile/src/screens/ParentalControl.tsx` | Checkbox de consentimiento + botón eliminar cuenta |
| `packages/shared/src/i18n/es.json` | Nuevas claves: privacy, terms, consent, delete_account |
| `packages/shared/src/i18n/en.json` | Ídem en inglés |

---

## Criterios de aceptación

- [ ] La URL `/privacy` es accesible públicamente sin login y muestra el contenido completo
- [ ] La URL `/terms` es accesible públicamente sin login
- [ ] Al primer uso (sin cuenta), el usuario ve el age gate antes del onboarding
- [ ] Un menor de 13 años no puede completar el registro sin email parental registrado
- [ ] El setup de PIN parental incluye checkbox de consentimiento explícito
- [ ] `DELETE /api/users/:id/data` elimina todos los registros y devuelve 200
- [ ] El botón "Eliminar mi cuenta" está presente en settings (web + mobile)
- [ ] PostHog y Sentry no envían eventos antes de que consentGiven = true
- [ ] Nuevas claves i18n cubiertas en ES y EN
- [ ] Tests unitarios para el endpoint de eliminación de datos

---

## Fuera de alcance

- Verificación de edad mediante documento de identidad (complejidad excesiva para v1)
- Sistema de gestión de consentimientos tipo CMP (Consent Management Platform)
- Integración con servicios de verificación parental de terceros
- COPPA "actual knowledge" mechanisms más allá del age gate declarativo

---

## Referencias regulatorias

- [Apple Kids Category Guidelines](https://developer.apple.com/app-store/review/guidelines/#kids)
- [Google Play Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335)
- [FTC COPPA Rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)
- [LOPDGDD Art. 7 — Consentimiento de menores](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673)
