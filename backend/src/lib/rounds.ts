// Mapeo de rondas del Mundial 2026 — módulo puro (sin Prisma).
// FotMob reporta la fase de grupos como round "1"|"2"|"3" y las eliminatorias
// como "1/16", "1/8", "1/4", "1/2", "bronze" y "final". Para el motor de
// jornadas (Gameweek.number) las convertimos a números consecutivos.

export const KNOCKOUT_ROUNDS: Record<string, { number: number; label: string; short: string }> = {
  "1/16": { number: 4, label: "Dieciseisavos de final", short: "16vos" },
  "1/8": { number: 5, label: "Octavos de final", short: "8vos" },
  "1/4": { number: 6, label: "Cuartos de final", short: "4tos" },
  "1/2": { number: 7, label: "Semifinales", short: "Semis" },
  bronze: { number: 8, label: "Tercer puesto", short: "3er" },
  final: { number: 9, label: "Final", short: "Final" },
};

// Convierte el round crudo de FotMob a nuestro número de jornada (o null).
export function roundNumberFor(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().trim();
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return n;
  return KNOCKOUT_ROUNDS[s]?.number ?? null;
}

// Etiqueta larga ("Jornada 2", "Dieciseisavos de final").
export function gwLabel(n: number): string {
  const k = Object.values(KNOCKOUT_ROUNDS).find((r) => r.number === n);
  return k ? k.label : `Jornada ${n}`;
}

// Etiqueta corta ("J2", "16vos", "Semis").
export function gwShort(n: number): string {
  const k = Object.values(KNOCKOUT_ROUNDS).find((r) => r.number === n);
  return k ? k.short : `J${n}`;
}
