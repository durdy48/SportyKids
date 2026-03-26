# Backlog: Alternative content ingestion for sources without RSS

## Problem

Several Spanish sports media outlets do not provide RSS feeds:
- estadiodeportivo.com — no RSS
- muchodeporte.com — no RSS
- eldesmarque.com — no RSS
- elcorreodeandalucia.com — no RSS

These are important sources for the Spanish market but cannot be integrated via the current RSS-only aggregator.

## Proposed solutions (by industry recommendation)

### 1. Web scraping with Cheerio (recommended for PoC)
- Use `cheerio` + `node-fetch` to scrape the sports section HTML
- Extract article titles, summaries, images, and links from structured HTML
- New service: `apps/api/src/services/scraper.ts`
- Configure selectors per-source (CSS selectors for title, summary, etc.)
- Add `ingestMethod` field to `RssSource`: `'rss'` | `'scraper'` | `'api'`
- Run alongside RSS sync in the cron job

### 2. Headless browser (for JS-heavy sites)
- Use `puppeteer-core` or `playwright` for sites that require JavaScript rendering
- Heavier but necessary for SPAs and sites with anti-bot measures
- Only use as fallback when Cheerio fails

### 3. News API aggregators (paid but reliable)
- **NewsAPI.org** — free tier: 100 req/day, covers major outlets
- **GNews.io** — free tier: 100 req/day, supports Spanish sources
- **Mediastack** — free tier: 500 req/month
- These provide structured data (title, description, image, source) via REST API
- New service: `apps/api/src/services/news-api-client.ts`

### 4. Google News RSS (free workaround)
- Google News generates RSS feeds for topic searches: `https://news.google.com/rss/search?q=site:estadiodeportivo.com+deportes&hl=es&gl=ES`
- Works for any site indexed by Google, no scraping needed
- Limitations: delayed indexing, may miss articles, Google can change format

## Recommendation

Start with **option 4 (Google News RSS)** as immediate workaround — zero new dependencies, works with existing RSS infrastructure. Then implement **option 1 (Cheerio scraper)** for a more reliable long-term solution. Reserve option 3 for production if scraping proves unreliable.

## Affected sources to add once implemented

- estadiodeportivo.com
- muchodeporte.com
- eldesmarque.com
- elcorreodeandalucia.com (elcorreoweb.es)
