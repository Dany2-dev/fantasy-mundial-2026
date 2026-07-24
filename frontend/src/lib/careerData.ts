// Catálogo de Tu Leyenda: países, clubes y ligas REALES (mismos escudos y
// logos que ya sirve el backend vía FotMob — nada inventado). Los tiers
// (1 = filial/mitad de tabla, 5 = gigante continental) se asignaron a mano
// según prestigio real de cada club, no según los datos del fantasy.

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

// Fotos de Pexels (licencia libre) para las tarjetas de decisión con
// porcentaje: dan contexto visual al riesgo/beneficio de cada opción.
export const PEXELS = {
  training: "https://images.pexels.com/photos/38615873/pexels-photo-38615873/free-photo-of-intense-soccer-training-session-on-grass-field.jpeg?auto=compress&cs=tinysrgb&w=400",
  injury: "https://images.pexels.com/photos/29558666/pexels-photo-29558666/free-photo-of-injured-soccer-player-on-grass-field.jpeg?auto=compress&cs=tinysrgb&w=400",
  bench: "https://images.pexels.com/photos/31579487/pexels-photo-31579487/free-photo-of-empty-soccer-bench-at-outdoor-stadium.jpeg?auto=compress&cs=tinysrgb&w=400",
  celebration: "https://images.pexels.com/photos/31825806/pexels-photo-31825806/free-photo-of-victorious-soccer-team-celebrating-with-trophy.jpeg?auto=compress&cs=tinysrgb&w=400",
  coach: "https://images.pexels.com/photos/38615431/pexels-photo-38615431/free-photo-of-soccer-coach-strategizing-with-team-on-bench.jpeg?auto=compress&cs=tinysrgb&w=400",
};

// Logo real de cada liga (FotMob) — se usa como ícono de "Liga"/"Copa
// Nacional" en la vitrina de trofeos. La Champions League representa
// genéricamente el trofeo continental para cualquier club.
export const LEAGUE_LOGOS: Record<string, string> = {
  "Liga MX": "https://images.fotmob.com/image_resources/logo/leaguelogo/230.png",
  MLS: "https://images.fotmob.com/image_resources/logo/leaguelogo/130.png",
  "Brasileirão": "https://images.fotmob.com/image_resources/logo/leaguelogo/268.png",
  Eredivisie: "https://images.fotmob.com/image_resources/logo/leaguelogo/57.png",
  "Liga Portugal": "https://images.fotmob.com/image_resources/logo/leaguelogo/61.png",
  LaLiga: "https://images.fotmob.com/image_resources/logo/leaguelogo/87.png",
  "Premier League": "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png",
  Bundesliga: "https://images.fotmob.com/image_resources/logo/leaguelogo/54.png",
  "Serie A": "https://images.fotmob.com/image_resources/logo/leaguelogo/55.png",
  "Ligue 1": "https://images.fotmob.com/image_resources/logo/leaguelogo/53.png",
};
export const CONTINENTAL_CUP_LOGO = "https://images.fotmob.com/image_resources/logo/leaguelogo/42.png"; // Champions League

export interface CareerClub {
  id: string;
  name: string;
  league: string;
  country: string;
  tier: 1 | 2 | 3 | 4 | 5; // 1 = filial/mitad de tabla, 5 = gigante continental
  logoUrl: string;
}

export const CLUBS: CareerClub[] = [
  // Liga MX (México)
  { id: "tijuana", name: "Tijuana", league: "Liga MX", country: "México", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/162418.png" },
  { id: "puebla", name: "Puebla", league: "Liga MX", country: "México", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7847.png" },
  { id: "queretaro", name: "Querétaro", league: "Liga MX", country: "México", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/1943.png" },
  { id: "atlante", name: "Atlante", league: "Liga MX", country: "México", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/1942.png" },
  { id: "san-luis", name: "Atlético San Luis", league: "Liga MX", country: "México", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6358.png" },
  { id: "necaxa", name: "Necaxa", league: "Liga MX", country: "México", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/1842.png" },
  { id: "juarez", name: "FC Juárez", league: "Liga MX", country: "México", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/649424.png" },
  { id: "leon", name: "León", league: "Liga MX", country: "México", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/1841.png" },
  { id: "santos-laguna", name: "Santos Laguna", league: "Liga MX", country: "México", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7857.png" },
  { id: "atlas", name: "Atlas", league: "Liga MX", country: "México", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6577.png" },
  { id: "toluca", name: "Toluca", league: "Liga MX", country: "México", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6618.png" },
  { id: "cruz-azul", name: "Cruz Azul", league: "Liga MX", country: "México", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6578.png" },
  { id: "pachuca", name: "Pachuca", league: "Liga MX", country: "México", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7848.png" },
  { id: "pumas", name: "Pumas UNAM", league: "Liga MX", country: "México", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/1946.png" },
  { id: "chivas", name: "Chivas", league: "Liga MX", country: "México", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7807.png" },
  { id: "america", name: "Club América", league: "Liga MX", country: "México", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6576.png" },
  { id: "monterrey", name: "Monterrey", league: "Liga MX", country: "México", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7849.png" },
  { id: "tigres", name: "Tigres UANL", league: "Liga MX", country: "México", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8561.png" },

  // MLS (Estados Unidos)
  { id: "colorado", name: "Colorado Rapids", league: "MLS", country: "Estados Unidos", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8314.png" },
  { id: "dc-united", name: "DC United", league: "MLS", country: "Estados Unidos", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6602.png" },
  { id: "nashville", name: "Nashville SC", league: "MLS", country: "Estados Unidos", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/915807.png" },
  { id: "chicago-fire", name: "Chicago Fire", league: "MLS", country: "Estados Unidos", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6397.png" },
  { id: "toronto-fc", name: "Toronto FC", league: "MLS", country: "Estados Unidos", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/56453.png" },
  { id: "seattle", name: "Seattle Sounders", league: "MLS", country: "Estados Unidos", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/130394.png" },
  { id: "orlando-city", name: "Orlando City", league: "MLS", country: "Estados Unidos", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/267810.png" },
  { id: "rsl", name: "Real Salt Lake", league: "MLS", country: "Estados Unidos", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6606.png" },
  { id: "la-galaxy", name: "LA Galaxy", league: "MLS", country: "Estados Unidos", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6637.png" },
  { id: "lafc", name: "LAFC", league: "MLS", country: "Estados Unidos", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/867280.png" },
  { id: "inter-miami", name: "Inter Miami", league: "MLS", country: "Estados Unidos", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/960720.png" },

  // Brasileirão (Brasil)
  { id: "coritiba", name: "Coritiba", league: "Brasileirão", country: "Brasil", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9767.png" },
  { id: "vitoria-ba", name: "Vitória", league: "Brasileirão", country: "Brasil", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7733.png" },
  { id: "bahia", name: "Bahia", league: "Brasileirão", country: "Brasil", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7877.png" },
  { id: "fluminense", name: "Fluminense", league: "Brasileirão", country: "Brasil", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9863.png" },
  { id: "cruzeiro", name: "Cruzeiro", league: "Brasileirão", country: "Brasil", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9781.png" },
  { id: "botafogo", name: "Botafogo", league: "Brasileirão", country: "Brasil", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8517.png" },
  { id: "atletico-mg", name: "Atlético Mineiro", league: "Brasileirão", country: "Brasil", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10272.png" },
  { id: "gremio", name: "Grêmio", league: "Brasileirão", country: "Brasil", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9769.png" },
  { id: "internacional", name: "Internacional", league: "Brasileirão", country: "Brasil", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8702.png" },
  { id: "sao-paulo", name: "São Paulo", league: "Brasileirão", country: "Brasil", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10277.png" },
  { id: "santos-fc", name: "Santos FC", league: "Brasileirão", country: "Brasil", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8514.png" },
  { id: "corinthians", name: "Corinthians", league: "Brasileirão", country: "Brasil", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9808.png" },
  { id: "palmeiras", name: "Palmeiras", league: "Brasileirão", country: "Brasil", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10283.png" },
  { id: "flamengo", name: "Flamengo", league: "Brasileirão", country: "Brasil", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9770.png" },

  // Eredivisie (Países Bajos)
  { id: "fortuna-sittard", name: "Fortuna Sittard", league: "Eredivisie", country: "Países Bajos", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6422.png" },
  { id: "go-ahead-eagles", name: "Go Ahead Eagles", league: "Eredivisie", country: "Países Bajos", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/6433.png" },
  { id: "utrecht", name: "FC Utrecht", league: "Eredivisie", country: "Países Bajos", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9908.png" },
  { id: "groningen", name: "FC Groningen", league: "Eredivisie", country: "Países Bajos", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8674.png" },
  { id: "twente", name: "FC Twente", league: "Eredivisie", country: "Países Bajos", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8611.png" },
  { id: "az", name: "AZ Alkmaar", league: "Eredivisie", country: "Países Bajos", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10229.png" },
  { id: "feyenoord", name: "Feyenoord", league: "Eredivisie", country: "Países Bajos", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10235.png" },
  { id: "psv", name: "PSV Eindhoven", league: "Eredivisie", country: "Países Bajos", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8640.png" },
  { id: "ajax", name: "Ajax", league: "Eredivisie", country: "Países Bajos", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8593.png" },

  // Liga Portugal
  { id: "rio-ave", name: "Rio Ave", league: "Liga Portugal", country: "Portugal", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7841.png" },
  { id: "estoril", name: "Estoril", league: "Liga Portugal", country: "Portugal", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7842.png" },
  { id: "moreirense", name: "Moreirense", league: "Liga Portugal", country: "Portugal", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8348.png" },
  { id: "gil-vicente", name: "Gil Vicente", league: "Liga Portugal", country: "Portugal", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9764.png" },
  { id: "vitoria-sc", name: "Vitória de Guimarães", league: "Liga Portugal", country: "Portugal", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/7844.png" },
  { id: "braga", name: "Braga", league: "Liga Portugal", country: "Portugal", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10264.png" },
  { id: "porto", name: "FC Porto", league: "Liga Portugal", country: "Portugal", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9773.png" },
  { id: "benfica", name: "Benfica", league: "Liga Portugal", country: "Portugal", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9772.png" },
  { id: "sporting", name: "Sporting CP", league: "Liga Portugal", country: "Portugal", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9768.png" },

  // LaLiga (España)
  { id: "osasuna", name: "Osasuna", league: "LaLiga", country: "España", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8371.png" },
  { id: "alaves", name: "Deportivo Alavés", league: "LaLiga", country: "España", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9866.png" },
  { id: "getafe", name: "Getafe", league: "LaLiga", country: "España", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8305.png" },
  { id: "espanyol", name: "Espanyol", league: "LaLiga", country: "España", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8558.png" },
  { id: "rayo", name: "Rayo Vallecano", league: "LaLiga", country: "España", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8370.png" },
  { id: "celta", name: "Celta de Vigo", league: "LaLiga", country: "España", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9910.png" },
  { id: "betis", name: "Real Betis", league: "LaLiga", country: "España", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8603.png" },
  { id: "real-sociedad", name: "Real Sociedad", league: "LaLiga", country: "España", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8560.png" },
  { id: "villarreal", name: "Villarreal", league: "LaLiga", country: "España", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10205.png" },
  { id: "athletic", name: "Athletic Club", league: "LaLiga", country: "España", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8315.png" },
  { id: "sevilla", name: "Sevilla", league: "LaLiga", country: "España", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8302.png" },
  { id: "atletico-madrid", name: "Atlético de Madrid", league: "LaLiga", country: "España", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9906.png" },
  { id: "barcelona", name: "Barcelona", league: "LaLiga", country: "España", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8634.png" },
  { id: "real-madrid", name: "Real Madrid", league: "LaLiga", country: "España", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png" },

  // Premier League (Inglaterra)
  { id: "coventry", name: "Coventry City", league: "Premier League", country: "Inglaterra", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8669.png" },
  { id: "hull", name: "Hull City", league: "Premier League", country: "Inglaterra", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8667.png" },
  { id: "ipswich", name: "Ipswich Town", league: "Premier League", country: "Inglaterra", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9902.png" },
  { id: "sunderland", name: "Sunderland", league: "Premier League", country: "Inglaterra", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8472.png" },
  { id: "leeds", name: "Leeds United", league: "Premier League", country: "Inglaterra", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8463.png" },
  { id: "brentford", name: "Brentford", league: "Premier League", country: "Inglaterra", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9937.png" },
  { id: "crystal-palace", name: "Crystal Palace", league: "Premier League", country: "Inglaterra", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9826.png" },
  { id: "fulham", name: "Fulham", league: "Premier League", country: "Inglaterra", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9879.png" },
  { id: "everton", name: "Everton", league: "Premier League", country: "Inglaterra", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8668.png" },
  { id: "bournemouth", name: "Bournemouth", league: "Premier League", country: "Inglaterra", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8678.png" },
  { id: "brighton", name: "Brighton", league: "Premier League", country: "Inglaterra", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10204.png" },
  { id: "aston-villa", name: "Aston Villa", league: "Premier League", country: "Inglaterra", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10252.png" },
  { id: "forest", name: "Nottingham Forest", league: "Premier League", country: "Inglaterra", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10203.png" },
  { id: "newcastle", name: "Newcastle United", league: "Premier League", country: "Inglaterra", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10261.png" },
  { id: "tottenham", name: "Tottenham Hotspur", league: "Premier League", country: "Inglaterra", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8586.png" },
  { id: "chelsea", name: "Chelsea", league: "Premier League", country: "Inglaterra", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png" },
  { id: "man-utd", name: "Manchester United", league: "Premier League", country: "Inglaterra", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10260.png" },
  { id: "arsenal", name: "Arsenal", league: "Premier League", country: "Inglaterra", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9825.png" },
  { id: "liverpool", name: "Liverpool", league: "Premier League", country: "Inglaterra", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8650.png" },
  { id: "man-city", name: "Manchester City", league: "Premier League", country: "Inglaterra", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8456.png" },

  // Bundesliga (Alemania)
  { id: "elversberg", name: "Elversberg", league: "Bundesliga", country: "Alemania", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8232.png" },
  { id: "paderborn", name: "Paderborn", league: "Bundesliga", country: "Alemania", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8460.png" },
  { id: "hamburgo", name: "Hamburger SV", league: "Bundesliga", country: "Alemania", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9790.png" },
  { id: "augsburg", name: "Augsburg", league: "Bundesliga", country: "Alemania", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8406.png" },
  { id: "mainz", name: "Mainz 05", league: "Bundesliga", country: "Alemania", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9905.png" },
  { id: "werder", name: "Werder Bremen", league: "Bundesliga", country: "Alemania", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8697.png" },
  { id: "freiburg", name: "Friburgo", league: "Bundesliga", country: "Alemania", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8358.png" },
  { id: "gladbach", name: "Borussia Mönchengladbach", league: "Bundesliga", country: "Alemania", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9788.png" },
  { id: "frankfurt", name: "Eintracht Frankfurt", league: "Bundesliga", country: "Alemania", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9810.png" },
  { id: "leipzig", name: "RB Leipzig", league: "Bundesliga", country: "Alemania", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/178475.png" },
  { id: "leverkusen", name: "Bayer Leverkusen", league: "Bundesliga", country: "Alemania", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8178.png" },
  { id: "dortmund", name: "Borussia Dortmund", league: "Bundesliga", country: "Alemania", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9789.png" },
  { id: "bayern", name: "Bayern Múnich", league: "Bundesliga", country: "Alemania", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9823.png" },

  // Serie A (Italia)
  { id: "cagliari", name: "Cagliari", league: "Serie A", country: "Italia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8529.png" },
  { id: "genoa", name: "Genoa", league: "Serie A", country: "Italia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10233.png" },
  { id: "lecce", name: "Lecce", league: "Serie A", country: "Italia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9888.png" },
  { id: "parma", name: "Parma", league: "Serie A", country: "Italia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/10167.png" },
  { id: "torino", name: "Torino", league: "Serie A", country: "Italia", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9804.png" },
  { id: "udinese", name: "Udinese", league: "Serie A", country: "Italia", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8600.png" },
  { id: "fiorentina", name: "Fiorentina", league: "Serie A", country: "Italia", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8535.png" },
  { id: "bologna", name: "Bologna", league: "Serie A", country: "Italia", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9857.png" },
  { id: "atalanta", name: "Atalanta", league: "Serie A", country: "Italia", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8524.png" },
  { id: "roma", name: "Roma", league: "Serie A", country: "Italia", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8686.png" },
  { id: "milan", name: "Milan", league: "Serie A", country: "Italia", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8564.png" },
  { id: "napoli", name: "Napoli", league: "Serie A", country: "Italia", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9875.png" },
  { id: "juventus", name: "Juventus", league: "Serie A", country: "Italia", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9885.png" },
  { id: "inter", name: "Inter de Milán", league: "Serie A", country: "Italia", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8636.png" },

  // Ligue 1 (Francia)
  { id: "le-havre", name: "Le Havre", league: "Ligue 1", country: "Francia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9746.png" },
  { id: "angers", name: "Angers", league: "Ligue 1", country: "Francia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8121.png" },
  { id: "auxerre", name: "Auxerre", league: "Ligue 1", country: "Francia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8583.png" },
  { id: "toulouse", name: "Toulouse", league: "Ligue 1", country: "Francia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9941.png" },
  { id: "lorient", name: "Lorient", league: "Ligue 1", country: "Francia", tier: 1, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8689.png" },
  { id: "strasbourg", name: "Strasbourg", league: "Ligue 1", country: "Francia", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9848.png" },
  { id: "rennes", name: "Rennes", league: "Ligue 1", country: "Francia", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9851.png" },
  { id: "nice", name: "Nice", league: "Ligue 1", country: "Francia", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9831.png" },
  { id: "lens", name: "Lens", league: "Ligue 1", country: "Francia", tier: 2, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8588.png" },
  { id: "lille", name: "Lille", league: "Ligue 1", country: "Francia", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8639.png" },
  { id: "lyon", name: "Lyon", league: "Ligue 1", country: "Francia", tier: 3, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9748.png" },
  { id: "marseille", name: "Marsella", league: "Ligue 1", country: "Francia", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/8592.png" },
  { id: "monaco", name: "Mónaco", league: "Ligue 1", country: "Francia", tier: 4, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9829.png" },
  { id: "psg", name: "Paris Saint-Germain", league: "Ligue 1", country: "Francia", tier: 5, logoUrl: "https://images.fotmob.com/image_resources/logo/teamlogo/9847.png" },
];

export function clubsForTier(tier: number, excludeIds: string[] = []): CareerClub[] {
  const pool = CLUBS.filter((c) => Math.abs(c.tier - tier) <= 1 && !excludeIds.includes(c.id));
  return pool.length >= 3 ? pool : CLUBS.filter((c) => !excludeIds.includes(c.id));
}

// Prioriza SIEMPRE clubes del mismo país que el jugador (préstamos, mercado,
// regreso, declive…). Solo cae a "cualquier país" cuando esa selección no
// tiene suficientes clubes reales en los datos de FotMob.
export function clubsForCountry(country: string, tier: number, excludeIds: string[] = []): CareerClub[] {
  const local = CLUBS.filter((c) => c.country === country && Math.abs(c.tier - tier) <= 1 && !excludeIds.includes(c.id));
  return local.length >= 2 ? local : clubsForTier(tier, excludeIds);
}

// Solo clubes humildes (tier 1) para la oferta de cantera: nadie empieza en
// un gigante — eso hay que ganárselo con años y buen rendimiento.
export function canteraClubs(country: string): CareerClub[] {
  const local = CLUBS.filter((c) => c.country === country && c.tier === 1);
  return local.length >= 2 ? local : CLUBS.filter((c) => c.tier === 1);
}

export function tierFromOvr(ovr: number): number {
  if (ovr >= 86) return 5;
  if (ovr >= 78) return 4;
  if (ovr >= 68) return 3;
  if (ovr >= 58) return 2;
  return 1;
}

// OVR de plantilla "esperado" en cada tier — sirve para comparar el nivel
// del jugador contra el nivel real del club (ver simulateStage/maybeTrophy
// en careerEngine.ts): si tu club te queda grande, juegas menos y ganas
// menos títulos; si te queda chico, eres indiscutible.
export function expectedOvrForTier(tier: number): number {
  return [0, 52, 62, 71, 80, 89][tier] ?? 52;
}

export function findClub(id: string): CareerClub | undefined {
  return CLUBS.find((c) => c.id === id);
}
