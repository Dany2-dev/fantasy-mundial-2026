import { Player } from "../types";

// Fuente única de las formaciones soportadas: la usan tanto el editor de
// "Mi Once" (Squad.tsx) como el preview de Inicio, para que nunca queden
// desincronizados.
export const FORMATIONS: Record<string, ["POR", number, number, number]> = {
  "4-4-2": ["POR", 4, 4, 2],
  "4-3-3": ["POR", 4, 3, 3],
  "3-5-2": ["POR", 3, 5, 2],
};

export function formationRows(formation: string): [Player["position"], number][] {
  const [, def, med, del] = FORMATIONS[formation] ?? FORMATIONS["4-4-2"];
  return [
    ["POR", 1],
    ["DEF", def],
    ["MED", med],
    ["DEL", del],
  ];
}
