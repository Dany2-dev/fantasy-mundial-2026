// Catálogo de títulos de Tu Leyenda. Los logos son los reales de FotMob (los
// mismos que ya sirve el backend), y cada club solo puede ganar lo que le
// corresponde por confederación: un club mexicano pelea la Concachampions, uno
// brasileño la Libertadores y uno europeo la Champions/Europa/Conference.

export type TrophyScope = "liga" | "copa" | "continental" | "seleccion" | "individual";
/** Iconos SVG propios, para los premios que no tienen logo de competición. */
export type TrophyIcon = "boot" | "ball" | "glove" | "trophy" | "star";

export interface TrophyDef {
  id: string;
  name: string;
  scope: TrophyScope;
  logoUrl?: string;
  icon?: TrophyIcon;
}

const LOGO = (id: number) => `https://images.fotmob.com/image_resources/logo/leaguelogo/${id}.png`;

// --- Ligas ---------------------------------------------------------------
const LEAGUE_LOGO: Record<string, number> = {
  "Liga MX": 230,
  MLS: 130,
  "Brasileirão": 268,
  Eredivisie: 57,
  "Liga Portugal": 61,
  LaLiga: 87,
  "Premier League": 47,
  Bundesliga: 54,
  "Serie A": 55,
  "Ligue 1": 53,
};

// --- Copas nacionales ----------------------------------------------------
// Portugal no tiene logo público estable en FotMob, así que su copa reutiliza
// el escudo de la liga en vez de romper la imagen.
const DOMESTIC_CUP: Record<string, { name: string; logo: number }> = {
  "Liga MX": { name: "Copa MX", logo: 8973 },
  MLS: { name: "US Open Cup", logo: 8974 },
  "Brasileirão": { name: "Copa do Brasil", logo: 44 },
  Eredivisie: { name: "KNVB Beker", logo: 143 },
  "Liga Portugal": { name: "Taça de Portugal", logo: 61 },
  LaLiga: { name: "Copa del Rey", logo: 138 },
  "Premier League": { name: "FA Cup", logo: 132 },
  Bundesliga: { name: "DFB-Pokal", logo: 209 },
  "Serie A": { name: "Coppa Italia", logo: 141 },
  "Ligue 1": { name: "Coupe de France", logo: 134 },
};

// --- Copas continentales por confederación --------------------------------
export const CHAMPIONS: TrophyDef = { id: "ucl", name: "Champions League", scope: "continental", logoUrl: LOGO(42) };
export const EUROPA: TrophyDef = { id: "uel", name: "Europa League", scope: "continental", logoUrl: LOGO(73) };
export const CONFERENCE: TrophyDef = { id: "uecl", name: "Conference League", scope: "continental", logoUrl: LOGO(10216) };
export const LIBERTADORES: TrophyDef = { id: "libertadores", name: "Copa Libertadores", scope: "continental", logoUrl: LOGO(45) };
export const CONCACHAMPIONS: TrophyDef = { id: "concachampions", name: "Concachampions", scope: "continental", logoUrl: LOGO(297) };
export const MUNDIAL_CLUBES: TrophyDef = { id: "mundialito", name: "Mundial de Clubes", scope: "continental", logoUrl: LOGO(78) };

// --- Selección -----------------------------------------------------------
export const MUNDIAL: TrophyDef = { id: "mundial", name: "Copa del Mundo", scope: "seleccion", logoUrl: LOGO(77) };

// --- Premios individuales (SVG propio) ------------------------------------
export const BALON_ORO: TrophyDef = { id: "balon-oro", name: "Balón de Oro", scope: "individual", icon: "ball" };
export const BOTA_ORO: TrophyDef = { id: "bota-oro", name: "Bota de Oro", scope: "individual", icon: "boot" };
export const GUANTE_ORO: TrophyDef = { id: "guante-oro", name: "Guante de Oro", scope: "individual", icon: "glove" };
export const ONCE_IDEAL: TrophyDef = { id: "once-ideal", name: "Once ideal de la liga", scope: "individual", icon: "star" };
export const MEJOR_JOVEN: TrophyDef = { id: "mejor-joven", name: "Mejor jugador joven", scope: "individual", icon: "star" };
export const MEJOR_DEFENSA: TrophyDef = { id: "mejor-defensa", name: "Mejor defensa de la liga", scope: "individual", icon: "star" };
export const LIDERAZGO: TrophyDef = { id: "liderazgo", name: "Premio al liderazgo", scope: "individual", icon: "star" };

const EUROPEAN = new Set([
  "LaLiga",
  "Premier League",
  "Bundesliga",
  "Serie A",
  "Ligue 1",
  "Eredivisie",
  "Liga Portugal",
  // Ligas puente: también juegan competiciones UEFA.
  "Pro League",
  "Superliga",
  "Eliteserien",
  "Süper Lig",
  "Superliga Griega",
  "Chance Liga",
]);
const CONMEBOL = new Set(["Brasileirão"]);
const CONCACAF = new Set(["Liga MX", "MLS"]);

export function leagueTrophy(league: string): TrophyDef {
  return {
    id: `liga-${league}`,
    name: league === "Premier League" ? "Premier League" : `Título de ${league}`,
    scope: "liga",
    logoUrl: LEAGUE_LOGO[league] ? LOGO(LEAGUE_LOGO[league]) : undefined,
    icon: "trophy",
  };
}

export function domesticCupTrophy(league: string): TrophyDef {
  const cup = DOMESTIC_CUP[league];
  if (!cup) return { id: "copa-nacional", name: "Copa Nacional", scope: "copa", icon: "trophy" };
  return { id: `copa-${league}`, name: cup.name, scope: "copa", logoUrl: LOGO(cup.logo) };
}

/**
 * Copas continentales que ese club puede pelear, ordenadas de más difícil a
 * más accesible. El tier decide a cuál llega: solo los grandes juegan (y
 * ganan) la Champions; un equipo medio pelea la Europa o la Conference.
 */
export function continentalCupsFor(league: string, tier: number): TrophyDef[] {
  if (EUROPEAN.has(league)) {
    if (tier >= 5) return [CHAMPIONS, EUROPA];
    if (tier === 4) return [EUROPA, CHAMPIONS];
    if (tier === 3) return [CONFERENCE, EUROPA];
    return [CONFERENCE];
  }
  if (CONMEBOL.has(league)) return tier >= 3 ? [LIBERTADORES] : [];
  if (CONCACAF.has(league)) return tier >= 3 ? [CONCACHAMPIONS] : [];
  return [];
}

/** Reconstruye la definición (y por tanto el logo) a partir del nombre guardado. */
export function trophyByName(name: string, league?: string): TrophyDef {
  const all = [
    CHAMPIONS, EUROPA, CONFERENCE, LIBERTADORES, CONCACHAMPIONS, MUNDIAL_CLUBES, MUNDIAL,
    BALON_ORO, BOTA_ORO, GUANTE_ORO, ONCE_IDEAL, MEJOR_JOVEN, MEJOR_DEFENSA, LIDERAZGO,
  ];
  const direct = all.find((t) => t.name === name);
  if (direct) return direct;
  if (league) {
    const lt = leagueTrophy(league);
    if (lt.name === name) return lt;
    const ct = domesticCupTrophy(league);
    if (ct.name === name) return ct;
  }
  // Copas nacionales de otras ligas (el jugador cambió de club desde entonces).
  for (const lg of Object.keys(DOMESTIC_CUP)) {
    const ct = domesticCupTrophy(lg);
    if (ct.name === name) return ct;
    const lt = leagueTrophy(lg);
    if (lt.name === name) return lt;
  }
  return { id: "generico", name, scope: "copa", icon: "trophy" };
}
