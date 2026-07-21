// Reglas económicas compartidas. Todo el dinero del juego está en EUROS:
// el precio de cada jugador es su valor de mercado real de FotMob (transferValue),
// y el presupuesto/cláusulas/sobres viven en la misma escala.
export const PROTECTION_DAYS = 7;
export const CLAUSE_MULTIPLIER = 3; // cláusula inicial = valor de mercado * 3
export const STARTING_COINS = 50_000_000; // presupuesto inicial de cada mánager (€50M)
export const COINS_PER_POINT = 100_000; // premio al cerrar jornada: €100K por punto fantasy

export function protectionExpiry(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + PROTECTION_DAYS);
  return d;
}

export function initialClause(basePrice: number): number {
  return Math.max(basePrice, Math.round(basePrice * CLAUSE_MULTIPLIER));
}

// Valor de mercado estimado (€) cuando FotMob no publica transferValue:
// inversa de la curva overall→valor del seed (overall = 10.4·log10(valor) + 7.4),
// redondeada a múltiplos de €50K. Ej.: 64 → ~€250K, 80 → ~€9.5M, 94 → ~€210M.
export function valueFromOverall(overall: number): number {
  const v = Math.pow(10, (overall - 7.4) / 10.4);
  return Math.max(100_000, Math.round(v / 50_000) * 50_000);
}
