// Definición SVG global del recorte "escudo FUT": curvas reales (no un polígono
// de aristas rectas), montada una sola vez en la raíz de la app. Todas las
// PlayerCard referencian este mismo clip-path vía `clip-path: url(#futShield)`.
export default function CardClipDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="futShield" clipPathUnits="objectBoundingBox">
          <path
            d="
              M 0 0.17
              C 0 0.09 0.02 0.03 0.09 0.02
              C 0.16 0.005 0.22 0 0.3 0
              L 0.7 0
              C 0.78 0 0.84 0.005 0.91 0.02
              C 0.98 0.03 1 0.09 1 0.17
              L 1 0.76
              C 1 0.83 0.97 0.88 0.91 0.91
              L 0.58 0.985
              C 0.53 1 0.47 1 0.42 0.985
              L 0.09 0.91
              C 0.03 0.88 0 0.83 0 0.76
              Z
            "
          />
        </clipPath>
      </defs>
    </svg>
  );
}
