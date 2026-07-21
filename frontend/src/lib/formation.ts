import { Player } from "../types";

// Once titular 4-3-3 (1 POR, 4 DEF, 3 MED, 3 DEL). Toma los mejores por
// posición; el resto de las cartas van a la banca.
// Compartido por Rivales (cancha de un rival) y el comparador de plantillas.
export const FORMATION: Record<"POR" | "DEF" | "MED" | "DEL", number> = { POR: 1, DEF: 4, MED: 3, DEL: 3 };

export function pickEleven<T extends Player>(cards: T[]): { starters: T[]; bench: T[] } {
  const sorted = [...cards].sort((a, b) => b.rating - a.rating);
  const starterIds = new Set<number>();
  const starters: T[] = [];
  (["POR", "DEF", "MED", "DEL"] as const).forEach((pos) => {
    sorted
      .filter((c) => c.position === pos)
      .slice(0, FORMATION[pos])
      .forEach((c) => {
        starters.push(c);
        starterIds.add(c.id);
      });
  });
  const bench = sorted.filter((c) => !starterIds.has(c.id));
  return { starters, bench };
}
