// Catálogo autocontenido de Tu Leyenda: países (para la bandera del jugador)
// y clubes por nivel (tier 1 = filiales/ligas menores, tier 5 = gigantes de
// Europa). No usa la BD real de FotMob a propósito: es un simulador narrativo
// independiente del fantasy, no necesita datos en vivo.

export interface CareerCountry {
  name: string;
  code: string; // ISO2, para flagcdn.com
}

export const COUNTRIES: CareerCountry[] = [
  { name: "México", code: "mx" },
  { name: "Argentina", code: "ar" },
  { name: "Brasil", code: "br" },
  { name: "España", code: "es" },
  { name: "Francia", code: "fr" },
  { name: "Inglaterra", code: "gb-eng" },
  { name: "Alemania", code: "de" },
  { name: "Italia", code: "it" },
  { name: "Portugal", code: "pt" },
  { name: "Países Bajos", code: "nl" },
  { name: "Bélgica", code: "be" },
  { name: "Estados Unidos", code: "us" },
  { name: "Colombia", code: "co" },
  { name: "Uruguay", code: "uy" },
  { name: "Chile", code: "cl" },
  { name: "Perú", code: "pe" },
  { name: "Ecuador", code: "ec" },
  { name: "Paraguay", code: "py" },
  { name: "Venezuela", code: "ve" },
  { name: "Costa Rica", code: "cr" },
  { name: "Canadá", code: "ca" },
  { name: "Japón", code: "jp" },
  { name: "Corea del Sur", code: "kr" },
  { name: "Marruecos", code: "ma" },
  { name: "Argelia", code: "dz" },
  { name: "Túnez", code: "tn" },
  { name: "Egipto", code: "eg" },
  { name: "Nigeria", code: "ng" },
  { name: "Senegal", code: "sn" },
  { name: "Camerún", code: "cm" },
  { name: "Ghana", code: "gh" },
  { name: "Costa de Marfil", code: "ci" },
  { name: "Sudáfrica", code: "za" },
  { name: "Croacia", code: "hr" },
  { name: "Serbia", code: "rs" },
  { name: "Polonia", code: "pl" },
  { name: "Suecia", code: "se" },
  { name: "Noruega", code: "no" },
  { name: "Dinamarca", code: "dk" },
  { name: "Suiza", code: "ch" },
  { name: "Austria", code: "at" },
  { name: "Escocia", code: "gb-sct" },
  { name: "Gales", code: "gb-wls" },
  { name: "Irlanda", code: "ie" },
  { name: "Turquía", code: "tr" },
  { name: "Grecia", code: "gr" },
  { name: "Rusia", code: "ru" },
  { name: "Ucrania", code: "ua" },
  { name: "Australia", code: "au" },
  { name: "China", code: "cn" },
  { name: "Arabia Saudita", code: "sa" },
  { name: "Catar", code: "qa" },
  { name: "Jamaica", code: "jm" },
  { name: "Honduras", code: "hn" },
  { name: "Panamá", code: "pa" },
  { name: "República Dominicana", code: "do" },
  { name: "Bolivia", code: "bo" },
  { name: "Islandia", code: "is" },
  { name: "Gales del Sur", code: "gb" },
];

export type PitchPosition = "POR" | "DFC" | "LI" | "LD" | "MCD" | "MC" | "MCO" | "MI" | "MD" | "EI" | "ED" | "DC";

export const PITCH_LAYOUT: { pos: PitchPosition; x: number; y: number }[] = [
  { pos: "DC", x: 50, y: 8 },
  { pos: "EI", x: 12, y: 15 },
  { pos: "ED", x: 88, y: 15 },
  { pos: "MCO", x: 50, y: 28 },
  { pos: "MI", x: 18, y: 40 },
  { pos: "MC", x: 50, y: 44 },
  { pos: "MD", x: 82, y: 40 },
  { pos: "MCD", x: 50, y: 58 },
  { pos: "LI", x: 12, y: 70 },
  { pos: "DFC", x: 50, y: 74 },
  { pos: "LD", x: 88, y: 70 },
  { pos: "POR", x: 50, y: 92 },
];

export interface CareerClub {
  id: string;
  name: string;
  league: string;
  country: string;
  tier: 1 | 2 | 3 | 4 | 5; // 1 = filial/liga menor, 5 = elite mundial
  color: string;
}

// Tier aproximado: 1-2 ligas locales/menores, 3 ligas competitivas medias,
// 4-5 grandes ligas europeas y clubes históricos.
export const CLUBS: CareerClub[] = [
  // Liga MX y filiales (tier 1-3)
  { id: "tijuana", name: "Tijuana", league: "Liga MX", country: "México", tier: 1, color: "#c8102e" },
  { id: "leon", name: "León", league: "Liga MX", country: "México", tier: 2, color: "#0a5c36" },
  { id: "puebla", name: "Puebla", league: "Liga MX", country: "México", tier: 1, color: "#1f4e8c" },
  { id: "queretaro", name: "Querétaro", league: "Liga MX", country: "México", tier: 1, color: "#1a1a1a" },
  { id: "atlante", name: "Atlante", league: "Liga MX", country: "México", tier: 2, color: "#1c3f94" },
  { id: "santos", name: "Santos Laguna", league: "Liga MX", country: "México", tier: 2, color: "#0f7a3d" },
  { id: "san-luis", name: "San Luis", league: "Liga MX", country: "México", tier: 1, color: "#e6001a" },
  { id: "cruz-azul", name: "Cruz Azul", league: "Liga MX", country: "México", tier: 3, color: "#0033a0" },
  { id: "america", name: "Club América", league: "Liga MX", country: "México", tier: 4, color: "#f9c80e" },
  { id: "chivas", name: "Chivas", league: "Liga MX", country: "México", tier: 3, color: "#a6192e" },
  { id: "monterrey", name: "Monterrey", league: "Liga MX", country: "México", tier: 4, color: "#0f2e5a" },
  { id: "pachuca", name: "Pachuca", league: "Liga MX", country: "México", tier: 3, color: "#003b73" },

  // MLS
  { id: "lafc", name: "LAFC", league: "MLS", country: "Estados Unidos", tier: 3, color: "#1a1a1a" },
  { id: "inter-miami", name: "Inter Miami", league: "MLS", country: "Estados Unidos", tier: 3, color: "#f7b5cd" },
  { id: "seattle", name: "Seattle Sounders", league: "MLS", country: "Estados Unidos", tier: 3, color: "#5d9741" },

  // Brasileirão
  { id: "santos-fc", name: "Santos FC", league: "Brasileirão", country: "Brasil", tier: 3, color: "#1a1a1a" },
  { id: "gremio", name: "Grêmio", league: "Brasileirão", country: "Brasil", tier: 3, color: "#00a0dc" },
  { id: "internacional", name: "Internacional", league: "Brasileirão", country: "Brasil", tier: 3, color: "#c8102e" },
  { id: "palmeiras", name: "Palmeiras", league: "Brasileirão", country: "Brasil", tier: 4, color: "#0a5c36" },
  { id: "flamengo", name: "Flamengo", league: "Brasileirão", country: "Brasil", tier: 4, color: "#c8102e" },

  // Liga Argentina
  { id: "huracan", name: "Huracán", league: "Liga Argentina", country: "Argentina", tier: 2, color: "#e6001a" },
  { id: "banfield", name: "Banfield", league: "Liga Argentina", country: "Argentina", tier: 2, color: "#0a5c36" },
  { id: "racing", name: "Racing Club", league: "Liga Argentina", country: "Argentina", tier: 3, color: "#87ceeb" },
  { id: "river", name: "River Plate", league: "Liga Argentina", country: "Argentina", tier: 4, color: "#e6001a" },
  { id: "boca", name: "Boca Juniors", league: "Liga Argentina", country: "Argentina", tier: 4, color: "#1c3f94" },

  // Eredivisie / Liga Portugal (trampolín a Europa)
  { id: "az", name: "AZ Alkmaar", league: "Eredivisie", country: "Países Bajos", tier: 3, color: "#c8102e" },
  { id: "utrecht", name: "Utrecht", league: "Eredivisie", country: "Países Bajos", tier: 2, color: "#c8102e" },
  { id: "ajax", name: "Ajax", league: "Eredivisie", country: "Países Bajos", tier: 4, color: "#d2122e" },
  { id: "braga", name: "Braga", league: "Liga Portugal", country: "Portugal", tier: 3, color: "#c8102e" },
  { id: "vitoria-sc", name: "Vitória SC", league: "Liga Portugal", country: "Portugal", tier: 2, color: "#ffffff" },
  { id: "porto", name: "Porto", league: "Liga Portugal", country: "Portugal", tier: 4, color: "#1c3f94" },
  { id: "benfica", name: "Benfica", league: "Liga Portugal", country: "Portugal", tier: 4, color: "#c8102e" },

  // LaLiga
  { id: "mirandes", name: "Mirandés", league: "LaLiga 2", country: "España", tier: 2, color: "#c8102e" },
  { id: "eibar", name: "Eibar", league: "LaLiga 2", country: "España", tier: 2, color: "#1c3f94" },
  { id: "getafe", name: "Getafe", league: "LaLiga", country: "España", tier: 3, color: "#1c3f94" },
  { id: "villarreal", name: "Villarreal", league: "LaLiga", country: "España", tier: 4, color: "#f9c80e" },
  { id: "sevilla", name: "Sevilla", league: "LaLiga", country: "España", tier: 4, color: "#d2122e" },
  { id: "atletico", name: "Atlético de Madrid", league: "LaLiga", country: "España", tier: 5, color: "#c8102e" },
  { id: "barcelona", name: "Barcelona", league: "LaLiga", country: "España", tier: 5, color: "#a50044" },
  { id: "real-madrid", name: "Real Madrid", league: "LaLiga", country: "España", tier: 5, color: "#ffffff" },

  // Premier League
  { id: "luton", name: "Luton Town", league: "Championship", country: "Inglaterra", tier: 2, color: "#f9c80e" },
  { id: "hull", name: "Hull City", league: "Championship", country: "Inglaterra", tier: 2, color: "#f9a825" },
  { id: "brentford", name: "Brentford", league: "Premier League", country: "Inglaterra", tier: 3, color: "#e6001a" },
  { id: "crystal-palace", name: "Crystal Palace", league: "Premier League", country: "Inglaterra", tier: 3, color: "#1c3f94" },
  { id: "newcastle", name: "Newcastle", league: "Premier League", country: "Inglaterra", tier: 4, color: "#1a1a1a" },
  { id: "arsenal", name: "Arsenal", league: "Premier League", country: "Inglaterra", tier: 5, color: "#e6001a" },
  { id: "liverpool", name: "Liverpool", league: "Premier League", country: "Inglaterra", tier: 5, color: "#c8102e" },
  { id: "man-city", name: "Manchester City", league: "Premier League", country: "Inglaterra", tier: 5, color: "#6cabdd" },

  // Bundesliga
  { id: "st-pauli", name: "St. Pauli", league: "Bundesliga 2", country: "Alemania", tier: 2, color: "#5d3a1a" },
  { id: "heidenheim", name: "Heidenheim", league: "Bundesliga", country: "Alemania", tier: 2, color: "#c8102e" },
  { id: "freiburg", name: "Friburgo", league: "Bundesliga", country: "Alemania", tier: 3, color: "#1a1a1a" },
  { id: "leverkusen", name: "Bayer Leverkusen", league: "Bundesliga", country: "Alemania", tier: 4, color: "#e6001a" },
  { id: "dortmund", name: "Borussia Dortmund", league: "Bundesliga", country: "Alemania", tier: 5, color: "#f9c80e" },
  { id: "bayern", name: "Bayern Múnich", league: "Bundesliga", country: "Alemania", tier: 5, color: "#dc052d" },

  // Serie A / Ligue 1
  { id: "cremonese", name: "Cremonese", league: "Serie B", country: "Italia", tier: 2, color: "#c8102e" },
  { id: "torino", name: "Torino", league: "Serie A", country: "Italia", tier: 3, color: "#8b1a1a" },
  { id: "fiorentina", name: "Fiorentina", league: "Serie A", country: "Italia", tier: 4, color: "#5c3d99" },
  { id: "napoli", name: "Napoli", league: "Serie A", country: "Italia", tier: 5, color: "#1c3f94" },
  { id: "juventus", name: "Juventus", league: "Serie A", country: "Italia", tier: 5, color: "#1a1a1a" },
  { id: "reims", name: "Reims", league: "Ligue 1", country: "Francia", tier: 2, color: "#c8102e" },
  { id: "monaco", name: "Mónaco", league: "Ligue 1", country: "Francia", tier: 4, color: "#c8102e" },
  { id: "psg", name: "Paris Saint-Germain", league: "Ligue 1", country: "Francia", tier: 5, color: "#004170" },
];

export function clubsForTier(tier: number, excludeIds: string[] = []): CareerClub[] {
  const pool = CLUBS.filter((c) => Math.abs(c.tier - tier) <= 1 && !excludeIds.includes(c.id));
  return pool.length >= 3 ? pool : CLUBS.filter((c) => !excludeIds.includes(c.id));
}

export function clubsForCountry(country: string, tier: number): CareerClub[] {
  const local = CLUBS.filter((c) => c.country === country && Math.abs(c.tier - tier) <= 1);
  return local.length >= 2 ? local : clubsForTier(tier);
}

export function tierFromOvr(ovr: number): number {
  if (ovr >= 86) return 5;
  if (ovr >= 78) return 4;
  if (ovr >= 68) return 3;
  if (ovr >= 58) return 2;
  return 1;
}
