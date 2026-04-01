# ---- Stage 1: Install dependencies ----
FROM node:20-slim AS deps

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy workspace structure for npm install
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci --ignore-scripts

# ---- Stage 2: Build ----
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
# Workspace node_modules may not exist when npm hoists all deps to root.
# The || true fallback prevents build failure in that case.
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true

# Copy source
COPY package.json package-lock.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build shared package (project reference for API)
RUN npm run build --workspace=packages/shared 2>/dev/null || (cd packages/shared && npx tsc)

# Build API
RUN npm run build:api 2>/dev/null || (cd apps/api && npx tsc)

# ---- Stage 3: Production ----
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system sportykids && adduser --system --ingroup sportykids sportykids

# Copy only production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
# Workspace node_modules may not exist when npm hoists all deps to root
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json ./package.json

USER sportykids

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
