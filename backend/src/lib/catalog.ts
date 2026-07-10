// Catálogo curado de competencias reales de FotMob que el usuario puede elegir
// al crear su liga de fantasy. `priority` ordena el selector (menor = arriba).
// `isCurrent` marca lo que está en temporada ahora mismo (el Mundial mientras dure).
// `groupStageOnly` solo aplica al Mundial (filtra selecciones de repechaje).
export interface CatalogEntry {
  fotmobId: number;
  fallbackName: string; // por si FotMob no devuelve nombre
  type: "league" | "cup";
  priority: number;
  isCurrent?: boolean;
  groupStageOnly?: boolean;
}

export const COMPETITIONS: CatalogEntry[] = [
  { fotmobId: 77, fallbackName: "Copa Mundial", type: "cup", priority: 1, isCurrent: true, groupStageOnly: true },
  { fotmobId: 230, fallbackName: "Liga MX", type: "league", priority: 2 },
  { fotmobId: 47, fallbackName: "Premier League", type: "league", priority: 3 },
  { fotmobId: 87, fallbackName: "LaLiga", type: "league", priority: 4 },
  { fotmobId: 55, fallbackName: "Serie A", type: "league", priority: 5 },
  { fotmobId: 54, fallbackName: "Bundesliga", type: "league", priority: 6 },
  { fotmobId: 53, fallbackName: "Ligue 1", type: "league", priority: 7 },
  { fotmobId: 42, fallbackName: "UEFA Champions League", type: "cup", priority: 8 },
  { fotmobId: 130, fallbackName: "MLS", type: "league", priority: 9 },
  { fotmobId: 61, fallbackName: "Liga Portugal", type: "league", priority: 10 },
  { fotmobId: 57, fallbackName: "Eredivisie", type: "league", priority: 11 },
  { fotmobId: 268, fallbackName: "Brasileirão", type: "league", priority: 12 },
];
