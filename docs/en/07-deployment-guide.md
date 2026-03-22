# Deployment guide

## Environments

| Environment | Database | API | Webapp |
|-------------|----------|-----|--------|
| **Development** | SQLite (local) | localhost:3001 | localhost:3000 |
| **Staging** | PostgreSQL | staging-api.sportykids.com | staging.sportykids.com |
| **Production** | PostgreSQL | api.sportykids.com | sportykids.com |

## Preparation for production

### 1. Migrate from SQLite to PostgreSQL

Change the datasource in `apps/api/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Update `DATABASE_URL`:
```
DATABASE_URL="postgresql://user:password@host:5432/sportykids"
```

Run migrations:
```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### 2. API build

```bash
cd apps/api
npm run build
# Run with:
node dist/index.js
```

### 3. Webapp build

```bash
cd apps/web
NEXT_PUBLIC_API_URL=https://api.sportykids.com/api npm run build
npm run start
```

## Recommended hosting options

### API (Node.js)

| Option | Advantage | Cost |
|--------|-----------|------|
| **Railway** | Deploy from GitHub, PostgreSQL included | From $5/month |
| **Render** | Free tier with PostgreSQL | Free / $7/month |
| **Fly.io** | Edge computing, good performance | From $0 |
| **AWS ECS / Fargate** | Enterprise scalability | Variable |

### Webapp (Next.js)

| Option | Advantage | Cost |
|--------|-----------|------|
| **Vercel** | Optimized for Next.js | Free / $20/month |
| **Netlify** | Easy to configure | Free / $19/month |
| **Cloudflare Pages** | Global CDN, fast | Free |

### Mobile app (Expo)

```bash
# Build for iOS and Android
npx eas build --platform all

# Publish to stores
npx eas submit
```

## Docker (optional)

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

## Pre-production checklist

- [ ] Migrate to PostgreSQL
- [ ] Configure HTTPS
- [ ] Configure CORS with specific domains
- [ ] Implement rate limiting
- [ ] Add real authentication (JWT)
- [ ] Configure structured logging
- [ ] Verify RSS feeds work in production
- [ ] Configure database backups
- [ ] Configure monitoring/alerts
- [ ] Review PIN security (bcrypt instead of SHA-256)
- [ ] Automated tests
- [ ] CI/CD pipeline
