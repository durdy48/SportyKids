# Guia de despliegue

## Entornos

| Entorno | Base de datos | API | Webapp |
|---------|--------------|-----|--------|
| **Desarrollo** | SQLite (local) | localhost:3001 | localhost:3000 |
| **Staging** | PostgreSQL | staging-api.sportykids.com | staging.sportykids.com |
| **Produccion** | PostgreSQL | api.sportykids.com | sportykids.com |

## Preparacion para produccion

### 1. Migrar de SQLite a PostgreSQL

Cambiar el datasource en `apps/api/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Actualizar `DATABASE_URL`:
```
DATABASE_URL="postgresql://user:password@host:5432/sportykids"
```

Ejecutar migraciones:
```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### 2. Build de la API

```bash
cd apps/api
npm run build
# Ejecutar con:
node dist/index.js
```

### 3. Build de la webapp

```bash
cd apps/web
NEXT_PUBLIC_API_URL=https://api.sportykids.com/api npm run build
npm run start
```

## Opciones de hosting recomendadas

### API (Node.js)

| Opcion | Ventaja | Coste |
|--------|---------|-------|
| **Railway** | Deploy desde GitHub, PostgreSQL incluido | Desde $5/mes |
| **Render** | Free tier con PostgreSQL | Free / $7/mes |
| **Fly.io** | Edge computing, buen rendimiento | Desde $0 |
| **AWS ECS / Fargate** | Escalabilidad empresarial | Variable |

### Webapp (Next.js)

| Opcion | Ventaja | Coste |
|--------|---------|-------|
| **Vercel** | Optimizado para Next.js | Free / $20/mes |
| **Netlify** | Facil de configurar | Free / $19/mes |
| **Cloudflare Pages** | CDN global, rapido | Free |

### App movil (Expo)

```bash
# Build para iOS y Android
npx eas build --platform all

# Publicar en stores
npx eas submit
```

## Docker (opcional)

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN npm install --workspace=apps/api
RUN cd apps/api && npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sportykids
      POSTGRES_USER: sportykids
      POSTGRES_PASSWORD: sportykids
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://sportykids:sportykids@db:5432/sportykids
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      - db

volumes:
  pgdata:
```

## Checklist pre-produccion

- [ ] Migrar a PostgreSQL
- [ ] Configurar HTTPS
- [ ] Configurar CORS con dominios especificos
- [ ] Implementar rate limiting
- [ ] Añadir autenticacion real (JWT)
- [ ] Configurar logs estructurados
- [ ] Verificar feeds RSS funcionan en produccion
- [ ] Configurar backups de base de datos
- [ ] Configurar monitoring/alertas
- [ ] Revisar seguridad del PIN (bcrypt en vez de SHA-256)
- [ ] Tests automatizados
- [ ] CI/CD pipeline
