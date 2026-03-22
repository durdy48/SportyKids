# Guia de desarrollo

## Requisitos previos

- Node.js >= 20
- npm >= 10
- Git

No se necesita Docker ni PostgreSQL para desarrollo local (se usa SQLite).

## Instalacion

```bash
git clone <repo-url>
cd sportykids
npm install
```

Si npm apunta a un registro privado, crea un `.npmrc` en la raiz:
```
registry=https://registry.npmjs.org/
```

## Configuracion

Crear el fichero de entorno para la API:

```bash
# apps/api/.env
DATABASE_URL="file:./dev.db"
PORT=3001
NODE_ENV=development
```

## Base de datos

```bash
# Ejecutar migraciones
npm run db:migrate

# Generar cliente Prisma
npm run db:generate

# Cargar datos de ejemplo (fuentes RSS, reels, preguntas quiz)
cd apps/api && npx tsx prisma/seed.ts
```

## Arrancar en desarrollo

Necesitas dos terminales:

```bash
# Terminal 1: API
npm run dev:api

# Terminal 2: Webapp
npm run dev:web
```

- API: http://localhost:3001
- Webapp: http://localhost:3000

Para la app movil (requiere Expo CLI):
```bash
npm run dev:mobile
```

## Comandos disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run dev:api` | Arranca API con hot reload (tsx watch) |
| `npm run dev:web` | Arranca webapp Next.js en modo desarrollo |
| `npm run dev:mobile` | Arranca Expo para la app movil |
| `npm run build:api` | Compila la API a JavaScript |
| `npm run build:web` | Genera build de produccion de la webapp |
| `npm run db:migrate` | Ejecuta migraciones de Prisma |
| `npm run db:generate` | Regenera el cliente Prisma |
| `npm run lint` | Ejecuta ESLint en todo el monorepo |

## Estructura de una nueva ruta API

1. Crear fichero en `apps/api/src/routes/` (nombre en inglés, ej. `teams.ts`)
2. Definir schemas de validacion con Zod
3. Implementar handlers con tipado de Express
4. Exportar el router como default
5. Importar y montar en `apps/api/src/index.ts`

## Estructura de una nueva pagina web

1. Crear carpeta en `apps/web/src/app/<nombre>/` (nombre en inglés, ej. `/team`)
2. Crear `page.tsx` (puede ser Server o Client Component)
3. Usar `useUser()` para acceder al contexto del usuario (de `user-context`)
4. Importar componentes compartidos de `@/components/` (ej. `NewsCard`, `FiltersBar`)
5. Usar funciones de `@/lib/api.ts` para llamadas al backend

## Convenciones

- **Idioma del código**: identificadores, nombres de ficheros, tipos, funciones y variables en **inglés**
- **Idioma de la UI**: español por defecto, con soporte i18n para otros idiomas
- **Términos técnicos**: se mantienen en ingles (deploy, feed, quiz, onboarding)
- **Nombres de ficheros**: kebab-case para utilidades, PascalCase para componentes React
- **Tipos compartidos**: definir en `packages/shared/src/types/`
- **Constantes**: definir en `packages/shared/src/constants/` (`SPORTS`, `TEAMS`, `COLORS`, `AGE_RANGES`)
- **Traducciones**: añadir en `packages/shared/src/i18n/es.json` y `en.json`

## Sistema de internacionalización (i18n)

El paquete `@sportykids/shared` incluye un módulo de i18n:

```
packages/shared/src/i18n/
├── es.json    # Traducciones en español
├── en.json    # Traducciones en inglés
└── index.ts   # Función t(key, locale)
```

### Uso básico

```typescript
import { t } from '@sportykids/shared/i18n';

// Traducir un texto
t('sports.football', 'es');  // → "Fútbol"
t('sports.football', 'en');  // → "Football"
```

### Añadir nuevas traducciones

1. Añadir la clave en `es.json` y `en.json`
2. Usar `t('nueva.clave', locale)` en el componente

### Referencia de constantes y utilidades compartidas

| Antes (español) | Ahora (inglés) | Ubicación |
|-----------------|----------------|-----------|
| `DEPORTES` | `SPORTS` | `packages/shared/src/constants/` |
| `EQUIPOS` | `TEAMS` | `packages/shared/src/constants/` |
| `COLORES` | `COLORS` | `packages/shared/src/constants/` |
| `RANGOS_EDAD` | `AGE_RANGES` | `packages/shared/src/constants/` |
| `deporteAColor()` | `sportToColor()` | `packages/shared/src/utils/` |
| `deporteAEmoji()` | `sportToEmoji()` | `packages/shared/src/utils/` |
| `formatearFecha()` | `formatDate()` | `packages/shared/src/utils/` |
| `truncarTexto()` | `truncateText()` | `packages/shared/src/utils/` |
