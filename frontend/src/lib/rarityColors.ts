import { Rarity } from "../types";

// Color de acento por rango: fuente única para el aura de PackOpeningModal y
// el brillo por jugador del video de HighlightReel, para que ambos coincidan.
export const RARITY_COLOR: Record<Rarity, string> = {
  bronce: "#c97b3f",
  plata: "#c7cdd6",
  oro: "#f0c24b",
  legendario: "#a06bff",
};
