// Pareja de colores de identidad por competencia: se usan como ambiente de
// fondo cuando el usuario tiene una liga activa de esa competencia.
interface Theme {
  c1: string;
  c2: string;
}

const THEMES: { match: string; theme: Theme }[] = [
  { match: "mundial", theme: { c1: "#0057B8", c2: "#D4AF37" } },
  { match: "world cup", theme: { c1: "#0057B8", c2: "#D4AF37" } },
  { match: "liga mx", theme: { c1: "#00A651", c2: "#C8102E" } },
  { match: "premier league", theme: { c1: "#3D195B", c2: "#00FF85" } },
  { match: "laliga", theme: { c1: "#FF4D00", c2: "#1E3A8A" } },
  { match: "la liga", theme: { c1: "#FF4D00", c2: "#1E3A8A" } },
  { match: "serie a", theme: { c1: "#0054A6", c2: "#00AEEF" } },
  { match: "bundesliga", theme: { c1: "#D20515", c2: "#111111" } },
  { match: "ligue 1", theme: { c1: "#001B44", c2: "#00AEEF" } },
  { match: "champions league", theme: { c1: "#001F5B", c2: "#FFFFFF" } },
  { match: "mls", theme: { c1: "#E2231A", c2: "#002D72" } },
  { match: "liga portugal", theme: { c1: "#00843D", c2: "#D71920" } },
  { match: "primeira liga", theme: { c1: "#00843D", c2: "#D71920" } },
  { match: "eredivisie", theme: { c1: "#FF6A00", c2: "#000000" } },
  { match: "brasileir", theme: { c1: "#009C3B", c2: "#FFDF00" } },
];

const DEFAULT_THEME: Theme = { c1: "#e61d25", c2: "#2a398d" };

export function competitionTheme(name?: string | null): Theme {
  if (!name) return DEFAULT_THEME;
  const n = name.toLowerCase();
  return THEMES.find((t) => n.includes(t.match))?.theme ?? DEFAULT_THEME;
}
