// Formato de dinero del juego. Todo el dinero (presupuesto, precios, cláusulas)
// está en EUROS — el precio de cada jugador es su valor de mercado real de
// FotMob — y se muestra al estilo FotMob: €853K, €23.9M, €1.2B.
export function formatMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `€${trim(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `€${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `€${trim(value / 1_000)}K`;
  return `€${value.toLocaleString("es-MX")}`;
}

// 1 decimal, sin ".0" (23.9M pero 24M, no 24.0M).
const trim = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};
