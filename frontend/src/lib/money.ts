// Formato de dinero del juego. Todo el dinero (presupuesto, precios, cláusulas)
// está en EUROS — el precio de cada jugador es su valor de mercado real de
// FotMob — y se muestra al estilo FotMob: €853K, €23.9M, €1.2B.
export function formatMoney(value: number | null | undefined): string {
  // Un importe que falta NO puede tumbar la página. Pasaba en producción
  // durante un despliegue: el front nuevo pedía un campo que el backend viejo
  // —todavía sin reiniciar— aún no mandaba, y `undefined.toLocaleString()`
  // reventaba la tabla de clasificación entera. El desfase entre front y back
  // es normal mientras los dos contenedores se reinician, así que el guardia va
  // aquí, en el único sitio por el que pasan todos los importes, y no repetido
  // en cada llamada.
  //
  // Devuelve "—" y no "€0" a propósito: cero es un dato, y afirmar que alguien
  // tiene cero cuando en realidad no lo sabemos sería mentir en pantalla.
  if (value == null || !Number.isFinite(value)) return "—";

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
