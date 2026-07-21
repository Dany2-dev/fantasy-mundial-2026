// Paleta de identidad por competencia: cuando el usuario tiene una liga activa
// de esa competencia, sus colores reskinnean el fondo, los CTA y el nav activo.
export interface Theme {
  primary: string;
  secondary: string;
  accent: string;
  cta: string;
}

const THEMES: { match: string; theme: Theme }[] = [
  { match: "mundial", theme: { primary: "#0057B8", secondary: "#00A3E0", accent: "#F5C400", cta: "#E31C23" } },
  { match: "world cup", theme: { primary: "#0057B8", secondary: "#00A3E0", accent: "#F5C400", cta: "#E31C23" } },
  { match: "liga mx", theme: { primary: "#00A651", secondary: "#004B2D", accent: "#B8E986", cta: "#00D26A" } },
  { match: "premier league", theme: { primary: "#37003C", secondary: "#5B0060", accent: "#00FF87", cta: "#FF2882" } },
  { match: "laliga", theme: { primary: "#FF4B1F", secondary: "#002D72", accent: "#FFD200", cta: "#FF6A00" } },
  { match: "la liga", theme: { primary: "#FF4B1F", secondary: "#002D72", accent: "#FFD200", cta: "#FF6A00" } },
  { match: "serie a", theme: { primary: "#0055A4", secondary: "#001F5B", accent: "#00AEEF", cta: "#008CFF" } },
  { match: "bundesliga", theme: { primary: "#D20515", secondary: "#1A1A1A", accent: "#F5F5F5", cta: "#FF3B30" } },
  { match: "ligue 1", theme: { primary: "#091C5A", secondary: "#0B3B91", accent: "#D4AF37", cta: "#3A7BFF" } },
  { match: "champions league", theme: { primary: "#001F5B", secondary: "#0A3D91", accent: "#FFFFFF", cta: "#00A8FF" } },
  { match: "mls", theme: { primary: "#001F5B", secondary: "#D71920", accent: "#A7A9AC", cta: "#0066FF" } },
  { match: "liga portugal", theme: { primary: "#006633", secondary: "#00994D", accent: "#D4AF37", cta: "#00C853" } },
  { match: "primeira liga", theme: { primary: "#006633", secondary: "#00994D", accent: "#D4AF37", cta: "#00C853" } },
  { match: "eredivisie", theme: { primary: "#F36F21", secondary: "#FF8C42", accent: "#1E3A8A", cta: "#FF6F00" } },
  { match: "brasileir", theme: { primary: "#009C3B", secondary: "#FFDF00", accent: "#002776", cta: "#00A550" } },
];

const DEFAULT_THEME: Theme = { primary: "#e61d25", secondary: "#2a398d", accent: "#f3c14a", cta: "#e61d25" };

export function competitionTheme(name?: string | null): Theme {
  if (!name) return DEFAULT_THEME;
  const n = name.toLowerCase();
  return THEMES.find((t) => n.includes(t.match))?.theme ?? DEFAULT_THEME;
}
