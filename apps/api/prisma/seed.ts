import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RssSourceSeed {
  name: string;
  url: string;
  sport: string;
  country?: string;
  language?: string;
  logoUrl?: string;
  description?: string;
  category?: string;
}

interface VideoSourceSeed {
  name: string;
  platform: string;
  feedUrl: string;
  channelId?: string;
  playlistId?: string;
  sport: string;
}

const initialVideoSources: VideoSourceSeed[] = [
  // ── Football ────────────────────────────────────────────────────────
  { name: 'La Liga Official', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCIk1SjEGvIaLP01IyjqhUdQ', channelId: 'UCIk1SjEGvIaLP01IyjqhUdQ', sport: 'football' },
  { name: 'FC Barcelona', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC14UlmYlSNiQCBe9Eookf_A', channelId: 'UC14UlmYlSNiQCBe9Eookf_A', sport: 'football' },
  { name: 'Real Madrid CF', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWV3obpZVGgJ3j9FVhEjhPQ', channelId: 'UCWV3obpZVGgJ3j9FVhEjhPQ', sport: 'football' },
  { name: 'Premier League', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCG5qGWdu8nIRZqJ_GgDwQ-w', channelId: 'UCG5qGWdu8nIRZqJ_GgDwQ-w', sport: 'football' },
  { name: 'UEFA Champions League', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCmqtR_Zcb9tVOhSR4GJPOdA', channelId: 'UCmqtR_Zcb9tVOhSR4GJPOdA', sport: 'football' },

  // ── Basketball ──────────────────────────────────────────────────────
  { name: 'NBA', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWJ2lWNubArHWmf3FIHbfcQ', channelId: 'UCWJ2lWNubArHWmf3FIHbfcQ', sport: 'basketball' },
  { name: 'ACB Liga Endesa', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsQKJjv_7sCJ3H5e2ToxsRQ', channelId: 'UCsQKJjv_7sCJ3H5e2ToxsRQ', sport: 'basketball' },
  { name: 'EuroLeague Basketball', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHZVHPyEBBiCN_MWGLvoE6g', channelId: 'UCHZVHPyEBBiCN_MWGLvoE6g', sport: 'basketball' },

  // ── Tennis ──────────────────────────────────────────────────────────
  { name: 'ATP Tour', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbcxFkd6B9xUU54tGlefpBQ', channelId: 'UCbcxFkd6B9xUU54tGlefpBQ', sport: 'tennis' },
  { name: 'WTA Tennis', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCfgFISz_Dml2FvndRLICm6Q', channelId: 'UCfgFISz_Dml2FvndRLICm6Q', sport: 'tennis' },
  { name: 'Roland Garros', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCLhFbNomu6fEJ8LAQHFGCFA', channelId: 'UCLhFbNomu6fEJ8LAQHFGCFA', sport: 'tennis' },

  // ── Swimming ────────────────────────────────────────────────────────
  { name: 'World Aquatics', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCOmS8sLY6FjYqFHqYdTYIwg', channelId: 'UCOmS8sLY6FjYqFHqYdTYIwg', sport: 'swimming' },
  { name: 'SwimSwam Video', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCxkfAhgF2bXi8rZCmekJJJQ', channelId: 'UCxkfAhgF2bXi8rZCmekJJJQ', sport: 'swimming' },

  // ── Athletics ───────────────────────────────────────────────────────
  { name: 'World Athletics', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXhSfRMgSE-OFCHPEgjjKUg', channelId: 'UCXhSfRMgSE-OFCHPEgjjKUg', sport: 'athletics' },
  { name: 'Olympics', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCTl3QQTvqHFjurroKxexy2Q', channelId: 'UCTl3QQTvqHFjurroKxexy2Q', sport: 'athletics' },

  // ── Cycling ─────────────────────────────────────────────────────────
  { name: 'GCN en Espanol', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbgDgpSIjCO3CVQFE5P5XRQ', channelId: 'UCbgDgpSIjCO3CVQFE5P5XRQ', sport: 'cycling' },
  { name: 'Tour de France', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCikVMad1jqoGYIDftpFm2Aw', channelId: 'UCikVMad1jqoGYIDftpFm2Aw', sport: 'cycling' },

  // ── Formula 1 ───────────────────────────────────────────────────────
  { name: 'Formula 1', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCB_qr75-ydFVKSz9KnBMLpg', channelId: 'UCB_qr75-ydFVKSz9KnBMLpg', sport: 'formula1' },
  { name: 'Scuderia Ferrari', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCEsCUOoJoR7Y5c2wuEIo8lQ', channelId: 'UCEsCUOoJoR7Y5c2wuEIo8lQ', sport: 'formula1' },

  // ── Padel ───────────────────────────────────────────────────────────
  { name: 'Premier Padel', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCW-WYt6vA9DJQHE0zOA8e0A', channelId: 'UCW-WYt6vA9DJQHE0zOA8e0A', sport: 'padel' },
  { name: 'World Padel Tour', platform: 'youtube_channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCMxpzwjvC64W5OUFNZ9ReOA', channelId: 'UCMxpzwjvC64W5OUFNZ9ReOA', sport: 'padel' },
];

const initialSources: RssSourceSeed[] = [
  // ── Football (Spain) ──────────────────────────────────────────────
  { name: 'Marca - Football', url: 'https://feeds.marca.com/rss/portada.xml', sport: 'football', country: 'ES', language: 'es', description: 'Marca — leading Spanish sports newspaper', category: 'general' },
  { name: 'AS - Football', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/', sport: 'football', country: 'ES', language: 'es', description: 'Diario AS — football section', category: 'general' },
  { name: 'Mundo Deportivo - Football', url: 'https://www.mundodeportivo.com/rss/futbol', sport: 'football', country: 'ES', language: 'es', description: 'Mundo Deportivo — Catalan sports daily', category: 'general' },
  { name: 'Sport - Football', url: 'https://www.sport.es/es/rss/futbol/rss.xml', sport: 'football', country: 'ES', language: 'es', description: 'Diario Sport — Barcelona-focused football', category: 'general' },
  { name: 'Marca - La Liga', url: 'https://feeds.marca.com/rss/futbol/liga-santander.xml', sport: 'football', country: 'ES', language: 'es', description: 'Marca — La Liga coverage', category: 'league' },
  { name: 'Marca - Champions League', url: 'https://feeds.marca.com/rss/futbol/champions-league.xml', sport: 'football', country: 'ES', language: 'es', description: 'Marca — Champions League coverage', category: 'league' },
  { name: 'El País - Deportes', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada/', sport: 'football', country: 'ES', language: 'es', description: 'El País — sección deportes del diario generalista', category: 'general' },
  { name: 'El Mundo - Deportes', url: 'https://www.elmundo.es/rss/deportes.xml', sport: 'football', country: 'ES', language: 'es', description: 'El Mundo — sección deportes', category: 'general' },
  { name: 'Diario de Sevilla - Deportes', url: 'https://www.diariodesevilla.es/rss/deportes/', sport: 'football', country: 'ES', language: 'es', description: 'Diario de Sevilla — sección deportes', category: 'general' },

  // ── Football (International) ──────────────────────────────────────
  { name: 'BBC Sport - Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', sport: 'football', country: 'GB', language: 'en', description: 'BBC Sport football news', category: 'general' },
  { name: 'Sky Sports - Football', url: 'https://www.skysports.com/rss/12040', sport: 'football', country: 'GB', language: 'en', description: 'Sky Sports — Premier League and more', category: 'general' },
  { name: 'ESPN - Football', url: 'https://www.espn.com/espn/rss/soccer/news', sport: 'football', country: 'US', language: 'en', description: 'ESPN soccer/football coverage', category: 'general' },
  { name: 'Goal.com', url: 'https://www.goal.com/feeds/en/news', sport: 'football', country: 'GB', language: 'en', description: 'Goal.com — global football news', category: 'general' },

  // ── Basketball ────────────────────────────────────────────────────
  { name: 'AS - Basketball', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/baloncesto/portada/', sport: 'basketball', country: 'ES', language: 'es', description: 'Diario AS — basketball section', category: 'general' },
  { name: 'Marca - Basketball', url: 'https://feeds.marca.com/rss/baloncesto.xml', sport: 'basketball', country: 'ES', language: 'es', description: 'Marca — basketball coverage', category: 'general' },
  { name: 'Mundo Deportivo - Basketball', url: 'https://www.mundodeportivo.com/rss/baloncesto', sport: 'basketball', country: 'ES', language: 'es', description: 'Mundo Deportivo — basketball section', category: 'general' },
  { name: 'BBC Sport - Basketball', url: 'https://feeds.bbci.co.uk/sport/basketball/rss.xml', sport: 'basketball', country: 'GB', language: 'en', description: 'BBC Sport basketball news', category: 'general' },
  { name: 'ESPN - NBA', url: 'https://www.espn.com/espn/rss/nba/news', sport: 'basketball', country: 'US', language: 'en', description: 'ESPN NBA coverage', category: 'league' },

  // ── Tennis ────────────────────────────────────────────────────────
  { name: 'Marca - Tennis', url: 'https://feeds.marca.com/rss/tenis.xml', sport: 'tennis', country: 'ES', language: 'es', description: 'Marca — tennis section', category: 'general' },
  { name: 'AS - Tennis', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/tenis/portada/', sport: 'tennis', country: 'ES', language: 'es', description: 'Diario AS — tennis section', category: 'general' },
  { name: 'Mundo Deportivo - Tennis', url: 'https://www.mundodeportivo.com/rss/tenis', sport: 'tennis', country: 'ES', language: 'es', description: 'Mundo Deportivo — tennis section', category: 'general' },
  { name: 'BBC Sport - Tennis', url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', sport: 'tennis', country: 'GB', language: 'en', description: 'BBC Sport tennis news', category: 'general' },
  { name: 'ESPN - Tennis', url: 'https://www.espn.com/espn/rss/tennis/news', sport: 'tennis', country: 'US', language: 'en', description: 'ESPN tennis coverage', category: 'general' },

  // ── Swimming ──────────────────────────────────────────────────────
  { name: 'SwimSwam', url: 'https://swimswam.com/feed/', sport: 'swimming', country: 'US', language: 'en', description: 'SwimSwam — competitive swimming news', category: 'general' },
  { name: 'Marca - Swimming', url: 'https://feeds.marca.com/rss/natacion.xml', sport: 'swimming', country: 'ES', language: 'es', description: 'Marca — swimming section', category: 'general' },
  { name: 'Swimming World Magazine', url: 'https://www.swimmingworldmagazine.com/news/feed/', sport: 'swimming', country: 'US', language: 'en', description: 'Swimming World Magazine news', category: 'general' },

  // ── Athletics ─────────────────────────────────────────────────────
  { name: 'Marca - Athletics', url: 'https://feeds.marca.com/rss/atletismo.xml', sport: 'athletics', country: 'ES', language: 'es', description: 'Marca — athletics section', category: 'general' },
  { name: 'BBC Sport - Athletics', url: 'https://feeds.bbci.co.uk/sport/athletics/rss.xml', sport: 'athletics', country: 'GB', language: 'en', description: 'BBC Sport athletics news', category: 'general' },
  { name: 'World Athletics News', url: 'https://worldathletics.org/rss/news', sport: 'athletics', country: 'MC', language: 'en', description: 'Official World Athletics news feed', category: 'official' },
  { name: 'LetsRun', url: 'https://www.letsrun.com/feed/', sport: 'athletics', country: 'US', language: 'en', description: 'LetsRun — running and track & field', category: 'general' },

  // ── Cycling ───────────────────────────────────────────────────────
  { name: 'Marca - Cycling', url: 'https://feeds.marca.com/rss/ciclismo.xml', sport: 'cycling', country: 'ES', language: 'es', description: 'Marca — cycling section', category: 'general' },
  { name: 'AS - Cycling', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/ciclismo/portada/', sport: 'cycling', country: 'ES', language: 'es', description: 'Diario AS — cycling section', category: 'general' },
  { name: 'CyclingNews', url: 'https://www.cyclingnews.com/rss', sport: 'cycling', country: 'GB', language: 'en', description: 'CyclingNews — professional road cycling', category: 'general' },
  { name: 'VeloNews', url: 'https://www.velonews.com/feed/', sport: 'cycling', country: 'US', language: 'en', description: 'VeloNews — American cycling journal', category: 'general' },
  { name: 'BBC Sport - Cycling', url: 'https://feeds.bbci.co.uk/sport/cycling/rss.xml', sport: 'cycling', country: 'GB', language: 'en', description: 'BBC Sport cycling news', category: 'general' },

  // ── Formula 1 ─────────────────────────────────────────────────────
  { name: 'Marca - Formula 1', url: 'https://feeds.marca.com/rss/motor/formula1.xml', sport: 'formula1', country: 'ES', language: 'es', description: 'Marca — Formula 1 coverage', category: 'general' },
  { name: 'AS - Formula 1', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/motor/formula-1/portada/', sport: 'formula1', country: 'ES', language: 'es', description: 'Diario AS — F1 section', category: 'general' },
  { name: 'Mundo Deportivo - Formula 1', url: 'https://www.mundodeportivo.com/rss/motor/f1', sport: 'formula1', country: 'ES', language: 'es', description: 'Mundo Deportivo — F1 section', category: 'general' },
  { name: 'BBC Sport - Formula 1', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', sport: 'formula1', country: 'GB', language: 'en', description: 'BBC Sport F1 news', category: 'general' },
  { name: 'ESPN - F1', url: 'https://www.espn.com/espn/rss/f1/news', sport: 'formula1', country: 'US', language: 'en', description: 'ESPN F1 coverage', category: 'general' },
  { name: 'Autosport', url: 'https://www.autosport.com/rss/feed/f1', sport: 'formula1', country: 'GB', language: 'en', description: 'Autosport — F1 and motorsport', category: 'general' },

  // ── Padel ─────────────────────────────────────────────────────────
  { name: 'Marca - Padel', url: 'https://feeds.marca.com/rss/padel.xml', sport: 'padel', country: 'ES', language: 'es', description: 'Marca — padel section', category: 'general' },
  { name: 'Mundo Deportivo - Padel', url: 'https://www.mundodeportivo.com/rss/padel', sport: 'padel', country: 'ES', language: 'es', description: 'Mundo Deportivo — padel section', category: 'general' },
  { name: 'PadelSpain', url: 'https://padelspain.net/feed/', sport: 'padel', country: 'ES', language: 'es', description: 'PadelSpain — dedicated padel news', category: 'general' },
  { name: 'PadelFIP', url: 'https://www.padelfip.com/feed/', sport: 'padel', country: 'ES', language: 'en', description: 'International Padel Federation news', category: 'official' },

  // ── Google News RSS (Spanish outlets without native RSS) ─────────
  // Estadio Deportivo
  { name: 'Google News: Estadio Deportivo - Football', url: 'https://news.google.com/rss/search?q=site:estadiodeportivo.com+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Estadio Deportivo football coverage via Google News RSS', category: 'google_news' },
  { name: 'Google News: Estadio Deportivo - Basketball', url: 'https://news.google.com/rss/search?q=site:estadiodeportivo.com+baloncesto&hl=es&gl=ES', sport: 'basketball', country: 'ES', language: 'es', description: 'Estadio Deportivo basketball coverage via Google News RSS', category: 'google_news' },
  { name: 'Google News: Estadio Deportivo - General', url: 'https://news.google.com/rss/search?q=site:estadiodeportivo.com+deportes&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Estadio Deportivo general sports via Google News RSS', category: 'google_news' },
  // Mucho Deporte
  { name: 'Google News: Mucho Deporte - Football', url: 'https://news.google.com/rss/search?q=site:muchodeporte.com+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Mucho Deporte football coverage via Google News RSS', category: 'google_news' },
  { name: 'Google News: Mucho Deporte - General', url: 'https://news.google.com/rss/search?q=site:muchodeporte.com+deportes&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Mucho Deporte general sports via Google News RSS', category: 'google_news' },
  // El Desmarque
  { name: 'Google News: El Desmarque - Football', url: 'https://news.google.com/rss/search?q=site:eldesmarque.com+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'El Desmarque football coverage via Google News RSS', category: 'google_news' },
  { name: 'Google News: El Desmarque - Basketball', url: 'https://news.google.com/rss/search?q=site:eldesmarque.com+baloncesto&hl=es&gl=ES', sport: 'basketball', country: 'ES', language: 'es', description: 'El Desmarque basketball coverage via Google News RSS', category: 'google_news' },
  { name: 'Google News: El Desmarque - General', url: 'https://news.google.com/rss/search?q=site:eldesmarque.com+deportes&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'El Desmarque general sports via Google News RSS', category: 'google_news' },
  // El Correo de Andalucia
  { name: 'Google News: El Correo de Andalucia - Football', url: 'https://news.google.com/rss/search?q=site:elcorreoweb.es+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'El Correo de Andalucia football coverage via Google News RSS', category: 'google_news' },
  { name: 'Google News: El Correo de Andalucia - General', url: 'https://news.google.com/rss/search?q=site:elcorreoweb.es+deportes&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'El Correo de Andalucia general sports via Google News RSS', category: 'google_news' },
  // ── Team/Athlete news via Google News RSS ───────────────────────────

  // Football — La Liga (Spain)
  { name: 'Google News: Real Madrid', url: 'https://news.google.com/rss/search?q=%22Real+Madrid%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Real Madrid news via Google News', category: 'team_news' },
  { name: 'Google News: FC Barcelona', url: 'https://news.google.com/rss/search?q=%22FC+Barcelona%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'FC Barcelona news via Google News', category: 'team_news' },
  { name: 'Google News: Atletico de Madrid', url: 'https://news.google.com/rss/search?q=%22Atletico+de+Madrid%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Atletico de Madrid news via Google News', category: 'team_news' },
  { name: 'Google News: Sevilla FC', url: 'https://news.google.com/rss/search?q=%22Sevilla+FC%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Sevilla FC news via Google News', category: 'team_news' },
  { name: 'Google News: Real Betis', url: 'https://news.google.com/rss/search?q=%22Real+Betis%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Real Betis news via Google News', category: 'team_news' },
  { name: 'Google News: Athletic Club', url: 'https://news.google.com/rss/search?q=%22Athletic+Club%22+Bilbao+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Athletic Club news via Google News', category: 'team_news' },
  { name: 'Google News: Real Sociedad', url: 'https://news.google.com/rss/search?q=%22Real+Sociedad%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Real Sociedad news via Google News', category: 'team_news' },
  { name: 'Google News: Valencia CF', url: 'https://news.google.com/rss/search?q=%22Valencia+CF%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Valencia CF news via Google News', category: 'team_news' },
  { name: 'Google News: Villarreal', url: 'https://news.google.com/rss/search?q=%22Villarreal+CF%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Villarreal news via Google News', category: 'team_news' },
  { name: 'Google News: Girona FC', url: 'https://news.google.com/rss/search?q=%22Girona+FC%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Girona FC news via Google News', category: 'team_news' },
  { name: 'Google News: Celta de Vigo', url: 'https://news.google.com/rss/search?q=%22Celta+de+Vigo%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Celta de Vigo news via Google News', category: 'team_news' },
  { name: 'Google News: Osasuna', url: 'https://news.google.com/rss/search?q=%22Osasuna%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Osasuna news via Google News', category: 'team_news' },
  { name: 'Google News: RCD Mallorca', url: 'https://news.google.com/rss/search?q=%22RCD+Mallorca%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'RCD Mallorca news via Google News', category: 'team_news' },
  { name: 'Google News: Getafe CF', url: 'https://news.google.com/rss/search?q=%22Getafe+CF%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Getafe CF news via Google News', category: 'team_news' },
  { name: 'Google News: Rayo Vallecano', url: 'https://news.google.com/rss/search?q=%22Rayo+Vallecano%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Rayo Vallecano news via Google News', category: 'team_news' },
  { name: 'Google News: Las Palmas', url: 'https://news.google.com/rss/search?q=%22UD+Las+Palmas%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'UD Las Palmas news via Google News', category: 'team_news' },
  { name: 'Google News: Alaves', url: 'https://news.google.com/rss/search?q=%22Deportivo+Alaves%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Deportivo Alaves news via Google News', category: 'team_news' },
  { name: 'Google News: Espanyol', url: 'https://news.google.com/rss/search?q=%22RCD+Espanyol%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'RCD Espanyol news via Google News', category: 'team_news' },
  { name: 'Google News: Leganes', url: 'https://news.google.com/rss/search?q=%22CD+Leganes%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'CD Leganes news via Google News', category: 'team_news' },
  { name: 'Google News: Real Valladolid', url: 'https://news.google.com/rss/search?q=%22Real+Valladolid%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Real Valladolid news via Google News', category: 'team_news' },

  // Football — Premier League (England)
  { name: 'Google News: Manchester City', url: 'https://news.google.com/rss/search?q=%22Manchester+City%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Manchester City news via Google News', category: 'team_news' },
  { name: 'Google News: Liverpool FC', url: 'https://news.google.com/rss/search?q=%22Liverpool+FC%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Liverpool FC news via Google News', category: 'team_news' },
  { name: 'Google News: Arsenal FC', url: 'https://news.google.com/rss/search?q=%22Arsenal+FC%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Arsenal FC news via Google News', category: 'team_news' },
  { name: 'Google News: Chelsea FC', url: 'https://news.google.com/rss/search?q=%22Chelsea+FC%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Chelsea FC news via Google News', category: 'team_news' },
  { name: 'Google News: Manchester United', url: 'https://news.google.com/rss/search?q=%22Manchester+United%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Manchester United news via Google News', category: 'team_news' },
  { name: 'Google News: Tottenham', url: 'https://news.google.com/rss/search?q=%22Tottenham+Hotspur%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Tottenham Hotspur news via Google News', category: 'team_news' },
  { name: 'Google News: Newcastle United', url: 'https://news.google.com/rss/search?q=%22Newcastle+United%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Newcastle United news via Google News', category: 'team_news' },
  { name: 'Google News: Aston Villa', url: 'https://news.google.com/rss/search?q=%22Aston+Villa%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Aston Villa news via Google News', category: 'team_news' },
  { name: 'Google News: Brighton', url: 'https://news.google.com/rss/search?q=%22Brighton+Hove+Albion%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Brighton & Hove Albion news via Google News', category: 'team_news' },
  { name: 'Google News: West Ham', url: 'https://news.google.com/rss/search?q=%22West+Ham+United%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'West Ham United news via Google News', category: 'team_news' },
  { name: 'Google News: Nottingham Forest', url: 'https://news.google.com/rss/search?q=%22Nottingham+Forest%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Nottingham Forest news via Google News', category: 'team_news' },
  { name: 'Google News: Bournemouth', url: 'https://news.google.com/rss/search?q=%22AFC+Bournemouth%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'AFC Bournemouth news via Google News', category: 'team_news' },
  { name: 'Google News: Fulham', url: 'https://news.google.com/rss/search?q=%22Fulham+FC%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Fulham FC news via Google News', category: 'team_news' },
  { name: 'Google News: Crystal Palace', url: 'https://news.google.com/rss/search?q=%22Crystal+Palace%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Crystal Palace news via Google News', category: 'team_news' },
  { name: 'Google News: Brentford', url: 'https://news.google.com/rss/search?q=%22Brentford+FC%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Brentford FC news via Google News', category: 'team_news' },
  { name: 'Google News: Everton', url: 'https://news.google.com/rss/search?q=%22Everton+FC%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Everton FC news via Google News', category: 'team_news' },
  { name: 'Google News: Wolverhampton', url: 'https://news.google.com/rss/search?q=%22Wolverhampton+Wanderers%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Wolverhampton Wanderers news via Google News', category: 'team_news' },
  { name: 'Google News: Leicester City', url: 'https://news.google.com/rss/search?q=%22Leicester+City%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Leicester City news via Google News', category: 'team_news' },
  { name: 'Google News: Ipswich Town', url: 'https://news.google.com/rss/search?q=%22Ipswich+Town%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Ipswich Town news via Google News', category: 'team_news' },
  { name: 'Google News: Southampton', url: 'https://news.google.com/rss/search?q=%22Southampton+FC%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'Southampton FC news via Google News', category: 'team_news' },

  // Football — Serie A (Italy)
  { name: 'Google News: Inter Milan', url: 'https://news.google.com/rss/search?q=%22Inter+Milan%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'Inter Milan news via Google News', category: 'team_news' },
  { name: 'Google News: AC Milan', url: 'https://news.google.com/rss/search?q=%22AC+Milan%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'AC Milan news via Google News', category: 'team_news' },
  { name: 'Google News: Juventus', url: 'https://news.google.com/rss/search?q=%22Juventus%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'Juventus news via Google News', category: 'team_news' },
  { name: 'Google News: Napoli', url: 'https://news.google.com/rss/search?q=%22SSC+Napoli%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'SSC Napoli news via Google News', category: 'team_news' },
  { name: 'Google News: Atalanta', url: 'https://news.google.com/rss/search?q=%22Atalanta%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'Atalanta news via Google News', category: 'team_news' },
  { name: 'Google News: AS Roma', url: 'https://news.google.com/rss/search?q=%22AS+Roma%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'AS Roma news via Google News', category: 'team_news' },
  { name: 'Google News: Lazio', url: 'https://news.google.com/rss/search?q=%22SS+Lazio%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'SS Lazio news via Google News', category: 'team_news' },
  { name: 'Google News: Fiorentina', url: 'https://news.google.com/rss/search?q=%22Fiorentina%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'Fiorentina news via Google News', category: 'team_news' },
  { name: 'Google News: Bologna', url: 'https://news.google.com/rss/search?q=%22Bologna+FC%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'Bologna FC news via Google News', category: 'team_news' },

  // Football — Bundesliga (Germany)
  { name: 'Google News: Bayern Munich', url: 'https://news.google.com/rss/search?q=%22Bayern+Munich%22+football&hl=en&gl=GB', sport: 'football', country: 'DE', language: 'en', description: 'Bayern Munich news via Google News', category: 'team_news' },
  { name: 'Google News: Borussia Dortmund', url: 'https://news.google.com/rss/search?q=%22Borussia+Dortmund%22+football&hl=en&gl=GB', sport: 'football', country: 'DE', language: 'en', description: 'Borussia Dortmund news via Google News', category: 'team_news' },
  { name: 'Google News: Bayer Leverkusen', url: 'https://news.google.com/rss/search?q=%22Bayer+Leverkusen%22+football&hl=en&gl=GB', sport: 'football', country: 'DE', language: 'en', description: 'Bayer Leverkusen news via Google News', category: 'team_news' },
  { name: 'Google News: RB Leipzig', url: 'https://news.google.com/rss/search?q=%22RB+Leipzig%22+football&hl=en&gl=GB', sport: 'football', country: 'DE', language: 'en', description: 'RB Leipzig news via Google News', category: 'team_news' },
  { name: 'Google News: VfB Stuttgart', url: 'https://news.google.com/rss/search?q=%22VfB+Stuttgart%22+football&hl=en&gl=GB', sport: 'football', country: 'DE', language: 'en', description: 'VfB Stuttgart news via Google News', category: 'team_news' },

  // Football — Ligue 1 (France)
  { name: 'Google News: PSG', url: 'https://news.google.com/rss/search?q=%22Paris+Saint+Germain%22+football&hl=en&gl=GB', sport: 'football', country: 'FR', language: 'en', description: 'Paris Saint-Germain news via Google News', category: 'team_news' },
  { name: 'Google News: Marseille', url: 'https://news.google.com/rss/search?q=%22Olympique+Marseille%22+football&hl=en&gl=GB', sport: 'football', country: 'FR', language: 'en', description: 'Olympique de Marseille news via Google News', category: 'team_news' },
  { name: 'Google News: Monaco', url: 'https://news.google.com/rss/search?q=%22AS+Monaco%22+football&hl=en&gl=GB', sport: 'football', country: 'FR', language: 'en', description: 'AS Monaco news via Google News', category: 'team_news' },
  { name: 'Google News: Lyon', url: 'https://news.google.com/rss/search?q=%22Olympique+Lyon%22+football&hl=en&gl=GB', sport: 'football', country: 'FR', language: 'en', description: 'Olympique Lyonnais news via Google News', category: 'team_news' },
  { name: 'Google News: Lille', url: 'https://news.google.com/rss/search?q=%22LOSC+Lille%22+football&hl=en&gl=GB', sport: 'football', country: 'FR', language: 'en', description: 'LOSC Lille news via Google News', category: 'team_news' },

  // Football — National Teams
  { name: 'Google News: Seleccion Espanola', url: 'https://news.google.com/rss/search?q=%22seleccion+espanola%22+futbol&hl=es&gl=ES', sport: 'football', country: 'ES', language: 'es', description: 'Spain National Team news via Google News', category: 'team_news' },
  { name: 'Google News: Argentina National Team', url: 'https://news.google.com/rss/search?q=%22seleccion+argentina%22+futbol&hl=es&gl=ES', sport: 'football', country: 'AR', language: 'es', description: 'Argentina National Team news via Google News', category: 'team_news' },
  { name: 'Google News: Brazil National Team', url: 'https://news.google.com/rss/search?q=%22Brazil+national+team%22+football&hl=en&gl=GB', sport: 'football', country: 'BR', language: 'en', description: 'Brazil National Team news via Google News', category: 'team_news' },
  { name: 'Google News: France National Team', url: 'https://news.google.com/rss/search?q=%22France+national+team%22+football&hl=en&gl=GB', sport: 'football', country: 'FR', language: 'en', description: 'France National Team news via Google News', category: 'team_news' },
  { name: 'Google News: Germany National Team', url: 'https://news.google.com/rss/search?q=%22Germany+national+team%22+football&hl=en&gl=GB', sport: 'football', country: 'DE', language: 'en', description: 'Germany National Team news via Google News', category: 'team_news' },
  { name: 'Google News: England National Team', url: 'https://news.google.com/rss/search?q=%22England+national+team%22+football&hl=en&gl=GB', sport: 'football', country: 'GB', language: 'en', description: 'England National Team news via Google News', category: 'team_news' },
  { name: 'Google News: Portugal National Team', url: 'https://news.google.com/rss/search?q=%22Portugal+national+team%22+football&hl=en&gl=GB', sport: 'football', country: 'PT', language: 'en', description: 'Portugal National Team news via Google News', category: 'team_news' },
  { name: 'Google News: Italy National Team', url: 'https://news.google.com/rss/search?q=%22Italy+national+team%22+football&hl=en&gl=GB', sport: 'football', country: 'IT', language: 'en', description: 'Italy National Team news via Google News', category: 'team_news' },
  { name: 'Google News: Mexico National Team', url: 'https://news.google.com/rss/search?q=%22seleccion+mexicana%22+futbol&hl=es&gl=ES', sport: 'football', country: 'MX', language: 'es', description: 'Mexico National Team news via Google News', category: 'team_news' },
  { name: 'Google News: USA National Team', url: 'https://news.google.com/rss/search?q=%22USMNT%22+soccer&hl=en&gl=US', sport: 'football', country: 'US', language: 'en', description: 'USA National Team news via Google News', category: 'team_news' },
  { name: 'Google News: Colombia National Team', url: 'https://news.google.com/rss/search?q=%22seleccion+Colombia%22+futbol&hl=es&gl=ES', sport: 'football', country: 'CO', language: 'es', description: 'Colombia National Team news via Google News', category: 'team_news' },

  // Basketball — NBA
  { name: 'Google News: LA Lakers', url: 'https://news.google.com/rss/search?q=%22Los+Angeles+Lakers%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'LA Lakers news via Google News', category: 'team_news' },
  { name: 'Google News: Boston Celtics', url: 'https://news.google.com/rss/search?q=%22Boston+Celtics%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'Boston Celtics news via Google News', category: 'team_news' },
  { name: 'Google News: Golden State Warriors', url: 'https://news.google.com/rss/search?q=%22Golden+State+Warriors%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'Golden State Warriors news via Google News', category: 'team_news' },
  { name: 'Google News: Milwaukee Bucks', url: 'https://news.google.com/rss/search?q=%22Milwaukee+Bucks%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'Milwaukee Bucks news via Google News', category: 'team_news' },
  { name: 'Google News: Denver Nuggets', url: 'https://news.google.com/rss/search?q=%22Denver+Nuggets%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'Denver Nuggets news via Google News', category: 'team_news' },
  { name: 'Google News: Philadelphia 76ers', url: 'https://news.google.com/rss/search?q=%22Philadelphia+76ers%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'Philadelphia 76ers news via Google News', category: 'team_news' },
  { name: 'Google News: Miami Heat', url: 'https://news.google.com/rss/search?q=%22Miami+Heat%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'Miami Heat news via Google News', category: 'team_news' },
  { name: 'Google News: Dallas Mavericks', url: 'https://news.google.com/rss/search?q=%22Dallas+Mavericks%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'Dallas Mavericks news via Google News', category: 'team_news' },
  { name: 'Google News: Phoenix Suns', url: 'https://news.google.com/rss/search?q=%22Phoenix+Suns%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'Phoenix Suns news via Google News', category: 'team_news' },
  { name: 'Google News: New York Knicks', url: 'https://news.google.com/rss/search?q=%22New+York+Knicks%22+NBA&hl=en&gl=US', sport: 'basketball', country: 'US', language: 'en', description: 'New York Knicks news via Google News', category: 'team_news' },

  // Basketball — EuroLeague / ACB
  { name: 'Google News: Real Madrid Basket', url: 'https://news.google.com/rss/search?q=%22Real+Madrid%22+baloncesto&hl=es&gl=ES', sport: 'basketball', country: 'ES', language: 'es', description: 'Real Madrid basketball news via Google News', category: 'team_news' },
  { name: 'Google News: Barcelona Basket', url: 'https://news.google.com/rss/search?q=%22Barcelona%22+baloncesto+ACB&hl=es&gl=ES', sport: 'basketball', country: 'ES', language: 'es', description: 'FC Barcelona basketball news via Google News', category: 'team_news' },
  { name: 'Google News: Baskonia', url: 'https://news.google.com/rss/search?q=%22Baskonia%22+baloncesto&hl=es&gl=ES', sport: 'basketball', country: 'ES', language: 'es', description: 'Baskonia basketball news via Google News', category: 'team_news' },
  { name: 'Google News: Valencia Basket', url: 'https://news.google.com/rss/search?q=%22Valencia+Basket%22+baloncesto&hl=es&gl=ES', sport: 'basketball', country: 'ES', language: 'es', description: 'Valencia Basket news via Google News', category: 'team_news' },
  { name: 'Google News: Unicaja', url: 'https://news.google.com/rss/search?q=%22Unicaja%22+baloncesto&hl=es&gl=ES', sport: 'basketball', country: 'ES', language: 'es', description: 'Unicaja basketball news via Google News', category: 'team_news' },
  { name: 'Google News: Joventut', url: 'https://news.google.com/rss/search?q=%22Joventut+Badalona%22+baloncesto&hl=es&gl=ES', sport: 'basketball', country: 'ES', language: 'es', description: 'Joventut Badalona basketball news via Google News', category: 'team_news' },

  // Tennis — Top Players
  { name: 'Google News: Carlos Alcaraz', url: 'https://news.google.com/rss/search?q=%22Carlos+Alcaraz%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'ES', language: 'en', description: 'Carlos Alcaraz news via Google News', category: 'team_news' },
  { name: 'Google News: Jannik Sinner', url: 'https://news.google.com/rss/search?q=%22Jannik+Sinner%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'IT', language: 'en', description: 'Jannik Sinner news via Google News', category: 'team_news' },
  { name: 'Google News: Novak Djokovic', url: 'https://news.google.com/rss/search?q=%22Novak+Djokovic%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'RS', language: 'en', description: 'Novak Djokovic news via Google News', category: 'team_news' },
  { name: 'Google News: Alexander Zverev', url: 'https://news.google.com/rss/search?q=%22Alexander+Zverev%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'DE', language: 'en', description: 'Alexander Zverev news via Google News', category: 'team_news' },
  { name: 'Google News: Daniil Medvedev', url: 'https://news.google.com/rss/search?q=%22Daniil+Medvedev%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'RU', language: 'en', description: 'Daniil Medvedev news via Google News', category: 'team_news' },
  { name: 'Google News: Iga Swiatek', url: 'https://news.google.com/rss/search?q=%22Iga+Swiatek%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'PL', language: 'en', description: 'Iga Swiatek news via Google News', category: 'team_news' },
  { name: 'Google News: Aryna Sabalenka', url: 'https://news.google.com/rss/search?q=%22Aryna+Sabalenka%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'BY', language: 'en', description: 'Aryna Sabalenka news via Google News', category: 'team_news' },
  { name: 'Google News: Coco Gauff', url: 'https://news.google.com/rss/search?q=%22Coco+Gauff%22+tennis&hl=en&gl=US', sport: 'tennis', country: 'US', language: 'en', description: 'Coco Gauff news via Google News', category: 'team_news' },
  { name: 'Google News: Rafael Nadal', url: 'https://news.google.com/rss/search?q=%22Rafael+Nadal%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'ES', language: 'en', description: 'Rafael Nadal news via Google News', category: 'team_news' },
  { name: 'Google News: Stefanos Tsitsipas', url: 'https://news.google.com/rss/search?q=%22Stefanos+Tsitsipas%22+tennis&hl=en&gl=GB', sport: 'tennis', country: 'GR', language: 'en', description: 'Stefanos Tsitsipas news via Google News', category: 'team_news' },

  // Formula 1 — Drivers & Teams
  { name: 'Google News: Fernando Alonso', url: 'https://news.google.com/rss/search?q=%22Fernando+Alonso%22+formula+1&hl=es&gl=ES', sport: 'formula1', country: 'ES', language: 'es', description: 'Fernando Alonso F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Carlos Sainz F1', url: 'https://news.google.com/rss/search?q=%22Carlos+Sainz%22+F1&hl=es&gl=ES', sport: 'formula1', country: 'ES', language: 'es', description: 'Carlos Sainz F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Max Verstappen', url: 'https://news.google.com/rss/search?q=%22Max+Verstappen%22+F1&hl=en&gl=GB', sport: 'formula1', country: 'NL', language: 'en', description: 'Max Verstappen F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Lewis Hamilton', url: 'https://news.google.com/rss/search?q=%22Lewis+Hamilton%22+F1&hl=en&gl=GB', sport: 'formula1', country: 'GB', language: 'en', description: 'Lewis Hamilton F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Charles Leclerc', url: 'https://news.google.com/rss/search?q=%22Charles+Leclerc%22+F1&hl=en&gl=GB', sport: 'formula1', country: 'MC', language: 'en', description: 'Charles Leclerc F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Lando Norris', url: 'https://news.google.com/rss/search?q=%22Lando+Norris%22+F1&hl=en&gl=GB', sport: 'formula1', country: 'GB', language: 'en', description: 'Lando Norris F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Oscar Piastri', url: 'https://news.google.com/rss/search?q=%22Oscar+Piastri%22+F1&hl=en&gl=GB', sport: 'formula1', country: 'AU', language: 'en', description: 'Oscar Piastri F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Red Bull Racing', url: 'https://news.google.com/rss/search?q=%22Red+Bull+Racing%22+F1&hl=en&gl=GB', sport: 'formula1', country: 'AT', language: 'en', description: 'Red Bull Racing F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Ferrari F1', url: 'https://news.google.com/rss/search?q=%22Ferrari%22+formula+1&hl=en&gl=GB', sport: 'formula1', country: 'IT', language: 'en', description: 'Ferrari F1 news via Google News', category: 'team_news' },
  { name: 'Google News: McLaren F1', url: 'https://news.google.com/rss/search?q=%22McLaren%22+formula+1&hl=en&gl=GB', sport: 'formula1', country: 'GB', language: 'en', description: 'McLaren F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Mercedes F1', url: 'https://news.google.com/rss/search?q=%22Mercedes%22+formula+1&hl=en&gl=GB', sport: 'formula1', country: 'DE', language: 'en', description: 'Mercedes F1 news via Google News', category: 'team_news' },
  { name: 'Google News: Aston Martin F1', url: 'https://news.google.com/rss/search?q=%22Aston+Martin%22+formula+1&hl=en&gl=GB', sport: 'formula1', country: 'GB', language: 'en', description: 'Aston Martin F1 news via Google News', category: 'team_news' },

  // Cycling — Top Riders & Teams
  { name: 'Google News: Tadej Pogacar', url: 'https://news.google.com/rss/search?q=%22Tadej+Pogacar%22+cycling&hl=en&gl=GB', sport: 'cycling', country: 'SI', language: 'en', description: 'Tadej Pogacar cycling news via Google News', category: 'team_news' },
  { name: 'Google News: Jonas Vingegaard', url: 'https://news.google.com/rss/search?q=%22Jonas+Vingegaard%22+cycling&hl=en&gl=GB', sport: 'cycling', country: 'DK', language: 'en', description: 'Jonas Vingegaard cycling news via Google News', category: 'team_news' },
  { name: 'Google News: Remco Evenepoel', url: 'https://news.google.com/rss/search?q=%22Remco+Evenepoel%22+cycling&hl=en&gl=GB', sport: 'cycling', country: 'BE', language: 'en', description: 'Remco Evenepoel cycling news via Google News', category: 'team_news' },
  { name: 'Google News: Primoz Roglic', url: 'https://news.google.com/rss/search?q=%22Primoz+Roglic%22+cycling&hl=en&gl=GB', sport: 'cycling', country: 'SI', language: 'en', description: 'Primoz Roglic cycling news via Google News', category: 'team_news' },
  { name: 'Google News: UAE Team Emirates', url: 'https://news.google.com/rss/search?q=%22UAE+Team+Emirates%22+cycling&hl=en&gl=GB', sport: 'cycling', country: 'AE', language: 'en', description: 'UAE Team Emirates cycling news via Google News', category: 'team_news' },
  { name: 'Google News: Team Visma', url: 'https://news.google.com/rss/search?q=%22Team+Visma%22+cycling&hl=en&gl=GB', sport: 'cycling', country: 'NL', language: 'en', description: 'Team Visma cycling news via Google News', category: 'team_news' },

  // Swimming — Top Athletes
  { name: 'Google News: Leon Marchand', url: 'https://news.google.com/rss/search?q=%22Leon+Marchand%22+swimming&hl=en&gl=GB', sport: 'swimming', country: 'FR', language: 'en', description: 'Leon Marchand swimming news via Google News', category: 'team_news' },
  { name: 'Google News: Katie Ledecky', url: 'https://news.google.com/rss/search?q=%22Katie+Ledecky%22+swimming&hl=en&gl=US', sport: 'swimming', country: 'US', language: 'en', description: 'Katie Ledecky swimming news via Google News', category: 'team_news' },
  { name: 'Google News: Caeleb Dressel', url: 'https://news.google.com/rss/search?q=%22Caeleb+Dressel%22+swimming&hl=en&gl=US', sport: 'swimming', country: 'US', language: 'en', description: 'Caeleb Dressel swimming news via Google News', category: 'team_news' },
  { name: 'Google News: Adam Peaty', url: 'https://news.google.com/rss/search?q=%22Adam+Peaty%22+swimming&hl=en&gl=GB', sport: 'swimming', country: 'GB', language: 'en', description: 'Adam Peaty swimming news via Google News', category: 'team_news' },

  // Athletics — Top Athletes
  { name: 'Google News: Noah Lyles', url: 'https://news.google.com/rss/search?q=%22Noah+Lyles%22+athletics&hl=en&gl=US', sport: 'athletics', country: 'US', language: 'en', description: 'Noah Lyles athletics news via Google News', category: 'team_news' },
  { name: 'Google News: Mondo Duplantis', url: 'https://news.google.com/rss/search?q=%22Mondo+Duplantis%22+athletics&hl=en&gl=GB', sport: 'athletics', country: 'SE', language: 'en', description: 'Mondo Duplantis athletics news via Google News', category: 'team_news' },
  { name: 'Google News: Sydney McLaughlin', url: 'https://news.google.com/rss/search?q=%22Sydney+McLaughlin%22+athletics&hl=en&gl=US', sport: 'athletics', country: 'US', language: 'en', description: 'Sydney McLaughlin athletics news via Google News', category: 'team_news' },
  { name: 'Google News: Faith Kipyegon', url: 'https://news.google.com/rss/search?q=%22Faith+Kipyegon%22+athletics&hl=en&gl=GB', sport: 'athletics', country: 'KE', language: 'en', description: 'Faith Kipyegon athletics news via Google News', category: 'team_news' },
  { name: 'Google News: Femke Bol', url: 'https://news.google.com/rss/search?q=%22Femke+Bol%22+athletics&hl=en&gl=GB', sport: 'athletics', country: 'NL', language: 'en', description: 'Femke Bol athletics news via Google News', category: 'team_news' },

  // Padel — Top Players
  { name: 'Google News: Alejandro Galan', url: 'https://news.google.com/rss/search?q=%22Alejandro+Galan%22+padel&hl=es&gl=ES', sport: 'padel', country: 'ES', language: 'es', description: 'Alejandro Galan padel news via Google News', category: 'team_news' },
  { name: 'Google News: Arturo Coello', url: 'https://news.google.com/rss/search?q=%22Arturo+Coello%22+padel&hl=es&gl=ES', sport: 'padel', country: 'ES', language: 'es', description: 'Arturo Coello padel news via Google News', category: 'team_news' },
  { name: 'Google News: Ari Sanchez', url: 'https://news.google.com/rss/search?q=%22Ari+Sanchez%22+padel&hl=es&gl=ES', sport: 'padel', country: 'ES', language: 'es', description: 'Ari Sanchez padel news via Google News', category: 'team_news' },
  { name: 'Google News: Gemma Triay', url: 'https://news.google.com/rss/search?q=%22Gemma+Triay%22+padel&hl=es&gl=ES', sport: 'padel', country: 'ES', language: 'es', description: 'Gemma Triay padel news via Google News', category: 'team_news' },
];

const initialReels = [
  // Football — verified embeddable
  { title: 'Los 20 mejores goles de La Liga 2025', videoUrl: 'https://www.youtube.com/embed/tFXgPQqQt-0', thumbnailUrl: '', source: 'La Liga', sport: 'football', durationSeconds: 480, videoType: 'youtube_embed', aspectRatio: '16:9' },
  { title: 'Gol de Zlatan Ibrahimovic (Ajax)', videoUrl: 'https://www.youtube.com/embed/ZgqsaDnsEq8', thumbnailUrl: '', source: 'YouTube', sport: 'football', durationSeconds: 30, videoType: 'youtube_embed', aspectRatio: '16:9' },
  // Basketball — verified
  { title: 'NBA Top 10 jugadas de la noche', videoUrl: 'https://www.youtube.com/embed/fyLrwS0Oet8', thumbnailUrl: '', source: 'NBA', sport: 'basketball', durationSeconds: 240, videoType: 'youtube_embed', aspectRatio: '16:9' },
  // Tennis — verified
  { title: 'Carlos Alcaraz — Los 21 mejores golpes', videoUrl: 'https://www.youtube.com/embed/c9KYbhBExOw', thumbnailUrl: '', source: 'ATP Tour', sport: 'tennis', team: 'Carlos Alcaraz', durationSeconds: 300, videoType: 'youtube_embed', aspectRatio: '16:9' },
  // Formula 1 — verified
  { title: 'Los 30 mejores adelantamientos de la historia de la F1', videoUrl: 'https://www.youtube.com/embed/3yijo-Ws5ag', thumbnailUrl: '', source: 'F1 Official', sport: 'formula1', durationSeconds: 600, videoType: 'youtube_embed', aspectRatio: '16:9' },
  // Swimming — verified
  { title: 'Así entrenan los nadadores olímpicos', videoUrl: 'https://www.youtube.com/embed/yJ_Xtp_NhRs', thumbnailUrl: '', source: 'YouTube', sport: 'swimming', durationSeconds: 60, videoType: 'youtube_embed', aspectRatio: '16:9' },
  // Cycling — verified
  { title: 'Cómo funciona el Tour de Francia', videoUrl: 'https://www.youtube.com/embed/IDd00owMIP4', thumbnailUrl: '', source: 'GCN', sport: 'cycling', durationSeconds: 300, videoType: 'youtube_embed', aspectRatio: '16:9' },
  // Padel — verified
  { title: 'Los mejores puntos de Padel 2025', videoUrl: 'https://www.youtube.com/embed/gFl3ADnFRtc', thumbnailUrl: '', source: 'Premier Padel', sport: 'padel', durationSeconds: 240, videoType: 'youtube_embed', aspectRatio: '16:9' },
  // Athletics — verified
  { title: 'Usain Bolt 9.58 — Récord mundial 100m', videoUrl: 'https://www.youtube.com/embed/3nbjhpcZ9_g', thumbnailUrl: '', source: 'World Athletics', sport: 'athletics', durationSeconds: 45, videoType: 'youtube_embed', aspectRatio: '16:9' },
  { title: 'Atletismo 100 metros planos', videoUrl: 'https://www.youtube.com/embed/KNA7gdXzFD4', thumbnailUrl: '', source: 'YouTube', sport: 'athletics', durationSeconds: 120, videoType: 'youtube_embed', aspectRatio: '16:9' },
  // MP4 direct — always work inline (Pexels free license)
  { title: 'Football training session', videoUrl: 'https://videos.pexels.com/video-files/3191572/3191572-sd_640_360_25fps.mp4', thumbnailUrl: 'https://images.pexels.com/videos/3191572/free-video-3191572.jpg?w=400', source: 'Pexels', sport: 'football', durationSeconds: 15, videoType: 'mp4', aspectRatio: '16:9', publishedAt: new Date() },
  { title: 'Basketball slam dunk', videoUrl: 'https://videos.pexels.com/video-files/4761556/4761556-sd_640_360_25fps.mp4', thumbnailUrl: 'https://images.pexels.com/videos/4761556/free-video-4761556.jpg?w=400', source: 'Pexels', sport: 'basketball', durationSeconds: 12, videoType: 'mp4', aspectRatio: '16:9', publishedAt: new Date() },
  { title: 'Tennis practice rally', videoUrl: 'https://videos.pexels.com/video-files/5067588/5067588-sd_640_360_25fps.mp4', thumbnailUrl: 'https://images.pexels.com/videos/5067588/free-video-5067588.jpg?w=400', source: 'Pexels', sport: 'tennis', durationSeconds: 18, videoType: 'mp4', aspectRatio: '16:9', publishedAt: new Date() },
  { title: 'Swimming freestyle technique', videoUrl: 'https://videos.pexels.com/video-files/4761480/4761480-sd_640_360_25fps.mp4', thumbnailUrl: 'https://images.pexels.com/videos/4761480/free-video-4761480.jpg?w=400', source: 'Pexels', sport: 'swimming', durationSeconds: 10, videoType: 'mp4', aspectRatio: '16:9', publishedAt: new Date() },
  { title: 'Cycling mountain road', videoUrl: 'https://videos.pexels.com/video-files/4889152/4889152-sd_640_360_25fps.mp4', thumbnailUrl: 'https://images.pexels.com/videos/4889152/free-video-4889152.jpg?w=400', source: 'Pexels', sport: 'cycling', durationSeconds: 20, videoType: 'mp4', aspectRatio: '16:9', publishedAt: new Date() },
  { title: 'Running on track', videoUrl: 'https://videos.pexels.com/video-files/3209245/3209245-sd_640_360_25fps.mp4', thumbnailUrl: 'https://images.pexels.com/videos/3209245/free-video-3209245.jpg?w=400', source: 'Pexels', sport: 'athletics', durationSeconds: 14, videoType: 'mp4', aspectRatio: '16:9', publishedAt: new Date() },
];

const initialQuestions = [
  { question: '¿Cuántos jugadores tiene un equipo de fútbol en el campo?', options: ['9', '10', '11', '12'], correctAnswer: 2, sport: 'football', points: 10 },
  { question: '¿Qué equipo ha ganado más Champions League?', options: ['Barcelona', 'Real Madrid', 'AC Milan', 'Bayern Munich'], correctAnswer: 1, sport: 'football', points: 15 },
  { question: '¿En qué país se inventó el fútbol moderno?', options: ['España', 'Brasil', 'Inglaterra', 'Italia'], correctAnswer: 2, sport: 'football', points: 10 },
  { question: '¿Cuánto mide una cancha de baloncesto?', options: ['20 metros', '24 metros', '28 metros', '30 metros'], correctAnswer: 2, sport: 'basketball', points: 15 },
  { question: '¿Cuántos puntos vale un triple en baloncesto?', options: ['1', '2', '3', '4'], correctAnswer: 2, sport: 'basketball', points: 10 },
  { question: '¿En qué superficie se juega Roland Garros?', options: ['Hierba', 'Tierra batida', 'Pista dura', 'Hormigón'], correctAnswer: 1, sport: 'tennis', points: 10 },
  { question: '¿Cuántos sets hay que ganar en un Grand Slam masculino?', options: ['2', '3', '4', '5'], correctAnswer: 1, sport: 'tennis', points: 15 },
  { question: '¿Cuántas vueltas tiene aproximadamente una carrera de F1?', options: ['30-40', '40-50', '50-70', '70-80'], correctAnswer: 2, sport: 'formula1', points: 15 },
  { question: '¿Cuál es el estilo de natación más rápido?', options: ['Espalda', 'Braza', 'Mariposa', 'Crol'], correctAnswer: 3, sport: 'swimming', points: 10 },
  { question: '¿Cuánto mide una piscina olímpica?', options: ['25m', '33m', '50m', '100m'], correctAnswer: 2, sport: 'swimming', points: 10 },
  { question: '¿Cuántas etapas tiene aproximadamente el Tour de Francia?', options: ['15', '18', '21', '25'], correctAnswer: 2, sport: 'cycling', points: 15 },
  { question: '¿De qué país es Carlos Alcaraz?', options: ['Argentina', 'España', 'Italia', 'Francia'], correctAnswer: 1, sport: 'tennis', points: 10 },
  { question: '¿Qué equipo juega en el Santiago Bernabéu?', options: ['Atlético de Madrid', 'Barcelona', 'Real Madrid', 'Sevilla FC'], correctAnswer: 2, sport: 'football', points: 10 },
  { question: '¿Cuánto dura un partido de la NBA?', options: ['40 minutos', '48 minutos', '50 minutos', '60 minutos'], correctAnswer: 1, sport: 'basketball', points: 15 },
  { question: '¿Qué deporte se juega con pala y pelota en una pista cerrada?', options: ['Tenis', 'Squash', 'Pádel', 'Bádminton'], correctAnswer: 2, sport: 'padel', points: 10 },
];

// ---------------------------------------------------------------------------
// Stickers (36 total)
// ---------------------------------------------------------------------------

interface StickerSeed {
  name: string;
  nameKey: string;
  imageUrl: string;
  sport: string;
  team?: string;
  rarity: string;
}

const initialStickers: StickerSeed[] = [
  // ── Sport icon stickers (8, common) ─────────────────────────────────
  { name: 'Football Icon', nameKey: 'sticker.football_icon', imageUrl: '/stickers/football-icon.png', sport: 'football', rarity: 'common' },
  { name: 'Basketball Icon', nameKey: 'sticker.basketball_icon', imageUrl: '/stickers/basketball-icon.png', sport: 'basketball', rarity: 'common' },
  { name: 'Tennis Icon', nameKey: 'sticker.tennis_icon', imageUrl: '/stickers/tennis-icon.png', sport: 'tennis', rarity: 'common' },
  { name: 'Swimming Icon', nameKey: 'sticker.swimming_icon', imageUrl: '/stickers/swimming-icon.png', sport: 'swimming', rarity: 'common' },
  { name: 'Athletics Icon', nameKey: 'sticker.athletics_icon', imageUrl: '/stickers/athletics-icon.png', sport: 'athletics', rarity: 'common' },
  { name: 'Cycling Icon', nameKey: 'sticker.cycling_icon', imageUrl: '/stickers/cycling-icon.png', sport: 'cycling', rarity: 'common' },
  { name: 'Formula 1 Icon', nameKey: 'sticker.formula1_icon', imageUrl: '/stickers/formula1-icon.png', sport: 'formula1', rarity: 'common' },
  { name: 'Padel Icon', nameKey: 'sticker.padel_icon', imageUrl: '/stickers/padel-icon.png', sport: 'padel', rarity: 'common' },

  // ── Sport equipment stickers (8, common) ────────────────────────────
  { name: 'Football', nameKey: 'sticker.football', imageUrl: '/stickers/football-ball.png', sport: 'football', rarity: 'common' },
  { name: 'Basketball', nameKey: 'sticker.basketball', imageUrl: '/stickers/basketball-ball.png', sport: 'basketball', rarity: 'common' },
  { name: 'Tennis Racket', nameKey: 'sticker.tennis_racket', imageUrl: '/stickers/tennis-racket.png', sport: 'tennis', rarity: 'common' },
  { name: 'Swimming Goggles', nameKey: 'sticker.swimming_goggles', imageUrl: '/stickers/swimming-goggles.png', sport: 'swimming', rarity: 'common' },
  { name: 'Running Shoes', nameKey: 'sticker.running_shoes', imageUrl: '/stickers/athletics-shoes.png', sport: 'athletics', rarity: 'common' },
  { name: 'Bicycle', nameKey: 'sticker.bicycle', imageUrl: '/stickers/cycling-bicycle.png', sport: 'cycling', rarity: 'common' },
  { name: 'Racing Helmet', nameKey: 'sticker.racing_helmet', imageUrl: '/stickers/formula1-helmet.png', sport: 'formula1', rarity: 'common' },
  { name: 'Padel Racket', nameKey: 'sticker.padel_racket', imageUrl: '/stickers/padel-racket.png', sport: 'padel', rarity: 'common' },

  // ── Team crest stickers (10, rare) ──────────────────────────────────
  { name: 'Real Madrid Crest', nameKey: 'sticker.real_madrid_crest', imageUrl: '/stickers/football-real_madrid.png', sport: 'football', team: 'Real Madrid', rarity: 'rare' },
  { name: 'Barcelona Crest', nameKey: 'sticker.barcelona_crest', imageUrl: '/stickers/football-barcelona.png', sport: 'football', team: 'Barcelona', rarity: 'rare' },
  { name: 'Atletico Madrid Crest', nameKey: 'sticker.atletico_madrid_crest', imageUrl: '/stickers/football-atletico.png', sport: 'football', team: 'Atlético de Madrid', rarity: 'rare' },
  { name: 'Sevilla Crest', nameKey: 'sticker.sevilla_crest', imageUrl: '/stickers/football-sevilla.png', sport: 'football', team: 'Sevilla FC', rarity: 'rare' },
  { name: 'Athletic Club Crest', nameKey: 'sticker.athletic_club_crest', imageUrl: '/stickers/football-athletic.png', sport: 'football', team: 'Athletic Club', rarity: 'rare' },
  { name: 'Real Sociedad Crest', nameKey: 'sticker.real_sociedad_crest', imageUrl: '/stickers/football-real_sociedad.png', sport: 'football', team: 'Real Sociedad', rarity: 'rare' },
  { name: 'Valencia Crest', nameKey: 'sticker.valencia_crest', imageUrl: '/stickers/football-valencia.png', sport: 'football', team: 'Valencia CF', rarity: 'rare' },
  { name: 'Villarreal Crest', nameKey: 'sticker.villarreal_crest', imageUrl: '/stickers/football-villarreal.png', sport: 'football', team: 'Villarreal', rarity: 'rare' },
  { name: 'Real Betis Crest', nameKey: 'sticker.real_betis_crest', imageUrl: '/stickers/football-betis.png', sport: 'football', team: 'Real Betis', rarity: 'rare' },
  { name: 'Lakers Badge', nameKey: 'sticker.lakers_badge', imageUrl: '/stickers/basketball-lakers.png', sport: 'basketball', team: 'Los Angeles Lakers', rarity: 'rare' },

  // ── Athlete stickers (6, epic) ──────────────────────────────────────
  { name: 'Messi Legend', nameKey: 'sticker.messi_legend', imageUrl: '/stickers/football-messi.png', sport: 'football', team: 'Inter Miami', rarity: 'epic' },
  { name: 'Alcaraz Champion', nameKey: 'sticker.alcaraz_champion', imageUrl: '/stickers/tennis-alcaraz.png', sport: 'tennis', team: 'Carlos Alcaraz', rarity: 'epic' },
  { name: 'Nadal King of Clay', nameKey: 'sticker.nadal_king', imageUrl: '/stickers/tennis-nadal.png', sport: 'tennis', team: 'Rafael Nadal', rarity: 'epic' },
  { name: 'Alonso Racer', nameKey: 'sticker.alonso_racer', imageUrl: '/stickers/formula1-alonso.png', sport: 'formula1', team: 'Fernando Alonso', rarity: 'epic' },
  { name: 'Phelps Aquaman', nameKey: 'sticker.phelps_aquaman', imageUrl: '/stickers/swimming-phelps.png', sport: 'swimming', rarity: 'epic' },
  { name: 'Pogacar Climber', nameKey: 'sticker.pogacar_climber', imageUrl: '/stickers/cycling-pogacar.png', sport: 'cycling', rarity: 'epic' },

  // ── Legendary stickers (4) ──────────────────────────────────────────
  { name: 'Golden Football', nameKey: 'sticker.golden_football', imageUrl: '/stickers/football-golden.png', sport: 'football', rarity: 'legendary' },
  { name: 'Golden Basketball', nameKey: 'sticker.golden_basketball', imageUrl: '/stickers/basketball-golden.png', sport: 'basketball', rarity: 'legendary' },
  { name: 'Golden Tennis', nameKey: 'sticker.golden_tennis', imageUrl: '/stickers/tennis-golden.png', sport: 'tennis', rarity: 'legendary' },
  { name: 'Golden Trophy', nameKey: 'sticker.golden_trophy', imageUrl: '/stickers/trophy-golden.png', sport: 'football', rarity: 'legendary' },
];

// ---------------------------------------------------------------------------
// Achievements (20)
// ---------------------------------------------------------------------------

interface AchievementSeed {
  key: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  threshold: number;
  type: string;
}

const initialAchievements: AchievementSeed[] = [
  // News
  { key: 'first_read', nameKey: 'achievement.first_read', descriptionKey: 'achievement.first_read_desc', icon: '📰', threshold: 1, type: 'news_read' },
  { key: 'news_10', nameKey: 'achievement.news_10', descriptionKey: 'achievement.news_10_desc', icon: '📚', threshold: 10, type: 'news_read' },
  { key: 'news_50', nameKey: 'achievement.news_50', descriptionKey: 'achievement.news_50_desc', icon: '🗞️', threshold: 50, type: 'news_read' },
  { key: 'news_100', nameKey: 'achievement.news_100', descriptionKey: 'achievement.news_100_desc', icon: '🏆', threshold: 100, type: 'news_read' },

  // Reels
  { key: 'first_reel', nameKey: 'achievement.first_reel', descriptionKey: 'achievement.first_reel_desc', icon: '🎬', threshold: 1, type: 'reels_watched' },
  { key: 'reels_20', nameKey: 'achievement.reels_20', descriptionKey: 'achievement.reels_20_desc', icon: '📹', threshold: 20, type: 'reels_watched' },

  // Quiz
  { key: 'first_quiz', nameKey: 'achievement.first_quiz', descriptionKey: 'achievement.first_quiz_desc', icon: '❓', threshold: 1, type: 'quizzes_played' },
  { key: 'quiz_perfect', nameKey: 'achievement.quiz_perfect', descriptionKey: 'achievement.quiz_perfect_desc', icon: '💯', threshold: 1, type: 'quiz_perfect' },
  { key: 'quiz_10_perfect', nameKey: 'achievement.quiz_10_perfect', descriptionKey: 'achievement.quiz_10_perfect_desc', icon: '🧠', threshold: 10, type: 'quiz_perfect' },

  // Streaks
  { key: 'streak_3', nameKey: 'achievement.streak_3', descriptionKey: 'achievement.streak_3_desc', icon: '🔥', threshold: 3, type: 'streak' },
  { key: 'streak_7', nameKey: 'achievement.streak_7', descriptionKey: 'achievement.streak_7_desc', icon: '🔥', threshold: 7, type: 'streak' },
  { key: 'streak_14', nameKey: 'achievement.streak_14', descriptionKey: 'achievement.streak_14_desc', icon: '🔥', threshold: 14, type: 'streak' },
  { key: 'streak_30', nameKey: 'achievement.streak_30', descriptionKey: 'achievement.streak_30_desc', icon: '🌟', threshold: 30, type: 'streak' },

  // Exploration
  { key: 'all_sports', nameKey: 'achievement.all_sports', descriptionKey: 'achievement.all_sports_desc', icon: '🌍', threshold: 5, type: 'all_sports' },

  // Stickers
  { key: 'first_sticker', nameKey: 'achievement.first_sticker', descriptionKey: 'achievement.first_sticker_desc', icon: '🏷️', threshold: 1, type: 'stickers_collected' },
  { key: 'stickers_10', nameKey: 'achievement.stickers_10', descriptionKey: 'achievement.stickers_10_desc', icon: '🎯', threshold: 10, type: 'stickers_collected' },
  { key: 'stickers_25', nameKey: 'achievement.stickers_25', descriptionKey: 'achievement.stickers_25_desc', icon: '💎', threshold: 25, type: 'stickers_collected' },

  // Daily login
  { key: 'daily_login_7', nameKey: 'achievement.daily_login_7', descriptionKey: 'achievement.daily_login_7_desc', icon: '📅', threshold: 7, type: 'daily_login' },

  // Points
  { key: 'points_500', nameKey: 'achievement.points_500', descriptionKey: 'achievement.points_500_desc', icon: '⭐', threshold: 500, type: 'points' },
  { key: 'points_1000', nameKey: 'achievement.points_1000', descriptionKey: 'achievement.points_1000_desc', icon: '🌟', threshold: 1000, type: 'points' },
];

// ---------------------------------------------------------------------------
// Team Stats (15 teams)
// ---------------------------------------------------------------------------

interface TeamStatsSeed {
  teamName: string;
  sport: string;
  leaguePosition: number | null;
  recentResults: Array<{ opponent: string; score: string; result: string; date: string }>;
  topScorer: string | null;
  nextMatch: { opponent: string; date: string; competition: string } | null;
}

const initialTeamStats: TeamStatsSeed[] = [
  {
    teamName: 'Real Madrid',
    sport: 'football',
    leaguePosition: 1,
    recentResults: [
      { opponent: 'Barcelona', score: '2-1', result: 'W', date: '2026-03-15' },
      { opponent: 'Atletico Madrid', score: '1-1', result: 'D', date: '2026-03-08' },
      { opponent: 'Sevilla FC', score: '3-0', result: 'W', date: '2026-03-01' },
      { opponent: 'Valencia CF', score: '2-0', result: 'W', date: '2026-02-22' },
      { opponent: 'Real Betis', score: '1-2', result: 'L', date: '2026-02-15' },
    ],
    topScorer: 'Kylian Mbappe (22 goals)',
    nextMatch: { opponent: 'Athletic Club', date: '2026-03-29', competition: 'La Liga' },
  },
  {
    teamName: 'Barcelona',
    sport: 'football',
    leaguePosition: 2,
    recentResults: [
      { opponent: 'Real Madrid', score: '1-2', result: 'L', date: '2026-03-15' },
      { opponent: 'Villarreal', score: '4-1', result: 'W', date: '2026-03-08' },
      { opponent: 'Real Sociedad', score: '2-0', result: 'W', date: '2026-03-01' },
      { opponent: 'Girona', score: '3-1', result: 'W', date: '2026-02-22' },
      { opponent: 'Celta Vigo', score: '2-2', result: 'D', date: '2026-02-15' },
    ],
    topScorer: 'Lamine Yamal (18 goals)',
    nextMatch: { opponent: 'Mallorca', date: '2026-03-29', competition: 'La Liga' },
  },
  {
    teamName: 'Atletico Madrid',
    sport: 'football',
    leaguePosition: 3,
    recentResults: [
      { opponent: 'Real Madrid', score: '1-1', result: 'D', date: '2026-03-08' },
      { opponent: 'Getafe', score: '2-0', result: 'W', date: '2026-03-01' },
      { opponent: 'Osasuna', score: '1-0', result: 'W', date: '2026-02-22' },
      { opponent: 'Rayo Vallecano', score: '3-1', result: 'W', date: '2026-02-15' },
      { opponent: 'Las Palmas', score: '0-1', result: 'L', date: '2026-02-08' },
    ],
    topScorer: 'Antoine Griezmann (14 goals)',
    nextMatch: { opponent: 'Real Betis', date: '2026-03-29', competition: 'La Liga' },
  },
  {
    teamName: 'Manchester City',
    sport: 'football',
    leaguePosition: 2,
    recentResults: [
      { opponent: 'Arsenal', score: '1-0', result: 'W', date: '2026-03-16' },
      { opponent: 'Liverpool', score: '2-2', result: 'D', date: '2026-03-09' },
      { opponent: 'Chelsea', score: '3-1', result: 'W', date: '2026-03-02' },
      { opponent: 'Tottenham', score: '4-0', result: 'W', date: '2026-02-23' },
      { opponent: 'Newcastle', score: '1-2', result: 'L', date: '2026-02-16' },
    ],
    topScorer: 'Erling Haaland (28 goals)',
    nextMatch: { opponent: 'Aston Villa', date: '2026-03-30', competition: 'Premier League' },
  },
  {
    teamName: 'Liverpool',
    sport: 'football',
    leaguePosition: 1,
    recentResults: [
      { opponent: 'Manchester City', score: '2-2', result: 'D', date: '2026-03-09' },
      { opponent: 'Everton', score: '3-0', result: 'W', date: '2026-03-02' },
      { opponent: 'West Ham', score: '2-1', result: 'W', date: '2026-02-23' },
      { opponent: 'Brighton', score: '1-0', result: 'W', date: '2026-02-16' },
      { opponent: 'Wolves', score: '4-1', result: 'W', date: '2026-02-09' },
    ],
    topScorer: 'Mohamed Salah (24 goals)',
    nextMatch: { opponent: 'Crystal Palace', date: '2026-03-30', competition: 'Premier League' },
  },
  {
    teamName: 'Bayern Munich',
    sport: 'football',
    leaguePosition: 1,
    recentResults: [
      { opponent: 'Borussia Dortmund', score: '3-1', result: 'W', date: '2026-03-15' },
      { opponent: 'RB Leipzig', score: '2-0', result: 'W', date: '2026-03-08' },
      { opponent: 'Bayer Leverkusen', score: '1-1', result: 'D', date: '2026-03-01' },
      { opponent: 'Wolfsburg', score: '4-0', result: 'W', date: '2026-02-22' },
      { opponent: 'Freiburg', score: '2-1', result: 'W', date: '2026-02-15' },
    ],
    topScorer: 'Harry Kane (30 goals)',
    nextMatch: { opponent: 'Stuttgart', date: '2026-03-29', competition: 'Bundesliga' },
  },
  {
    teamName: 'PSG',
    sport: 'football',
    leaguePosition: 1,
    recentResults: [
      { opponent: 'Marseille', score: '2-0', result: 'W', date: '2026-03-16' },
      { opponent: 'Lyon', score: '3-2', result: 'W', date: '2026-03-09' },
      { opponent: 'Monaco', score: '1-1', result: 'D', date: '2026-03-02' },
      { opponent: 'Lille', score: '2-0', result: 'W', date: '2026-02-23' },
      { opponent: 'Nice', score: '4-1', result: 'W', date: '2026-02-16' },
    ],
    topScorer: 'Ousmane Dembele (16 goals)',
    nextMatch: { opponent: 'Rennes', date: '2026-03-30', competition: 'Ligue 1' },
  },
  {
    teamName: 'Juventus',
    sport: 'football',
    leaguePosition: 3,
    recentResults: [
      { opponent: 'AC Milan', score: '1-0', result: 'W', date: '2026-03-15' },
      { opponent: 'Inter Milan', score: '0-2', result: 'L', date: '2026-03-08' },
      { opponent: 'Roma', score: '2-1', result: 'W', date: '2026-03-01' },
      { opponent: 'Napoli', score: '1-1', result: 'D', date: '2026-02-22' },
      { opponent: 'Lazio', score: '3-0', result: 'W', date: '2026-02-15' },
    ],
    topScorer: 'Dusan Vlahovic (15 goals)',
    nextMatch: { opponent: 'Fiorentina', date: '2026-03-29', competition: 'Serie A' },
  },
  {
    teamName: 'Sevilla FC',
    sport: 'football',
    leaguePosition: 6,
    recentResults: [
      { opponent: 'Real Madrid', score: '0-3', result: 'L', date: '2026-03-01' },
      { opponent: 'Valencia CF', score: '2-1', result: 'W', date: '2026-03-08' },
      { opponent: 'Osasuna', score: '1-1', result: 'D', date: '2026-03-15' },
      { opponent: 'Real Betis', score: '2-0', result: 'W', date: '2026-02-22' },
      { opponent: 'Atletico Madrid', score: '1-2', result: 'L', date: '2026-02-15' },
    ],
    topScorer: 'Isaac Romero (10 goals)',
    nextMatch: { opponent: 'Barcelona', date: '2026-03-29', competition: 'La Liga' },
  },
  {
    teamName: 'Los Angeles Lakers',
    sport: 'basketball',
    leaguePosition: 5,
    recentResults: [
      { opponent: 'Golden State Warriors', score: '118-112', result: 'W', date: '2026-03-20' },
      { opponent: 'Boston Celtics', score: '105-110', result: 'L', date: '2026-03-18' },
      { opponent: 'Denver Nuggets', score: '121-115', result: 'W', date: '2026-03-16' },
      { opponent: 'Phoenix Suns', score: '108-102', result: 'W', date: '2026-03-14' },
      { opponent: 'Dallas Mavericks', score: '99-104', result: 'L', date: '2026-03-12' },
    ],
    topScorer: 'LeBron James (25.4 ppg)',
    nextMatch: { opponent: 'LA Clippers', date: '2026-03-28', competition: 'NBA' },
  },
  {
    teamName: 'Golden State Warriors',
    sport: 'basketball',
    leaguePosition: 7,
    recentResults: [
      { opponent: 'Los Angeles Lakers', score: '112-118', result: 'L', date: '2026-03-20' },
      { opponent: 'Sacramento Kings', score: '125-119', result: 'W', date: '2026-03-18' },
      { opponent: 'Milwaukee Bucks', score: '110-108', result: 'W', date: '2026-03-16' },
      { opponent: 'Miami Heat', score: '105-100', result: 'W', date: '2026-03-14' },
      { opponent: 'Oklahoma City Thunder', score: '98-115', result: 'L', date: '2026-03-12' },
    ],
    topScorer: 'Stephen Curry (27.1 ppg)',
    nextMatch: { opponent: 'Portland Trail Blazers', date: '2026-03-28', competition: 'NBA' },
  },
  {
    teamName: 'Carlos Alcaraz',
    sport: 'tennis',
    leaguePosition: 1,
    recentResults: [
      { opponent: 'Novak Djokovic', score: '6-3, 7-5', result: 'W', date: '2026-03-17' },
      { opponent: 'Jannik Sinner', score: '6-4, 3-6, 6-2', result: 'W', date: '2026-03-14' },
      { opponent: 'Daniil Medvedev', score: '7-6, 6-4', result: 'W', date: '2026-03-10' },
      { opponent: 'Alexander Zverev', score: '4-6, 6-3, 7-5', result: 'W', date: '2026-03-07' },
      { opponent: 'Stefanos Tsitsipas', score: '6-2, 6-3', result: 'W', date: '2026-03-04' },
    ],
    topScorer: null,
    nextMatch: { opponent: 'Jannik Sinner', date: '2026-03-30', competition: 'Miami Open Final' },
  },
  {
    teamName: 'Rafael Nadal',
    sport: 'tennis',
    leaguePosition: 8,
    recentResults: [
      { opponent: 'Casper Ruud', score: '6-4, 6-3', result: 'W', date: '2026-03-12' },
      { opponent: 'Holger Rune', score: '3-6, 6-4, 6-7', result: 'L', date: '2026-03-08' },
      { opponent: 'Taylor Fritz', score: '7-5, 6-4', result: 'W', date: '2026-03-05' },
      { opponent: 'Felix Auger-Aliassime', score: '6-3, 6-2', result: 'W', date: '2026-03-02' },
      { opponent: 'Andrey Rublev', score: '4-6, 7-6, 3-6', result: 'L', date: '2026-02-27' },
    ],
    topScorer: null,
    nextMatch: { opponent: 'Cameron Norrie', date: '2026-03-29', competition: 'Miami Open R32' },
  },
  {
    teamName: 'Red Bull Racing',
    sport: 'formula1',
    leaguePosition: 1,
    recentResults: [
      { opponent: 'Australian GP', score: 'P1', result: 'W', date: '2026-03-22' },
      { opponent: 'Saudi Arabian GP', score: 'P2', result: 'D', date: '2026-03-15' },
      { opponent: 'Bahrain GP', score: 'P1', result: 'W', date: '2026-03-08' },
      { opponent: 'Pre-season Testing', score: 'Fastest', result: 'W', date: '2026-02-28' },
      { opponent: 'Abu Dhabi GP 2025', score: 'P1', result: 'W', date: '2025-12-07' },
    ],
    topScorer: 'Max Verstappen (63 pts)',
    nextMatch: { opponent: 'Japanese GP', date: '2026-04-05', competition: 'Formula 1 World Championship' },
  },
  {
    teamName: 'Scuderia Ferrari',
    sport: 'formula1',
    leaguePosition: 2,
    recentResults: [
      { opponent: 'Australian GP', score: 'P2', result: 'D', date: '2026-03-22' },
      { opponent: 'Saudi Arabian GP', score: 'P1', result: 'W', date: '2026-03-15' },
      { opponent: 'Bahrain GP', score: 'P3', result: 'D', date: '2026-03-08' },
      { opponent: 'Pre-season Testing', score: '2nd Fastest', result: 'D', date: '2026-02-28' },
      { opponent: 'Abu Dhabi GP 2025', score: 'P2', result: 'D', date: '2025-12-07' },
    ],
    topScorer: 'Charles Leclerc (48 pts)',
    nextMatch: { opponent: 'Japanese GP', date: '2026-04-05', competition: 'Formula 1 World Championship' },
  },
  {
    teamName: 'Movistar Team',
    sport: 'cycling',
    leaguePosition: 8,
    recentResults: [
      { opponent: 'Paris-Nice', score: 'Stage 4 Win', result: 'W', date: '2026-03-13' },
      { opponent: 'Tirreno-Adriatico', score: 'GC 5th', result: 'D', date: '2026-03-10' },
      { opponent: 'Strade Bianche', score: '12th', result: 'D', date: '2026-03-01' },
      { opponent: 'UAE Tour', score: 'GC 3rd', result: 'D', date: '2026-02-25' },
      { opponent: 'Volta a la Comunitat Valenciana', score: 'GC 1st', result: 'W', date: '2026-02-09' },
    ],
    topScorer: 'Enric Mas (team leader)',
    nextMatch: { opponent: 'Volta a Catalunya', date: '2026-03-31', competition: 'UCI WorldTour' },
  },
];

async function main() {
  console.log('Seeding RSS sources...');
  for (const source of initialSources) {
    await prisma.rssSource.upsert({
      where: { url: source.url },
      update: {
        name: source.name,
        sport: source.sport,
        country: source.country ?? 'ES',
        language: source.language ?? 'es',
        logoUrl: source.logoUrl ?? null,
        description: source.description ?? '',
        category: source.category ?? 'general',
        // Do NOT overwrite active or lastSyncedAt on update
      },
      create: {
        name: source.name,
        url: source.url,
        sport: source.sport,
        country: source.country ?? 'ES',
        language: source.language ?? 'es',
        logoUrl: source.logoUrl ?? null,
        description: source.description ?? '',
        category: source.category ?? 'general',
        isCustom: false,
      },
    });
    console.log(`  + ${source.name}`);
  }

  console.log('\nSeeding reels...');
  for (const reel of initialReels) {
    const existing = await prisma.reel.findFirst({ where: { title: reel.title } });
    if (!existing) {
      await prisma.reel.create({ data: reel });
      console.log(`  + ${reel.title}`);
    }
  }

  console.log('\nSeeding quiz questions...');
  for (const q of initialQuestions) {
    const existing = await prisma.quizQuestion.findFirst({ where: { question: q.question } });
    if (!existing) {
      await prisma.quizQuestion.create({
        data: { ...q, options: q.options },
      });
      console.log(`  + ${q.question.substring(0, 50)}...`);
    }
  }

  console.log('\nSeeding stickers...');
  for (const sticker of initialStickers) {
    const existing = await prisma.sticker.findFirst({ where: { name: sticker.name } });
    if (!existing) {
      await prisma.sticker.create({ data: sticker });
      console.log(`  + ${sticker.name} (${sticker.rarity})`);
    }
  }
  console.log(`  Total stickers: ${await prisma.sticker.count()}`);

  console.log('\nSeeding achievements...');
  for (const achievement of initialAchievements) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {
        nameKey: achievement.nameKey,
        descriptionKey: achievement.descriptionKey,
        icon: achievement.icon,
        threshold: achievement.threshold,
        type: achievement.type,
      },
      create: achievement,
    });
    console.log(`  + ${achievement.key}`);
  }
  console.log(`  Total achievements: ${await prisma.achievement.count()}`);

  console.log('\nSeeding team stats...');
  for (const ts of initialTeamStats) {
    await prisma.teamStats.upsert({
      where: { teamName: ts.teamName },
      update: {
        sport: ts.sport,
        leaguePosition: ts.leaguePosition,
        recentResults: ts.recentResults,
        topScorer: ts.topScorer,
        nextMatch: ts.nextMatch ?? undefined,
      },
      create: {
        teamName: ts.teamName,
        sport: ts.sport,
        leaguePosition: ts.leaguePosition,
        recentResults: ts.recentResults,
        topScorer: ts.topScorer,
        nextMatch: ts.nextMatch ?? undefined,
      },
    });
    console.log(`  + ${ts.teamName} (${ts.sport})`);
  }
  console.log(`  Total team stats: ${await prisma.teamStats.count()}`);

  console.log('\nUpdating existing reels with videoType and aspectRatio...');
  await prisma.reel.updateMany({
    where: { videoType: null },
    data: { videoType: 'youtube_embed', aspectRatio: '16:9' },
  });
  console.log('  Done.');

  console.log('\nSeeding video sources...');
  for (const vs of initialVideoSources) {
    await prisma.videoSource.upsert({
      where: { feedUrl: vs.feedUrl },
      update: {
        name: vs.name,
        platform: vs.platform,
        sport: vs.sport,
        channelId: vs.channelId ?? null,
        playlistId: vs.playlistId ?? null,
      },
      create: {
        name: vs.name,
        platform: vs.platform,
        feedUrl: vs.feedUrl,
        channelId: vs.channelId ?? null,
        playlistId: vs.playlistId ?? null,
        sport: vs.sport,
        isCustom: false,
      },
    });
    console.log(`  + ${vs.name} (${vs.sport})`);
  }
  console.log(`  Total video sources: ${await prisma.videoSource.count()}`);

  console.log('\nSeed completed.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
