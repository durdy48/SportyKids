# Feature: Video Aggregator — Reels dinámicos desde fuentes configurables

## Problema

Los reels actuales son estáticos (seed). En producción, los niños verán siempre los mismos 10 videos. Necesitamos un sistema que:

1. **Busque videos nuevos automáticamente** según los deportes del usuario
2. **Actualice el contenido diariamente** (como el agregador RSS hace con noticias)
3. **Filtre por seguridad** (como la moderación AI de noticias)
4. **Sea configurable** (fuentes de video, canales, etc.)

## Solución propuesta

### Arquitectura: VideoSource + VideoAggregator (paralelo al RSS)

```
VideoSource (configurable)     →  VideoAggregator (cron)  →  Reel (DB)
├── YouTube channels/playlists     Fetch via API                ├── Filtrado por deporte
├── YouTube search queries         Moderate title/desc          ├── Filtrado por edad
└── Manual URLs                    Upsert to Reel table         └── Mostrado al usuario
```

### 1. Modelo VideoSource (Prisma)

```prisma
model VideoSource {
  id        String   @id @default(cuid())
  name      String
  platform  String   // 'youtube_channel' | 'youtube_playlist' | 'youtube_search'
  config    String   // JSON: { channelId?, playlistId?, searchQuery?, maxResults? }
  sport     String
  active    Boolean  @default(true)
  isCustom  Boolean  @default(false)
  addedBy   String?
  lastSyncedAt DateTime?
  createdAt DateTime @default(now())
}
```

### 2. Fuentes predefinidas (seed)

| Nombre | Plataforma | Config | Deporte |
|--------|-----------|--------|---------|
| La Liga Official | youtube_channel | channelId: UCzN... | football |
| NBA | youtube_channel | channelId: UCWF... | basketball |
| ATP Tour | youtube_channel | channelId: UC-y... | tennis |
| F1 Official | youtube_channel | channelId: UCB-... | formula1 |
| World Athletics | youtube_channel | channelId: UC... | athletics |
| GCN en Español | youtube_channel | channelId: UC... | cycling |
| Premier Padel | youtube_channel | channelId: UC... | padel |
| Goles La Liga | youtube_search | query: "mejores goles la liga" | football |
| NBA highlights | youtube_search | query: "NBA top plays" | basketball |
| Alcaraz highlights | youtube_search | query: "Carlos Alcaraz best points" | tennis |

### 3. Servicio VideoAggregator

```typescript
// apps/api/src/services/video-aggregator.ts

// Opción A: YouTube Data API (requiere API key, gratis hasta 10K units/día)
async function syncYouTubeChannel(channelId: string, sport: string): Promise<Reel[]>
async function syncYouTubePlaylist(playlistId: string, sport: string): Promise<Reel[]>
async function syncYouTubeSearch(query: string, sport: string): Promise<Reel[]>

// Opción B: YouTube RSS (GRATIS, sin API key, sin límite)
// Cada canal de YouTube tiene un RSS feed:
// https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
// Se puede parsear con rss-parser (ya existe en el proyecto)
async function syncYouTubeChannelViaRSS(channelId: string, sport: string): Promise<Reel[]>
```

**Recomendación: Opción B (YouTube RSS)** — cero coste, sin API key, usa la infraestructura RSS que ya tenemos.

### 4. Job de sincronización

```typescript
// apps/api/src/jobs/sync-videos.ts
// Cron: cada 6 horas (o configurable)
// 1. Fetch VideoSources activas
// 2. Para cada source: fetch videos via RSS o API
// 3. Moderate title/description (reuse content-moderator)
// 4. Upsert to Reel table (dedup por videoUrl)
// 5. Marcar lastSyncedAt
```

### 5. Flujo del usuario

1. Niño abre /reels
2. API filtra Reel por los deportes del usuario (como news con userId)
3. Muestra videos recientes (ordenados por fecha de publicación)
4. Cada día hay videos nuevos de los canales configurados

### 6. Configuración parental

- Los padres pueden añadir/quitar VideoSources desde el panel parental
- Endpoint: `POST /api/reels/fuentes/custom` (similar a RSS custom sources)
- Los videos pasan por el mismo moderador AI que las noticias

## YouTube RSS — la solución más simple

```
https://www.youtube.com/feeds/videos.xml?channel_id=UCWOF2sgsYNqnEeT5aENM0fQ
```

Devuelve los últimos ~15 videos del canal en formato Atom/RSS. Se parsea con `rss-parser` que ya usamos para noticias. Cada entry tiene:

- `title` — título del video
- `link` — URL del video (convertir a embed URL)
- `published` — fecha de publicación
- `media:thumbnail` — thumbnail URL
- `media:description` — descripción

**Ventajas**: gratis, sin API key, sin límite de requests, infraestructura ya existente.

## Prioridad

**Alta** — es lo que hace que los reels sean útiles en el día a día. Sin esto, la pantalla de reels es estática.

## Estimación

- Backend (modelo + servicio + job + rutas): 1-2 días
- Seed con ~20 canales de YouTube: 0.5 día
- Frontend (configuración parental): 0.5 día
- **Total: 2-3 días**
