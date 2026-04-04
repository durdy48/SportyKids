-- SportyKids Production Seed
-- Run this in the Neon SQL Editor

-- ============================================================
-- RSS SOURCES
-- ============================================================

INSERT INTO "RssSource" (id, name, url, sport, active, country, language, "logoUrl", description, category, "isCustom", "addedBy", "lastSyncedAt", "createdAt", "updatedAt")
VALUES
  -- Football (Spain)
  (gen_random_uuid(), 'Marca - Football', 'https://feeds.marca.com/rss/portada.xml', 'football', true, 'ES', 'es', NULL, 'Marca — leading Spanish sports newspaper', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'AS - Football', 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/', 'football', true, 'ES', 'es', NULL, 'Diario AS — football section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Mundo Deportivo - Football', 'https://www.mundodeportivo.com/rss/futbol', 'football', true, 'ES', 'es', NULL, 'Mundo Deportivo — Catalan sports daily', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Sport - Football', 'https://www.sport.es/es/rss/futbol/rss.xml', 'football', true, 'ES', 'es', NULL, 'Diario Sport — Barcelona-focused football', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Marca - La Liga', 'https://feeds.marca.com/rss/futbol/liga-santander.xml', 'football', true, 'ES', 'es', NULL, 'Marca — La Liga coverage', 'league', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Marca - Champions League', 'https://feeds.marca.com/rss/futbol/champions-league.xml', 'football', true, 'ES', 'es', NULL, 'Marca — Champions League coverage', 'league', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'El País - Deportes', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada/', 'football', true, 'ES', 'es', NULL, 'El País — sección deportes del diario generalista', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'El Mundo - Deportes', 'https://www.elmundo.es/rss/deportes.xml', 'football', true, 'ES', 'es', NULL, 'El Mundo — sección deportes', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Diario de Sevilla - Deportes', 'https://www.diariodesevilla.es/rss/deportes/', 'football', true, 'ES', 'es', NULL, 'Diario de Sevilla — sección deportes', 'general', false, NULL, NULL, NOW(), NOW()),

  -- Football (International)
  (gen_random_uuid(), 'BBC Sport - Football', 'https://feeds.bbci.co.uk/sport/football/rss.xml', 'football', true, 'GB', 'en', NULL, 'BBC Sport football news', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Sky Sports - Football', 'https://www.skysports.com/rss/12040', 'football', true, 'GB', 'en', NULL, 'Sky Sports — Premier League and more', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'ESPN - Football', 'https://www.espn.com/espn/rss/soccer/news', 'football', true, 'US', 'en', NULL, 'ESPN soccer/football coverage', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Goal.com', 'https://www.goal.com/feeds/en/news', 'football', true, 'GB', 'en', NULL, 'Goal.com — global football news', 'general', false, NULL, NULL, NOW(), NOW()),

  -- Basketball
  (gen_random_uuid(), 'AS - Basketball', 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/baloncesto/portada/', 'basketball', true, 'ES', 'es', NULL, 'Diario AS — basketball section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Marca - Basketball', 'https://feeds.marca.com/rss/baloncesto.xml', 'basketball', true, 'ES', 'es', NULL, 'Marca — basketball coverage', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Mundo Deportivo - Basketball', 'https://www.mundodeportivo.com/rss/baloncesto', 'basketball', true, 'ES', 'es', NULL, 'Mundo Deportivo — basketball section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'BBC Sport - Basketball', 'https://feeds.bbci.co.uk/sport/basketball/rss.xml', 'basketball', true, 'GB', 'en', NULL, 'BBC Sport basketball news', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'ESPN - NBA', 'https://www.espn.com/espn/rss/nba/news', 'basketball', true, 'US', 'en', NULL, 'ESPN NBA coverage', 'league', false, NULL, NULL, NOW(), NOW()),

  -- Tennis
  (gen_random_uuid(), 'Marca - Tennis', 'https://feeds.marca.com/rss/tenis.xml', 'tennis', true, 'ES', 'es', NULL, 'Marca — tennis section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'AS - Tennis', 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/tenis/portada/', 'tennis', true, 'ES', 'es', NULL, 'Diario AS — tennis section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Mundo Deportivo - Tennis', 'https://www.mundodeportivo.com/rss/tenis', 'tennis', true, 'ES', 'es', NULL, 'Mundo Deportivo — tennis section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'BBC Sport - Tennis', 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', 'tennis', true, 'GB', 'en', NULL, 'BBC Sport tennis news', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'ESPN - Tennis', 'https://www.espn.com/espn/rss/tennis/news', 'tennis', true, 'US', 'en', NULL, 'ESPN tennis coverage', 'general', false, NULL, NULL, NOW(), NOW()),

  -- Swimming
  (gen_random_uuid(), 'SwimSwam', 'https://swimswam.com/feed/', 'swimming', true, 'US', 'en', NULL, 'SwimSwam — competitive swimming news', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Marca - Swimming', 'https://feeds.marca.com/rss/natacion.xml', 'swimming', true, 'ES', 'es', NULL, 'Marca — swimming section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Swimming World Magazine', 'https://www.swimmingworldmagazine.com/news/feed/', 'swimming', true, 'US', 'en', NULL, 'Swimming World Magazine news', 'general', false, NULL, NULL, NOW(), NOW()),

  -- Athletics
  (gen_random_uuid(), 'Marca - Athletics', 'https://feeds.marca.com/rss/atletismo.xml', 'athletics', true, 'ES', 'es', NULL, 'Marca — athletics section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'BBC Sport - Athletics', 'https://feeds.bbci.co.uk/sport/athletics/rss.xml', 'athletics', true, 'GB', 'en', NULL, 'BBC Sport athletics news', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'World Athletics News', 'https://worldathletics.org/rss/news', 'athletics', true, 'MC', 'en', NULL, 'Official World Athletics news feed', 'official', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'LetsRun', 'https://www.letsrun.com/feed/', 'athletics', true, 'US', 'en', NULL, 'LetsRun — running and track & field', 'general', false, NULL, NULL, NOW(), NOW()),

  -- Cycling
  (gen_random_uuid(), 'Marca - Cycling', 'https://feeds.marca.com/rss/ciclismo.xml', 'cycling', true, 'ES', 'es', NULL, 'Marca — cycling section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'AS - Cycling', 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/ciclismo/portada/', 'cycling', true, 'ES', 'es', NULL, 'Diario AS — cycling section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'CyclingNews', 'https://www.cyclingnews.com/rss', 'cycling', true, 'GB', 'en', NULL, 'CyclingNews — professional road cycling', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'VeloNews', 'https://www.velonews.com/feed/', 'cycling', true, 'US', 'en', NULL, 'VeloNews — American cycling journal', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'BBC Sport - Cycling', 'https://feeds.bbci.co.uk/sport/cycling/rss.xml', 'cycling', true, 'GB', 'en', NULL, 'BBC Sport cycling news', 'general', false, NULL, NULL, NOW(), NOW()),

  -- Formula 1
  (gen_random_uuid(), 'Marca - Formula 1', 'https://feeds.marca.com/rss/motor/formula1.xml', 'formula1', true, 'ES', 'es', NULL, 'Marca — Formula 1 coverage', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'AS - Formula 1', 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/motor/formula-1/portada/', 'formula1', true, 'ES', 'es', NULL, 'Diario AS — F1 section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Mundo Deportivo - Formula 1', 'https://www.mundodeportivo.com/rss/motor/f1', 'formula1', true, 'ES', 'es', NULL, 'Mundo Deportivo — F1 section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'BBC Sport - Formula 1', 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', 'formula1', true, 'GB', 'en', NULL, 'BBC Sport F1 news', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'ESPN - F1', 'https://www.espn.com/espn/rss/f1/news', 'formula1', true, 'US', 'en', NULL, 'ESPN F1 coverage', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Autosport', 'https://www.autosport.com/rss/feed/f1', 'formula1', true, 'GB', 'en', NULL, 'Autosport — F1 and motorsport', 'general', false, NULL, NULL, NOW(), NOW()),

  -- Padel
  (gen_random_uuid(), 'Marca - Padel', 'https://feeds.marca.com/rss/padel.xml', 'padel', true, 'ES', 'es', NULL, 'Marca — padel section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Mundo Deportivo - Padel', 'https://www.mundodeportivo.com/rss/padel', 'padel', true, 'ES', 'es', NULL, 'Mundo Deportivo — padel section', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'PadelSpain', 'https://padelspain.net/feed/', 'padel', true, 'ES', 'es', NULL, 'PadelSpain — dedicated padel news', 'general', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'PadelFIP', 'https://www.padelfip.com/feed/', 'padel', true, 'ES', 'en', NULL, 'International Padel Federation news', 'official', false, NULL, NULL, NOW(), NOW()),

  -- Google News RSS (Spanish outlets without native RSS)
  (gen_random_uuid(), 'Google News: Estadio Deportivo - Football', 'https://news.google.com/rss/search?q=site:estadiodeportivo.com+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Estadio Deportivo football coverage via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Estadio Deportivo - Basketball', 'https://news.google.com/rss/search?q=site:estadiodeportivo.com+baloncesto&hl=es&gl=ES', 'basketball', true, 'ES', 'es', NULL, 'Estadio Deportivo basketball coverage via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Estadio Deportivo - General', 'https://news.google.com/rss/search?q=site:estadiodeportivo.com+deportes&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Estadio Deportivo general sports via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Mucho Deporte - Football', 'https://news.google.com/rss/search?q=site:muchodeporte.com+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Mucho Deporte football coverage via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Mucho Deporte - General', 'https://news.google.com/rss/search?q=site:muchodeporte.com+deportes&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Mucho Deporte general sports via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: El Desmarque - Football', 'https://news.google.com/rss/search?q=site:eldesmarque.com+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'El Desmarque football coverage via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: El Desmarque - Basketball', 'https://news.google.com/rss/search?q=site:eldesmarque.com+baloncesto&hl=es&gl=ES', 'basketball', true, 'ES', 'es', NULL, 'El Desmarque basketball coverage via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: El Desmarque - General', 'https://news.google.com/rss/search?q=site:eldesmarque.com+deportes&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'El Desmarque general sports via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: El Correo de Andalucia - Football', 'https://news.google.com/rss/search?q=site:elcorreoweb.es+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'El Correo de Andalucia football coverage via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: El Correo de Andalucia - General', 'https://news.google.com/rss/search?q=site:elcorreoweb.es+deportes&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'El Correo de Andalucia general sports via Google News RSS', 'google_news', false, NULL, NULL, NOW(), NOW()),

  -- Team/Athlete news via Google News RSS
  -- Football — La Liga (Spain)
  (gen_random_uuid(), 'Google News: Real Madrid', 'https://news.google.com/rss/search?q=%22Real+Madrid%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Real Madrid news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: FC Barcelona', 'https://news.google.com/rss/search?q=%22FC+Barcelona%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'FC Barcelona news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Atletico de Madrid', 'https://news.google.com/rss/search?q=%22Atletico+de+Madrid%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Atletico de Madrid news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Sevilla FC', 'https://news.google.com/rss/search?q=%22Sevilla+FC%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Sevilla FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Real Betis', 'https://news.google.com/rss/search?q=%22Real+Betis%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Real Betis news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Athletic Club', 'https://news.google.com/rss/search?q=%22Athletic+Club%22+Bilbao+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Athletic Club news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Real Sociedad', 'https://news.google.com/rss/search?q=%22Real+Sociedad%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Real Sociedad news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Valencia CF', 'https://news.google.com/rss/search?q=%22Valencia+CF%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Valencia CF news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Villarreal', 'https://news.google.com/rss/search?q=%22Villarreal+CF%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Villarreal news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Girona FC', 'https://news.google.com/rss/search?q=%22Girona+FC%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Girona FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Celta de Vigo', 'https://news.google.com/rss/search?q=%22Celta+de+Vigo%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Celta de Vigo news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Osasuna', 'https://news.google.com/rss/search?q=%22Osasuna%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Osasuna news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: RCD Mallorca', 'https://news.google.com/rss/search?q=%22RCD+Mallorca%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'RCD Mallorca news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Getafe CF', 'https://news.google.com/rss/search?q=%22Getafe+CF%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Getafe CF news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Rayo Vallecano', 'https://news.google.com/rss/search?q=%22Rayo+Vallecano%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Rayo Vallecano news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Las Palmas', 'https://news.google.com/rss/search?q=%22UD+Las+Palmas%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'UD Las Palmas news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Alaves', 'https://news.google.com/rss/search?q=%22Deportivo+Alaves%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Deportivo Alaves news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Espanyol', 'https://news.google.com/rss/search?q=%22RCD+Espanyol%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'RCD Espanyol news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Leganes', 'https://news.google.com/rss/search?q=%22CD+Leganes%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'CD Leganes news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Real Valladolid', 'https://news.google.com/rss/search?q=%22Real+Valladolid%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Real Valladolid news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Football — Premier League (England)
  (gen_random_uuid(), 'Google News: Manchester City', 'https://news.google.com/rss/search?q=%22Manchester+City%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Manchester City news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Liverpool FC', 'https://news.google.com/rss/search?q=%22Liverpool+FC%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Liverpool FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Arsenal FC', 'https://news.google.com/rss/search?q=%22Arsenal+FC%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Arsenal FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Chelsea FC', 'https://news.google.com/rss/search?q=%22Chelsea+FC%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Chelsea FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Manchester United', 'https://news.google.com/rss/search?q=%22Manchester+United%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Manchester United news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Tottenham', 'https://news.google.com/rss/search?q=%22Tottenham+Hotspur%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Tottenham Hotspur news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Newcastle United', 'https://news.google.com/rss/search?q=%22Newcastle+United%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Newcastle United news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Aston Villa', 'https://news.google.com/rss/search?q=%22Aston+Villa%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Aston Villa news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Brighton', 'https://news.google.com/rss/search?q=%22Brighton+Hove+Albion%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Brighton & Hove Albion news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: West Ham', 'https://news.google.com/rss/search?q=%22West+Ham+United%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'West Ham United news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Nottingham Forest', 'https://news.google.com/rss/search?q=%22Nottingham+Forest%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Nottingham Forest news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Bournemouth', 'https://news.google.com/rss/search?q=%22AFC+Bournemouth%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'AFC Bournemouth news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Fulham', 'https://news.google.com/rss/search?q=%22Fulham+FC%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Fulham FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Crystal Palace', 'https://news.google.com/rss/search?q=%22Crystal+Palace%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Crystal Palace news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Brentford', 'https://news.google.com/rss/search?q=%22Brentford+FC%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Brentford FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Everton', 'https://news.google.com/rss/search?q=%22Everton+FC%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Everton FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Wolverhampton', 'https://news.google.com/rss/search?q=%22Wolverhampton+Wanderers%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Wolverhampton Wanderers news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Leicester City', 'https://news.google.com/rss/search?q=%22Leicester+City%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Leicester City news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Ipswich Town', 'https://news.google.com/rss/search?q=%22Ipswich+Town%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Ipswich Town news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Southampton', 'https://news.google.com/rss/search?q=%22Southampton+FC%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'Southampton FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Football — Serie A (Italy)
  (gen_random_uuid(), 'Google News: Inter Milan', 'https://news.google.com/rss/search?q=%22Inter+Milan%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'Inter Milan news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: AC Milan', 'https://news.google.com/rss/search?q=%22AC+Milan%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'AC Milan news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Juventus', 'https://news.google.com/rss/search?q=%22Juventus%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'Juventus news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Napoli', 'https://news.google.com/rss/search?q=%22SSC+Napoli%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'SSC Napoli news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Atalanta', 'https://news.google.com/rss/search?q=%22Atalanta%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'Atalanta news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: AS Roma', 'https://news.google.com/rss/search?q=%22AS+Roma%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'AS Roma news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Lazio', 'https://news.google.com/rss/search?q=%22SS+Lazio%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'SS Lazio news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Fiorentina', 'https://news.google.com/rss/search?q=%22Fiorentina%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'Fiorentina news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Bologna', 'https://news.google.com/rss/search?q=%22Bologna+FC%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'Bologna FC news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Football — Bundesliga (Germany)
  (gen_random_uuid(), 'Google News: Bayern Munich', 'https://news.google.com/rss/search?q=%22Bayern+Munich%22+football&hl=en&gl=GB', 'football', true, 'DE', 'en', NULL, 'Bayern Munich news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Borussia Dortmund', 'https://news.google.com/rss/search?q=%22Borussia+Dortmund%22+football&hl=en&gl=GB', 'football', true, 'DE', 'en', NULL, 'Borussia Dortmund news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Bayer Leverkusen', 'https://news.google.com/rss/search?q=%22Bayer+Leverkusen%22+football&hl=en&gl=GB', 'football', true, 'DE', 'en', NULL, 'Bayer Leverkusen news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: RB Leipzig', 'https://news.google.com/rss/search?q=%22RB+Leipzig%22+football&hl=en&gl=GB', 'football', true, 'DE', 'en', NULL, 'RB Leipzig news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: VfB Stuttgart', 'https://news.google.com/rss/search?q=%22VfB+Stuttgart%22+football&hl=en&gl=GB', 'football', true, 'DE', 'en', NULL, 'VfB Stuttgart news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Football — Ligue 1 (France)
  (gen_random_uuid(), 'Google News: PSG', 'https://news.google.com/rss/search?q=%22Paris+Saint+Germain%22+football&hl=en&gl=GB', 'football', true, 'FR', 'en', NULL, 'Paris Saint-Germain news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Marseille', 'https://news.google.com/rss/search?q=%22Olympique+Marseille%22+football&hl=en&gl=GB', 'football', true, 'FR', 'en', NULL, 'Olympique de Marseille news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Monaco', 'https://news.google.com/rss/search?q=%22AS+Monaco%22+football&hl=en&gl=GB', 'football', true, 'FR', 'en', NULL, 'AS Monaco news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Lyon', 'https://news.google.com/rss/search?q=%22Olympique+Lyon%22+football&hl=en&gl=GB', 'football', true, 'FR', 'en', NULL, 'Olympique Lyonnais news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Lille', 'https://news.google.com/rss/search?q=%22LOSC+Lille%22+football&hl=en&gl=GB', 'football', true, 'FR', 'en', NULL, 'LOSC Lille news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Football — National Teams
  (gen_random_uuid(), 'Google News: Seleccion Espanola', 'https://news.google.com/rss/search?q=%22seleccion+espanola%22+futbol&hl=es&gl=ES', 'football', true, 'ES', 'es', NULL, 'Spain National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Argentina National Team', 'https://news.google.com/rss/search?q=%22seleccion+argentina%22+futbol&hl=es&gl=ES', 'football', true, 'AR', 'es', NULL, 'Argentina National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Brazil National Team', 'https://news.google.com/rss/search?q=%22Brazil+national+team%22+football&hl=en&gl=GB', 'football', true, 'BR', 'en', NULL, 'Brazil National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: France National Team', 'https://news.google.com/rss/search?q=%22France+national+team%22+football&hl=en&gl=GB', 'football', true, 'FR', 'en', NULL, 'France National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Germany National Team', 'https://news.google.com/rss/search?q=%22Germany+national+team%22+football&hl=en&gl=GB', 'football', true, 'DE', 'en', NULL, 'Germany National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: England National Team', 'https://news.google.com/rss/search?q=%22England+national+team%22+football&hl=en&gl=GB', 'football', true, 'GB', 'en', NULL, 'England National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Portugal National Team', 'https://news.google.com/rss/search?q=%22Portugal+national+team%22+football&hl=en&gl=GB', 'football', true, 'PT', 'en', NULL, 'Portugal National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Italy National Team', 'https://news.google.com/rss/search?q=%22Italy+national+team%22+football&hl=en&gl=GB', 'football', true, 'IT', 'en', NULL, 'Italy National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Mexico National Team', 'https://news.google.com/rss/search?q=%22seleccion+mexicana%22+futbol&hl=es&gl=ES', 'football', true, 'MX', 'es', NULL, 'Mexico National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: USA National Team', 'https://news.google.com/rss/search?q=%22USMNT%22+soccer&hl=en&gl=US', 'football', true, 'US', 'en', NULL, 'USA National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Colombia National Team', 'https://news.google.com/rss/search?q=%22seleccion+Colombia%22+futbol&hl=es&gl=ES', 'football', true, 'CO', 'es', NULL, 'Colombia National Team news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Basketball — NBA
  (gen_random_uuid(), 'Google News: LA Lakers', 'https://news.google.com/rss/search?q=%22Los+Angeles+Lakers%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'LA Lakers news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Boston Celtics', 'https://news.google.com/rss/search?q=%22Boston+Celtics%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'Boston Celtics news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Golden State Warriors', 'https://news.google.com/rss/search?q=%22Golden+State+Warriors%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'Golden State Warriors news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Milwaukee Bucks', 'https://news.google.com/rss/search?q=%22Milwaukee+Bucks%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'Milwaukee Bucks news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Denver Nuggets', 'https://news.google.com/rss/search?q=%22Denver+Nuggets%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'Denver Nuggets news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Philadelphia 76ers', 'https://news.google.com/rss/search?q=%22Philadelphia+76ers%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'Philadelphia 76ers news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Miami Heat', 'https://news.google.com/rss/search?q=%22Miami+Heat%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'Miami Heat news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Dallas Mavericks', 'https://news.google.com/rss/search?q=%22Dallas+Mavericks%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'Dallas Mavericks news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Phoenix Suns', 'https://news.google.com/rss/search?q=%22Phoenix+Suns%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'Phoenix Suns news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: New York Knicks', 'https://news.google.com/rss/search?q=%22New+York+Knicks%22+NBA&hl=en&gl=US', 'basketball', true, 'US', 'en', NULL, 'New York Knicks news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Basketball — EuroLeague / ACB
  (gen_random_uuid(), 'Google News: Real Madrid Basket', 'https://news.google.com/rss/search?q=%22Real+Madrid%22+baloncesto&hl=es&gl=ES', 'basketball', true, 'ES', 'es', NULL, 'Real Madrid basketball news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Barcelona Basket', 'https://news.google.com/rss/search?q=%22Barcelona%22+baloncesto+ACB&hl=es&gl=ES', 'basketball', true, 'ES', 'es', NULL, 'FC Barcelona basketball news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Baskonia', 'https://news.google.com/rss/search?q=%22Baskonia%22+baloncesto&hl=es&gl=ES', 'basketball', true, 'ES', 'es', NULL, 'Baskonia basketball news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Valencia Basket', 'https://news.google.com/rss/search?q=%22Valencia+Basket%22+baloncesto&hl=es&gl=ES', 'basketball', true, 'ES', 'es', NULL, 'Valencia Basket news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Unicaja', 'https://news.google.com/rss/search?q=%22Unicaja%22+baloncesto&hl=es&gl=ES', 'basketball', true, 'ES', 'es', NULL, 'Unicaja basketball news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Joventut', 'https://news.google.com/rss/search?q=%22Joventut+Badalona%22+baloncesto&hl=es&gl=ES', 'basketball', true, 'ES', 'es', NULL, 'Joventut Badalona basketball news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Tennis — Top Players
  (gen_random_uuid(), 'Google News: Carlos Alcaraz', 'https://news.google.com/rss/search?q=%22Carlos+Alcaraz%22+tennis&hl=en&gl=GB', 'tennis', true, 'ES', 'en', NULL, 'Carlos Alcaraz news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Jannik Sinner', 'https://news.google.com/rss/search?q=%22Jannik+Sinner%22+tennis&hl=en&gl=GB', 'tennis', true, 'IT', 'en', NULL, 'Jannik Sinner news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Novak Djokovic', 'https://news.google.com/rss/search?q=%22Novak+Djokovic%22+tennis&hl=en&gl=GB', 'tennis', true, 'RS', 'en', NULL, 'Novak Djokovic news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Alexander Zverev', 'https://news.google.com/rss/search?q=%22Alexander+Zverev%22+tennis&hl=en&gl=GB', 'tennis', true, 'DE', 'en', NULL, 'Alexander Zverev news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Daniil Medvedev', 'https://news.google.com/rss/search?q=%22Daniil+Medvedev%22+tennis&hl=en&gl=GB', 'tennis', true, 'RU', 'en', NULL, 'Daniil Medvedev news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Iga Swiatek', 'https://news.google.com/rss/search?q=%22Iga+Swiatek%22+tennis&hl=en&gl=GB', 'tennis', true, 'PL', 'en', NULL, 'Iga Swiatek news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Aryna Sabalenka', 'https://news.google.com/rss/search?q=%22Aryna+Sabalenka%22+tennis&hl=en&gl=GB', 'tennis', true, 'BY', 'en', NULL, 'Aryna Sabalenka news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Coco Gauff', 'https://news.google.com/rss/search?q=%22Coco+Gauff%22+tennis&hl=en&gl=US', 'tennis', true, 'US', 'en', NULL, 'Coco Gauff news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Rafael Nadal', 'https://news.google.com/rss/search?q=%22Rafael+Nadal%22+tennis&hl=en&gl=GB', 'tennis', true, 'ES', 'en', NULL, 'Rafael Nadal news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Stefanos Tsitsipas', 'https://news.google.com/rss/search?q=%22Stefanos+Tsitsipas%22+tennis&hl=en&gl=GB', 'tennis', true, 'GR', 'en', NULL, 'Stefanos Tsitsipas news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Formula 1 — Drivers & Teams
  (gen_random_uuid(), 'Google News: Fernando Alonso', 'https://news.google.com/rss/search?q=%22Fernando+Alonso%22+formula+1&hl=es&gl=ES', 'formula1', true, 'ES', 'es', NULL, 'Fernando Alonso F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Carlos Sainz F1', 'https://news.google.com/rss/search?q=%22Carlos+Sainz%22+F1&hl=es&gl=ES', 'formula1', true, 'ES', 'es', NULL, 'Carlos Sainz F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Max Verstappen', 'https://news.google.com/rss/search?q=%22Max+Verstappen%22+F1&hl=en&gl=GB', 'formula1', true, 'NL', 'en', NULL, 'Max Verstappen F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Lewis Hamilton', 'https://news.google.com/rss/search?q=%22Lewis+Hamilton%22+F1&hl=en&gl=GB', 'formula1', true, 'GB', 'en', NULL, 'Lewis Hamilton F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Charles Leclerc', 'https://news.google.com/rss/search?q=%22Charles+Leclerc%22+F1&hl=en&gl=GB', 'formula1', true, 'MC', 'en', NULL, 'Charles Leclerc F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Lando Norris', 'https://news.google.com/rss/search?q=%22Lando+Norris%22+F1&hl=en&gl=GB', 'formula1', true, 'GB', 'en', NULL, 'Lando Norris F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Oscar Piastri', 'https://news.google.com/rss/search?q=%22Oscar+Piastri%22+F1&hl=en&gl=GB', 'formula1', true, 'AU', 'en', NULL, 'Oscar Piastri F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Red Bull Racing', 'https://news.google.com/rss/search?q=%22Red+Bull+Racing%22+F1&hl=en&gl=GB', 'formula1', true, 'AT', 'en', NULL, 'Red Bull Racing F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Ferrari F1', 'https://news.google.com/rss/search?q=%22Ferrari%22+formula+1&hl=en&gl=GB', 'formula1', true, 'IT', 'en', NULL, 'Ferrari F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: McLaren F1', 'https://news.google.com/rss/search?q=%22McLaren%22+formula+1&hl=en&gl=GB', 'formula1', true, 'GB', 'en', NULL, 'McLaren F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Mercedes F1', 'https://news.google.com/rss/search?q=%22Mercedes%22+formula+1&hl=en&gl=GB', 'formula1', true, 'DE', 'en', NULL, 'Mercedes F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Aston Martin F1', 'https://news.google.com/rss/search?q=%22Aston+Martin%22+formula+1&hl=en&gl=GB', 'formula1', true, 'GB', 'en', NULL, 'Aston Martin F1 news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Cycling — Top Riders & Teams
  (gen_random_uuid(), 'Google News: Tadej Pogacar', 'https://news.google.com/rss/search?q=%22Tadej+Pogacar%22+cycling&hl=en&gl=GB', 'cycling', true, 'SI', 'en', NULL, 'Tadej Pogacar cycling news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Jonas Vingegaard', 'https://news.google.com/rss/search?q=%22Jonas+Vingegaard%22+cycling&hl=en&gl=GB', 'cycling', true, 'DK', 'en', NULL, 'Jonas Vingegaard cycling news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Remco Evenepoel', 'https://news.google.com/rss/search?q=%22Remco+Evenepoel%22+cycling&hl=en&gl=GB', 'cycling', true, 'BE', 'en', NULL, 'Remco Evenepoel cycling news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Primoz Roglic', 'https://news.google.com/rss/search?q=%22Primoz+Roglic%22+cycling&hl=en&gl=GB', 'cycling', true, 'SI', 'en', NULL, 'Primoz Roglic cycling news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: UAE Team Emirates', 'https://news.google.com/rss/search?q=%22UAE+Team+Emirates%22+cycling&hl=en&gl=GB', 'cycling', true, 'AE', 'en', NULL, 'UAE Team Emirates cycling news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Team Visma', 'https://news.google.com/rss/search?q=%22Team+Visma%22+cycling&hl=en&gl=GB', 'cycling', true, 'NL', 'en', NULL, 'Team Visma cycling news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Swimming — Top Athletes
  (gen_random_uuid(), 'Google News: Leon Marchand', 'https://news.google.com/rss/search?q=%22Leon+Marchand%22+swimming&hl=en&gl=GB', 'swimming', true, 'FR', 'en', NULL, 'Leon Marchand swimming news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Katie Ledecky', 'https://news.google.com/rss/search?q=%22Katie+Ledecky%22+swimming&hl=en&gl=US', 'swimming', true, 'US', 'en', NULL, 'Katie Ledecky swimming news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Caeleb Dressel', 'https://news.google.com/rss/search?q=%22Caeleb+Dressel%22+swimming&hl=en&gl=US', 'swimming', true, 'US', 'en', NULL, 'Caeleb Dressel swimming news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Adam Peaty', 'https://news.google.com/rss/search?q=%22Adam+Peaty%22+swimming&hl=en&gl=GB', 'swimming', true, 'GB', 'en', NULL, 'Adam Peaty swimming news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Athletics — Top Athletes
  (gen_random_uuid(), 'Google News: Noah Lyles', 'https://news.google.com/rss/search?q=%22Noah+Lyles%22+athletics&hl=en&gl=US', 'athletics', true, 'US', 'en', NULL, 'Noah Lyles athletics news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Mondo Duplantis', 'https://news.google.com/rss/search?q=%22Mondo+Duplantis%22+athletics&hl=en&gl=GB', 'athletics', true, 'SE', 'en', NULL, 'Mondo Duplantis athletics news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Sydney McLaughlin', 'https://news.google.com/rss/search?q=%22Sydney+McLaughlin%22+athletics&hl=en&gl=US', 'athletics', true, 'US', 'en', NULL, 'Sydney McLaughlin athletics news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Faith Kipyegon', 'https://news.google.com/rss/search?q=%22Faith+Kipyegon%22+athletics&hl=en&gl=GB', 'athletics', true, 'KE', 'en', NULL, 'Faith Kipyegon athletics news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Femke Bol', 'https://news.google.com/rss/search?q=%22Femke+Bol%22+athletics&hl=en&gl=GB', 'athletics', true, 'NL', 'en', NULL, 'Femke Bol athletics news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),

  -- Padel — Top Players
  (gen_random_uuid(), 'Google News: Alejandro Galan', 'https://news.google.com/rss/search?q=%22Alejandro+Galan%22+padel&hl=es&gl=ES', 'padel', true, 'ES', 'es', NULL, 'Alejandro Galan padel news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Arturo Coello', 'https://news.google.com/rss/search?q=%22Arturo+Coello%22+padel&hl=es&gl=ES', 'padel', true, 'ES', 'es', NULL, 'Arturo Coello padel news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Ari Sanchez', 'https://news.google.com/rss/search?q=%22Ari+Sanchez%22+padel&hl=es&gl=ES', 'padel', true, 'ES', 'es', NULL, 'Ari Sanchez padel news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Google News: Gemma Triay', 'https://news.google.com/rss/search?q=%22Gemma+Triay%22+padel&hl=es&gl=ES', 'padel', true, 'ES', 'es', NULL, 'Gemma Triay padel news via Google News', 'team_news', false, NULL, NULL, NOW(), NOW())
ON CONFLICT (url) DO NOTHING;


-- ============================================================
-- VIDEO SOURCES
-- ============================================================

INSERT INTO "VideoSource" (id, name, platform, "feedUrl", "channelId", "playlistId", sport, active, "isCustom", "addedBy", "lastSyncedAt", "createdAt", "updatedAt")
VALUES
  -- Football
  (gen_random_uuid(), 'La Liga Official', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCIk1SjEGvIaLP01IyjqhUdQ', 'UCIk1SjEGvIaLP01IyjqhUdQ', NULL, 'football', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'FC Barcelona', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC14UlmYlSNiQCBe9Eookf_A', 'UC14UlmYlSNiQCBe9Eookf_A', NULL, 'football', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Real Madrid CF', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWV3obpZVGgJ3j9FVhEjhPQ', 'UCWV3obpZVGgJ3j9FVhEjhPQ', NULL, 'football', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Premier League', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCG5qGWdu8nIRZqJ_GgDwQ-w', 'UCG5qGWdu8nIRZqJ_GgDwQ-w', NULL, 'football', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'UEFA Champions League', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCmqtR_Zcb9tVOhSR4GJPOdA', 'UCmqtR_Zcb9tVOhSR4GJPOdA', NULL, 'football', true, false, NULL, NULL, NOW(), NOW()),

  -- Basketball
  (gen_random_uuid(), 'NBA', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWJ2lWNubArHWmf3FIHbfcQ', 'UCWJ2lWNubArHWmf3FIHbfcQ', NULL, 'basketball', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'ACB Liga Endesa', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsQKJjv_7sCJ3H5e2ToxsRQ', 'UCsQKJjv_7sCJ3H5e2ToxsRQ', NULL, 'basketball', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'EuroLeague Basketball', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHZVHPyEBBiCN_MWGLvoE6g', 'UCHZVHPyEBBiCN_MWGLvoE6g', NULL, 'basketball', true, false, NULL, NULL, NOW(), NOW()),

  -- Tennis
  (gen_random_uuid(), 'ATP Tour', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbcxFkd6B9xUU54tGlefpBQ', 'UCbcxFkd6B9xUU54tGlefpBQ', NULL, 'tennis', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'WTA Tennis', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCfgFISz_Dml2FvndRLICm6Q', 'UCfgFISz_Dml2FvndRLICm6Q', NULL, 'tennis', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Roland Garros', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCLhFbNomu6fEJ8LAQHFGCFA', 'UCLhFbNomu6fEJ8LAQHFGCFA', NULL, 'tennis', true, false, NULL, NULL, NOW(), NOW()),

  -- Swimming
  (gen_random_uuid(), 'World Aquatics', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCOmS8sLY6FjYqFHqYdTYIwg', 'UCOmS8sLY6FjYqFHqYdTYIwg', NULL, 'swimming', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'SwimSwam Video', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCxkfAhgF2bXi8rZCmekJJJQ', 'UCxkfAhgF2bXi8rZCmekJJJQ', NULL, 'swimming', true, false, NULL, NULL, NOW(), NOW()),

  -- Athletics
  (gen_random_uuid(), 'World Athletics', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXhSfRMgSE-OFCHPEgjjKUg', 'UCXhSfRMgSE-OFCHPEgjjKUg', NULL, 'athletics', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Olympics', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCTl3QQTvqHFjurroKxexy2Q', 'UCTl3QQTvqHFjurroKxexy2Q', NULL, 'athletics', true, false, NULL, NULL, NOW(), NOW()),

  -- Cycling
  (gen_random_uuid(), 'GCN en Espanol', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbgDgpSIjCO3CVQFE5P5XRQ', 'UCbgDgpSIjCO3CVQFE5P5XRQ', NULL, 'cycling', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Tour de France', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCikVMad1jqoGYIDftpFm2Aw', 'UCikVMad1jqoGYIDftpFm2Aw', NULL, 'cycling', true, false, NULL, NULL, NOW(), NOW()),

  -- Formula 1
  (gen_random_uuid(), 'Formula 1', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCB_qr75-ydFVKSz9KnBMLpg', 'UCB_qr75-ydFVKSz9KnBMLpg', NULL, 'formula1', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Scuderia Ferrari', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCEsCUOoJoR7Y5c2wuEIo8lQ', 'UCEsCUOoJoR7Y5c2wuEIo8lQ', NULL, 'formula1', true, false, NULL, NULL, NOW(), NOW()),

  -- Padel
  (gen_random_uuid(), 'Premier Padel', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCW-WYt6vA9DJQHE0zOA8e0A', 'UCW-WYt6vA9DJQHE0zOA8e0A', NULL, 'padel', true, false, NULL, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'World Padel Tour', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCMxpzwjvC64W5OUFNZ9ReOA', 'UCMxpzwjvC64W5OUFNZ9ReOA', NULL, 'padel', true, false, NULL, NULL, NOW(), NOW())
ON CONFLICT ("feedUrl") DO NOTHING;


-- ============================================================
-- ACHIEVEMENTS
-- ============================================================
-- Note: The Achievement model uses nameKey/descriptionKey (i18n keys) stored as
-- the title/description columns respectively, plus threshold and type fields.
-- Schema columns: id, key, nameKey, descriptionKey, icon, threshold, type, rewardStickerId, createdAt

INSERT INTO "Achievement" (id, key, "nameKey", "descriptionKey", icon, threshold, type, "createdAt")
VALUES
  -- News
  (gen_random_uuid(), 'first_read',       'achievement.first_read',          'achievement.first_read_desc',          '📰', 1,    'news_read',         NOW()),
  (gen_random_uuid(), 'news_10',          'achievement.news_10',             'achievement.news_10_desc',             '📚', 10,   'news_read',         NOW()),
  (gen_random_uuid(), 'news_50',          'achievement.news_50',             'achievement.news_50_desc',             '🗞️', 50,   'news_read',         NOW()),
  (gen_random_uuid(), 'news_100',         'achievement.news_100',            'achievement.news_100_desc',            '🏆', 100,  'news_read',         NOW()),

  -- Reels
  (gen_random_uuid(), 'first_reel',       'achievement.first_reel',          'achievement.first_reel_desc',          '🎬', 1,    'reels_watched',     NOW()),
  (gen_random_uuid(), 'reels_20',         'achievement.reels_20',            'achievement.reels_20_desc',            '📹', 20,   'reels_watched',     NOW()),

  -- Quiz
  (gen_random_uuid(), 'first_quiz',       'achievement.first_quiz',          'achievement.first_quiz_desc',          '❓', 1,    'quizzes_played',    NOW()),
  (gen_random_uuid(), 'quiz_perfect',     'achievement.quiz_perfect',        'achievement.quiz_perfect_desc',        '💯', 1,    'quiz_perfect',      NOW()),
  (gen_random_uuid(), 'quiz_10_perfect',  'achievement.quiz_10_perfect',     'achievement.quiz_10_perfect_desc',     '🧠', 10,   'quiz_perfect',      NOW()),

  -- Streaks
  (gen_random_uuid(), 'streak_3',         'achievement.streak_3',            'achievement.streak_3_desc',            '🔥', 3,    'streak',            NOW()),
  (gen_random_uuid(), 'streak_7',         'achievement.streak_7',            'achievement.streak_7_desc',            '🔥', 7,    'streak',            NOW()),
  (gen_random_uuid(), 'streak_14',        'achievement.streak_14',           'achievement.streak_14_desc',           '🔥', 14,   'streak',            NOW()),
  (gen_random_uuid(), 'streak_30',        'achievement.streak_30',           'achievement.streak_30_desc',           '🌟', 30,   'streak',            NOW()),

  -- Exploration
  (gen_random_uuid(), 'all_sports',       'achievement.all_sports',          'achievement.all_sports_desc',          '🌍', 5,    'all_sports',        NOW()),

  -- Stickers
  (gen_random_uuid(), 'first_sticker',    'achievement.first_sticker',       'achievement.first_sticker_desc',       '🏷️', 1,    'stickers_collected', NOW()),
  (gen_random_uuid(), 'stickers_10',      'achievement.stickers_10',         'achievement.stickers_10_desc',         '🎯', 10,   'stickers_collected', NOW()),
  (gen_random_uuid(), 'stickers_25',      'achievement.stickers_25',         'achievement.stickers_25_desc',         '💎', 25,   'stickers_collected', NOW()),

  -- Daily login
  (gen_random_uuid(), 'daily_login_7',    'achievement.daily_login_7',       'achievement.daily_login_7_desc',       '📅', 7,    'daily_login',       NOW()),

  -- Points
  (gen_random_uuid(), 'points_500',       'achievement.points_500',          'achievement.points_500_desc',          '⭐', 500,  'points',            NOW()),
  (gen_random_uuid(), 'points_1000',      'achievement.points_1000',         'achievement.points_1000_desc',         '🌟', 1000, 'points',            NOW())
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- TEAM STATS
-- ============================================================
-- Note: wins/draws/losses/goalsFor/goalsAgainst are not in the TypeScript seed data
-- (they use leaguePosition/topScorer instead). The schema only has the fields
-- listed below. Setting wins/draws/losses/goalsFor/goalsAgainst to 0 as defaults.
-- Schema columns: id, teamName, sport, leaguePosition, recentResults (Json),
--                 topScorer, nextMatch (Json?), updatedAt

INSERT INTO "TeamStats" (id, "teamName", sport, "leaguePosition", "recentResults", "topScorer", "nextMatch", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'Real Madrid',
    'football',
    1,
    '[{"opponent":"Barcelona","score":"2-1","result":"W","date":"2026-03-15"},{"opponent":"Atletico Madrid","score":"1-1","result":"D","date":"2026-03-08"},{"opponent":"Sevilla FC","score":"3-0","result":"W","date":"2026-03-01"},{"opponent":"Valencia CF","score":"2-0","result":"W","date":"2026-02-22"},{"opponent":"Real Betis","score":"1-2","result":"L","date":"2026-02-15"}]'::jsonb,
    'Kylian Mbappe (22 goals)',
    '{"opponent":"Athletic Club","date":"2026-03-29","competition":"La Liga"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Barcelona',
    'football',
    2,
    '[{"opponent":"Real Madrid","score":"1-2","result":"L","date":"2026-03-15"},{"opponent":"Villarreal","score":"4-1","result":"W","date":"2026-03-08"},{"opponent":"Real Sociedad","score":"2-0","result":"W","date":"2026-03-01"},{"opponent":"Girona","score":"3-1","result":"W","date":"2026-02-22"},{"opponent":"Celta Vigo","score":"2-2","result":"D","date":"2026-02-15"}]'::jsonb,
    'Lamine Yamal (18 goals)',
    '{"opponent":"Mallorca","date":"2026-03-29","competition":"La Liga"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Atletico Madrid',
    'football',
    3,
    '[{"opponent":"Real Madrid","score":"1-1","result":"D","date":"2026-03-08"},{"opponent":"Getafe","score":"2-0","result":"W","date":"2026-03-01"},{"opponent":"Osasuna","score":"1-0","result":"W","date":"2026-02-22"},{"opponent":"Rayo Vallecano","score":"3-1","result":"W","date":"2026-02-15"},{"opponent":"Las Palmas","score":"0-1","result":"L","date":"2026-02-08"}]'::jsonb,
    'Antoine Griezmann (14 goals)',
    '{"opponent":"Real Betis","date":"2026-03-29","competition":"La Liga"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Manchester City',
    'football',
    2,
    '[{"opponent":"Arsenal","score":"1-0","result":"W","date":"2026-03-16"},{"opponent":"Liverpool","score":"2-2","result":"D","date":"2026-03-09"},{"opponent":"Chelsea","score":"3-1","result":"W","date":"2026-03-02"},{"opponent":"Tottenham","score":"4-0","result":"W","date":"2026-02-23"},{"opponent":"Newcastle","score":"1-2","result":"L","date":"2026-02-16"}]'::jsonb,
    'Erling Haaland (28 goals)',
    '{"opponent":"Aston Villa","date":"2026-03-30","competition":"Premier League"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Liverpool',
    'football',
    1,
    '[{"opponent":"Manchester City","score":"2-2","result":"D","date":"2026-03-09"},{"opponent":"Everton","score":"3-0","result":"W","date":"2026-03-02"},{"opponent":"West Ham","score":"2-1","result":"W","date":"2026-02-23"},{"opponent":"Brighton","score":"1-0","result":"W","date":"2026-02-16"},{"opponent":"Wolves","score":"4-1","result":"W","date":"2026-02-09"}]'::jsonb,
    'Mohamed Salah (24 goals)',
    '{"opponent":"Crystal Palace","date":"2026-03-30","competition":"Premier League"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Bayern Munich',
    'football',
    1,
    '[{"opponent":"Borussia Dortmund","score":"3-1","result":"W","date":"2026-03-15"},{"opponent":"RB Leipzig","score":"2-0","result":"W","date":"2026-03-08"},{"opponent":"Bayer Leverkusen","score":"1-1","result":"D","date":"2026-03-01"},{"opponent":"Wolfsburg","score":"4-0","result":"W","date":"2026-02-22"},{"opponent":"Freiburg","score":"2-1","result":"W","date":"2026-02-15"}]'::jsonb,
    'Harry Kane (30 goals)',
    '{"opponent":"Stuttgart","date":"2026-03-29","competition":"Bundesliga"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'PSG',
    'football',
    1,
    '[{"opponent":"Marseille","score":"2-0","result":"W","date":"2026-03-16"},{"opponent":"Lyon","score":"3-2","result":"W","date":"2026-03-09"},{"opponent":"Monaco","score":"1-1","result":"D","date":"2026-03-02"},{"opponent":"Lille","score":"2-0","result":"W","date":"2026-02-23"},{"opponent":"Nice","score":"4-1","result":"W","date":"2026-02-16"}]'::jsonb,
    'Ousmane Dembele (16 goals)',
    '{"opponent":"Rennes","date":"2026-03-30","competition":"Ligue 1"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Juventus',
    'football',
    3,
    '[{"opponent":"AC Milan","score":"1-0","result":"W","date":"2026-03-15"},{"opponent":"Inter Milan","score":"0-2","result":"L","date":"2026-03-08"},{"opponent":"Roma","score":"2-1","result":"W","date":"2026-03-01"},{"opponent":"Napoli","score":"1-1","result":"D","date":"2026-02-22"},{"opponent":"Lazio","score":"3-0","result":"W","date":"2026-02-15"}]'::jsonb,
    'Dusan Vlahovic (15 goals)',
    '{"opponent":"Fiorentina","date":"2026-03-29","competition":"Serie A"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Los Angeles Lakers',
    'basketball',
    5,
    '[{"opponent":"Golden State Warriors","score":"118-112","result":"W","date":"2026-03-20"},{"opponent":"Boston Celtics","score":"105-110","result":"L","date":"2026-03-18"},{"opponent":"Denver Nuggets","score":"121-115","result":"W","date":"2026-03-16"},{"opponent":"Phoenix Suns","score":"108-102","result":"W","date":"2026-03-14"},{"opponent":"Dallas Mavericks","score":"99-104","result":"L","date":"2026-03-12"}]'::jsonb,
    'LeBron James (25.4 ppg)',
    '{"opponent":"LA Clippers","date":"2026-03-28","competition":"NBA"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Golden State Warriors',
    'basketball',
    7,
    '[{"opponent":"Los Angeles Lakers","score":"112-118","result":"L","date":"2026-03-20"},{"opponent":"Sacramento Kings","score":"125-119","result":"W","date":"2026-03-18"},{"opponent":"Milwaukee Bucks","score":"110-108","result":"W","date":"2026-03-16"},{"opponent":"Miami Heat","score":"105-100","result":"W","date":"2026-03-14"},{"opponent":"Oklahoma City Thunder","score":"98-115","result":"L","date":"2026-03-12"}]'::jsonb,
    'Stephen Curry (27.1 ppg)',
    '{"opponent":"Portland Trail Blazers","date":"2026-03-28","competition":"NBA"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Carlos Alcaraz',
    'tennis',
    1,
    '[{"opponent":"Novak Djokovic","score":"6-3, 7-5","result":"W","date":"2026-03-17"},{"opponent":"Jannik Sinner","score":"6-4, 3-6, 6-2","result":"W","date":"2026-03-14"},{"opponent":"Daniil Medvedev","score":"7-6, 6-4","result":"W","date":"2026-03-10"},{"opponent":"Alexander Zverev","score":"4-6, 6-3, 7-5","result":"W","date":"2026-03-07"},{"opponent":"Stefanos Tsitsipas","score":"6-2, 6-3","result":"W","date":"2026-03-04"}]'::jsonb,
    NULL,
    '{"opponent":"Jannik Sinner","date":"2026-03-30","competition":"Miami Open Final"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Rafael Nadal',
    'tennis',
    8,
    '[{"opponent":"Casper Ruud","score":"6-4, 6-3","result":"W","date":"2026-03-12"},{"opponent":"Holger Rune","score":"3-6, 6-4, 6-7","result":"L","date":"2026-03-08"},{"opponent":"Taylor Fritz","score":"7-5, 6-4","result":"W","date":"2026-03-05"},{"opponent":"Felix Auger-Aliassime","score":"6-3, 6-2","result":"W","date":"2026-03-02"},{"opponent":"Andrey Rublev","score":"4-6, 7-6, 3-6","result":"L","date":"2026-02-27"}]'::jsonb,
    NULL,
    '{"opponent":"Cameron Norrie","date":"2026-03-29","competition":"Miami Open R32"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Red Bull Racing',
    'formula1',
    1,
    '[{"opponent":"Australian GP","score":"P1","result":"W","date":"2026-03-22"},{"opponent":"Saudi Arabian GP","score":"P2","result":"D","date":"2026-03-15"},{"opponent":"Bahrain GP","score":"P1","result":"W","date":"2026-03-08"},{"opponent":"Pre-season Testing","score":"Fastest","result":"W","date":"2026-02-28"},{"opponent":"Abu Dhabi GP 2025","score":"P1","result":"W","date":"2025-12-07"}]'::jsonb,
    'Max Verstappen (63 pts)',
    '{"opponent":"Japanese GP","date":"2026-04-05","competition":"Formula 1 World Championship"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Scuderia Ferrari',
    'formula1',
    2,
    '[{"opponent":"Australian GP","score":"P2","result":"D","date":"2026-03-22"},{"opponent":"Saudi Arabian GP","score":"P1","result":"W","date":"2026-03-15"},{"opponent":"Bahrain GP","score":"P3","result":"D","date":"2026-03-08"},{"opponent":"Pre-season Testing","score":"2nd Fastest","result":"D","date":"2026-02-28"},{"opponent":"Abu Dhabi GP 2025","score":"P2","result":"D","date":"2025-12-07"}]'::jsonb,
    'Charles Leclerc (48 pts)',
    '{"opponent":"Japanese GP","date":"2026-04-05","competition":"Formula 1 World Championship"}'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Movistar Team',
    'cycling',
    8,
    '[{"opponent":"Paris-Nice","score":"Stage 4 Win","result":"W","date":"2026-03-13"},{"opponent":"Tirreno-Adriatico","score":"GC 5th","result":"D","date":"2026-03-10"},{"opponent":"Strade Bianche","score":"12th","result":"D","date":"2026-03-01"},{"opponent":"UAE Tour","score":"GC 3rd","result":"D","date":"2026-02-25"},{"opponent":"Volta a la Comunitat Valenciana","score":"GC 1st","result":"W","date":"2026-02-09"}]'::jsonb,
    'Enric Mas (team leader)',
    '{"opponent":"Volta a Catalunya","date":"2026-03-31","competition":"UCI WorldTour"}'::jsonb,
    NOW()
  )
ON CONFLICT ("teamName") DO NOTHING;
