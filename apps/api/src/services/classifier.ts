// Keyword map for detecting teams in news titles
const TEAM_KEYWORDS: Record<string, string[]> = {
  'Real Madrid': ['real madrid', 'madridista', 'merengues', 'bernabéu'],
  'Barcelona': ['barcelona', 'barça', 'barca', 'blaugrana', 'culé'],
  'Atlético de Madrid': ['atlético', 'atleti', 'colchonero', 'metropolitano'],
  'Athletic Club': ['athletic club', 'athletic bilbao', 'leones'],
  'Real Sociedad': ['real sociedad', 'txuri-urdin'],
  'Real Betis': ['real betis', 'betis', 'verdiblanco'],
  'Sevilla FC': ['sevilla fc', 'sevilla'],
  'Valencia CF': ['valencia cf', 'valencia', 'che'],
  'Villarreal': ['villarreal', 'submarino amarillo'],
  'Selección España': ['selección española', 'la roja', 'selección de españa'],
  // Basketball
  'Real Madrid Baloncesto': ['real madrid baloncesto', 'real madrid basket'],
  'Barça Basket': ['barça basket', 'barcelona baloncesto'],
  // Formula 1
  'Fernando Alonso': ['fernando alonso', 'alonso'],
  'Carlos Sainz': ['carlos sainz', 'sainz'],
  // Tennis
  'Carlos Alcaraz': ['carlos alcaraz', 'alcaraz'],
  'Rafa Nadal': ['rafa nadal', 'nadal', 'rafael nadal'],
};

interface ClassificationResult {
  team?: string;
  minAge: number;
  maxAge: number;
}

export function classifyNews(title: string, summary: string): ClassificationResult {
  const fullText = `${title} ${summary}`.toLowerCase();

  // Detect team by keywords
  let detectedTeam: string | undefined;
  for (const [team, keywords] of Object.entries(TEAM_KEYWORDS)) {
    if (keywords.some((kw) => fullText.includes(kw))) {
      detectedTeam = team;
      break;
    }
  }

  // Phase 1: all news items are suitable for ages 6-14
  return {
    team: detectedTeam,
    minAge: 6,
    maxAge: 14,
  };
}
