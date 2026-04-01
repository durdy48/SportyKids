# 11. Guía de Despliegue en Tiendas

Este documento cubre el pipeline completo de despliegue: infraestructura de producción, preparación para tiendas y flujo de publicación.

## Infraestructura de Producción

### Fly.io (API)

La API se despliega en [Fly.io](https://fly.io) en la región de Madrid (`mad`).

**Configuración**: `fly.toml` en la raíz del proyecto.

```bash
# Crear la app (una sola vez)
fly apps create sportykids-api

# Crear Postgres gestionado
fly postgres create --name sportykids-db --region mad --vm-size shared-cpu-1x --initial-cluster-size 1 --volume-size 1
fly postgres attach sportykids-db --app sportykids-api

# Crear Redis (Upstash vía Fly marketplace)
fly redis create --name sportykids-redis --region mad --plan free

# Configurar secretos
fly secrets set \
  JWT_SECRET="<aleatorio-64-chars>" \
  JWT_REFRESH_SECRET="<aleatorio-64-chars>" \
  AI_PROVIDER="ollama" \
  SENTRY_DSN="" \
  POSTHOG_API_KEY=""

# Desplegar
fly deploy
```

Las migraciones de base de datos se ejecutan automáticamente antes de cada despliegue via `release_command` en `fly.toml`.

### CI/CD

El merge a `main` activa el despliegue automático vía GitHub Actions:

1. **Setup** → instalar dependencias
2. **Lint & Typecheck** → ESLint + TypeScript
3. **Test** → suites de API, Web, Mobile
4. **Build** → compilación API + Web
5. **Deploy** → `fly deploy --remote-only`

**Secreto requerido en GitHub**: `FLY_API_TOKEN` — obtener via `fly tokens create deploy`.

### Docker

El Dockerfile de la API (`apps/api/Dockerfile`) usa multi-stage build:

1. **deps** — instala dependencias npm
2. **builder** — genera Prisma client, compila TypeScript
3. **runner** — imagen de producción con usuario no-root `sportykids`

```bash
# Build local
docker build -f apps/api/Dockerfile -t sportykids-api .

# Ejecutar local
docker run -p 8080:8080 -e DATABASE_URL="postgresql://..." sportykids-api
```

## Configuración de Cuenta Apple Developer

1. Registrarse en https://developer.apple.com/programs/ ($99/año)
2. Crear App ID con bundle identifier `com.sportykids.app`
3. Crear listing en App Store Connect para "SportyKids"
4. Anotar el ASC App ID (numérico) → actualizar `eas.json` `submit.production.ios.ascAppId`
5. Anotar el Team ID → actualizar `eas.json` `submit.production.ios.appleTeamId`
6. Para OAuth (Apple Sign In): crear Services ID, configurar dominios/URLs de callback
7. Clasificación por edad: establecer en 4+ (sin contenido objetable)
8. Etiquetas de privacidad: configurar según los datos recopilados (nombre, email, datos de uso)
9. Categoría Kids: seleccionar "Kids" como categoría principal, rango de edad 9-11

## Configuración de Google Play Console

1. Registrarse en https://play.google.com/console ($25 único pago)
2. Crear app "SportyKids" con idioma por defecto Español (España)
3. Completar formulario de Data Safety (alineado con nuestra Política de Privacidad)
4. Establecer clasificación de contenido → cuestionario IARC (sin violencia, sin apuestas, sin contenido generado por usuarios)
5. Audiencia objetivo: Menores de 13 → activa cumplimiento de Families Policy
6. Crear cuenta de servicio para subidas automatizadas:
   - Google Cloud Console → IAM → Service Account → descargar clave JSON
   - Colocar como `apps/mobile/google-service-account.json` (gitignored)
7. Conceder rol "Release Manager" a la cuenta de servicio en Play Console
8. Crear track de testing interno para beta de Fase 5

## URLs de Callback OAuth en Producción

Cuando se creen las cuentas, actualizar variables de entorno:

| Proveedor | URL de Callback |
|-----------|----------------|
| Google (web) | `https://sportykids-api.fly.dev/api/auth/google/callback` |
| Apple (web) | `https://sportykids-api.fly.dev/api/auth/apple/callback` |

Configurar via: `GOOGLE_CALLBACK_URL`, `GOOGLE_SUCCESS_REDIRECT_URL`.

## EAS Build & Submit

### Perfiles de build

| Perfil | Canal | Caso de uso |
|--------|-------|-------------|
| `development` | development | Dev client con soporte de simulador |
| `preview` | preview | Distribución interna (APK + Ad Hoc) |
| `production` | production | Publicación en tiendas con auto-incremento |

### Compilación

```bash
# Build preview (testing interno)
cd apps/mobile
eas build --profile preview --platform all

# Build producción (publicación en tiendas)
eas build --profile production --platform all
```

### Publicación

```bash
# iOS — requiere credenciales de Apple Developer en eas.json
eas submit --platform ios --latest

# Android — requiere google-service-account.json
eas submit --platform android --latest
```

Actualizar los placeholders de submit en `eas.json` con valores reales antes de la primera publicación:
- `ios.appleId` → tu email de Apple ID
- `ios.ascAppId` → ID numérico de App Store Connect
- `ios.appleTeamId` → tu Team ID
- `android.serviceAccountKeyPath` → ruta al JSON de cuenta de servicio de Google

## Metadata ASO

Los archivos de metadata para tiendas están en `apps/mobile/store-metadata/`:
- `en.json` — metadata en inglés
- `es.json` — metadata en español

Ambos contienen: `name`, `subtitle`, `description`, `keywords`, `promotionalText`, `category`, `secondaryCategory`.

Copiar estos valores en las consolas de las tiendas respectivas al crear los listings.

## Capturas de Pantalla

Las capturas se realizan manualmente desde simuladores. Capturas requeridas (5 por idioma, por plataforma):

1. **Home Feed** — tarjetas deportivas con cabeceras de colores, filtros visibles
2. **Reels** — feed vertical de vídeos con un reel reproduciéndose
3. **Quiz** — pantalla de pregunta con opciones y contador de puntos
4. **Colección** — cuadrícula de cromos mostrando diferentes rarezas
5. **Control Parental** — panel parental mostrando límites de tiempo y gráfico de actividad

### Dimensiones iOS

| Dispositivo | Dimensiones | Obligatorio |
|-------------|-----------|-------------|
| iPhone 6.7" (15 Pro Max) | 1290×2796 | Sí (obligatorio) |
| iPhone 6.5" (14 Plus) | 1284×2778 | Sí |
| iPad 12.9" (6ª gen) | 2048×2732 | Si `supportsTablet: true` |

### Dimensiones Android

| Tipo | Dimensiones | Obligatorio |
|------|-----------|-------------|
| Teléfono | 1080×1920 (mín) | Sí, 2-8 capturas |
| Feature graphic | 1024×500 | Sí (generado por script de assets) |

Capturar con tema claro, datos de ejemplo visibles, primero en español, luego en inglés.
