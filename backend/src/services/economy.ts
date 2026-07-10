// Reglas económicas compartidas: cláusula inicial y ventana de protección.
export const PROTECTION_DAYS = 7;
export const CLAUSE_MULTIPLIER = 3; // cláusula inicial = basePrice * 3

export function protectionExpiry(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + PROTECTION_DAYS);
  return d;
}

export function initialClause(basePrice: number): number {
  return Math.max(basePrice, Math.round(basePrice * CLAUSE_MULTIPLIER));
}
