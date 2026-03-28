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

### 2. Configure AI provider

For production, configure a cloud AI provider instead of local Ollama:

```bash
# Option A: OpenRouter (multi-model, cost-effective)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...

# Option B: Anthropic Claude (highest quality)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

If no AI provider is configured, the app works without AI features (content moderation defaults to fail-open, no summaries, seed-only quiz questions).

### 3. API build

```bash
cd apps/api
npm run build
# Run with:
node dist/index.js
```

### 4. Webapp build

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

### AI Provider (Ollama in production)

If self-hosting Ollama for cost savings:
```bash
# Run Ollama on a GPU-equipped server
docker run -d --gpus all -p 11434:11434 ollama/ollama
# Set OLLAMA_HOST in your API environment
OLLAMA_HOST=http://ollama-server:11434
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

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://sportykids:sportykids@db:5432/sportykids
      PORT: 3001
      AI_PROVIDER: openrouter
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      CACHE_PROVIDER: redis
      REDIS_URL: redis://redis:6379
    ports:
      - "3001:3001"
    depends_on:
      - db
      - redis

volumes:
  pgdata:
```

## Pre-production checklist

- [x] Migrate to PostgreSQL (script: `bash apps/api/scripts/migrate-to-postgres.sh`)
- [ ] Configure HTTPS
- [ ] Configure CORS with specific domains
- [x] Implement rate limiting (5 tiers: auth/pin/content/sync/default)
- [x] Add real authentication (JWT access + refresh tokens)
- [ ] Configure structured logging
- [ ] Verify RSS feeds work in production
- [ ] Configure database backups
- [x] Redis cache support (optional, `CACHE_PROVIDER=redis`)
- [ ] OAuth (Google, Apple) — placeholder routes ready
- [ ] Configure monitoring/alerts
- [x] ~~Review PIN security (bcrypt instead of SHA-256)~~ -- Done (M5)
- [x] ~~Server-side parental enforcement~~ -- Done (M5, parental guard middleware)
- [ ] Automated tests
- [ ] CI/CD pipeline
- [ ] Configure AI provider API keys
- [ ] Set up Ollama or cloud AI for production
- [ ] Review SSRF prevention for custom RSS sources
- [ ] Set up error tracking (Sentry or similar)
