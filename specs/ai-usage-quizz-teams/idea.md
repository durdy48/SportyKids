# Idea: Quiz Variado, AI Gratuita y Equipos por Deporte en Onboarding

## Contexto

Tres mejoras independientes pero relacionadas que elevan la calidad de la experiencia central de SportyKids:
quizzes más ricos, la feature de "Explicar Fácil" funcional, y un onboarding que muestre entidades relevantes
según el deporte elegido (tenistas, pilotos F1, etc. en lugar de solo equipos de fútbol).

---

## Problema 1 — Quizzes siempre distintos y sin repetición

**Situación actual:**
- El cron genera un quiz diario a las 06:00 UTC usando noticias recientes del mismo día.
- Las preguntas están acotadas a noticias de las últimas horas, lo que hace que se repitan temas
  y que días con pocas noticias produzcan quizzes pobres o idénticos.
- No hay mecanismo de deduplicación: si una pregunta sobre "Mbappé marcó un gol" se generó el lunes,
  puede volver a generarse el martes con diferente redacción pero el mismo conocimiento.
- El seed tiene 15 preguntas estáticas como fallback, lo que acentúa la sensación de repetición.

**Lo que queremos:**
- Preguntas de trivia que cubran todos los deportes (football, basketball, tennis, swimming,
  athletics, cycling, formula1, padel) de forma equilibrada.
- Mezcla de conocimiento atemporal (récords históricos, figuras legendarias, reglas del deporte)
  con conocimiento reciente (noticias de los últimos 30 días, no solo las del día).
- Sistema de deduplicación: no volver a generar una pregunta cuyo "conocimiento clave" ya fue
  preguntado en los últimos N días (hash o embedding por tema + equipo/atleta).
- Pool de preguntas persistente: en lugar de generar exactamente N preguntas al día y descartarlas,
  mantener un pool del que se sirven los quizzes, rellenado incrementalmente.
- Fallback robusto: si el AI falla, tirar de preguntas aprobadas del pool que el usuario no ha visto,
  nunca del seed estático.

---

## Problema 2 — "Explicar Fácil" con AI gratuita

**Situación actual:**
- El endpoint `GET /api/news/:id/summary?age=&locale=` existe y llama a `summarizer.ts`.
- `summarizer.ts` usa `ai-client.ts` que por defecto apunta a `AI_PROVIDER=ollama` (local).
- En producción (Fly.io) no hay Ollama desplegado, por lo que los resúmenes fallan silenciosamente
  o devuelven el texto original sin adaptar.
- En la web/mobile, el componente `AgeAdaptedSummary` existe pero puede no estar bien integrado
  en la vista de detalle de noticia.
- No hay forma de usar un proveedor AI gratuito en producción sin coste para el proyecto.

**Lo que queremos:**
- Que "Explicar Fácil" funcione en producción de forma gratuita.
- **Proveedor elegido: Groq API** — Llama 3.1 8B/70B, 14.400 req/día gratis, latencia ~300ms,
  compatible con OpenAI SDK (mínimo cambio en `ai-client.ts`), sin tarjeta de crédito.
  Elegido sobre Gemini Flash (solo 1.500 req/día) y OpenRouter (más complejo) por el límite
  de requests diarios y la integración trivial con el SDK ya en uso.
- Documentar los pasos exactos para activar Groq en producción.
- Asegurar que el botón "Explicar Fácil" en la UI llama al endpoint y muestra el resumen adaptado.

**Próximos pasos que el desarrollador debe hacer:**
1. Crear cuenta en console.groq.com y generar una API key gratuita (2 min, sin tarjeta).
2. Añadir los secrets en Fly.io: `fly secrets set AI_PROVIDER=groq GROQ_API_KEY=xxx`.
3. Añadir soporte Groq en `ai-client.ts` (base URL: `https://api.groq.com/openai/v1`, modelo: `llama-3.1-8b-instant`).
4. Documentar `GROQ_API_KEY` en la tabla de variables de entorno del CLAUDE.md.

---

## Problema 3 — Equipos/atletas relevantes por deporte en Onboarding

**Situación actual:**
- El paso de "equipo favorito" en el onboarding muestra una lista fija de equipos de fútbol
  (Real Madrid, Barcelona, Manchester City…) independientemente del deporte elegido en el paso anterior.
- Si el usuario elige tenis, le aparecen equipos de fútbol. Si elige F1, igual.
- El campo `selectedFeeds` en User almacena slugs de fuentes RSS, no equipos/atletas directamente.
- El catálogo de 127 fuentes `team_news` en el seed cubre: La Liga, Premier, Serie A, Bundesliga,
  NBA, EuroLeague/ACB, tenistas top (Alcaraz, Sinner, Djokovic…), pilotos F1, ciclistas, nadadores,
  atletas de campo y pista, y jugadores de pádel.

**Lo que queremos:**
- Que en el paso "¿A quién sigues?" del onboarding se muestren entidades relevantes para cada deporte:
  - `football` → equipos de fútbol (como ahora, pero completar con más ligas)
  - `basketball` → equipos NBA + EuroLeague/ACB
  - `tennis` → tenistas top (Alcaraz, Sinner, Djokovic, Swiatek, Sabalenka…)
  - `formula1` → pilotos (Verstappen, Hamilton, Leclerc…) + escuderías (Red Bull, Ferrari, Mercedes…)
  - `cycling` → ciclistas (Pogacar, Vingegaard, Evenepoel…)
  - `swimming` → nadadores (Caeleb Dressel, Léon Marchand…)
  - `athletics` → atletas (Mondo Duplantis, Marcell Jacobs…)
  - `padel` → jugadores de pádel (Lebron, Galan, Tapia…)
- La selección mapea a fuentes RSS `team_news` en el catálogo, igual que ahora con fútbol.
- El onboarding debe ser dinámico: si el usuario elige varios deportes, mostrar entidades de todos.
- El campo `favoriteSports` ya existe; hay que cruzarlo con el catálogo de fuentes para filtrar.

---

## Alcance y dependencias

| Feature | Dependencias | Complejidad estimada |
|---------|-------------|----------------------|
| Quiz variado sin repetición | DB (pool de preguntas), AI client, cron | Media-Alta |
| Explicar Fácil en producción | Proveedor AI externo, config Fly.io, UI check | Baja-Media |
| Onboarding por deporte | Catálogo fuentes, UI onboarding (web+mobile) | Media |

Se pueden trabajar de forma independiente. Se recomienda empezar por **Explicar Fácil** (menor
riesgo, mayor impacto percibido inmediato) y **Onboarding por deporte** (no requiere AI),
dejando el Quiz para una iteración posterior por ser más complejo.
