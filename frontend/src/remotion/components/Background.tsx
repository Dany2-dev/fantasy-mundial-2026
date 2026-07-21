import { AbsoluteFill } from "remotion";

// Cancha de fútbol oscura y cinematográfica.
export default function Background() {
  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 45%, #173f2b 0%, #092419 60%, #03100b 100%)",
      }}
    >
      <svg
        viewBox="0 0 1280 720"
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
        }}
      >
        <defs>
          <linearGradient
            id="fieldGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#17633c" />
            <stop offset="50%" stopColor="#0e4b2c" />
            <stop offset="100%" stopColor="#07351e" />
          </linearGradient>

          <radialGradient id="fieldLight">
            <stop offset="0%" stopColor="#77ffad" stopOpacity="0.12" />
            <stop offset="65%" stopColor="#1d8d50" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id="fieldClip">
            <rect x="65" y="45" width="1150" height="630" rx="12" />
          </clipPath>
        </defs>

        {/* Césped */}
        <rect
          x="65"
          y="45"
          width="1150"
          height="630"
          rx="12"
          fill="url(#fieldGradient)"
        />

        {/* Franjas del césped */}
        <g clipPath="url(#fieldClip)">
          {Array.from({ length: 10 }).map((_, index) => (
            <rect
              key={index}
              x={65 + index * 115}
              y="45"
              width="115"
              height="630"
              fill={
                index % 2 === 0
                  ? "rgba(255,255,255,0.025)"
                  : "rgba(0,0,0,0.055)"
              }
            />
          ))}

          {/* Luz central */}
          <ellipse
            cx="640"
            cy="330"
            rx="500"
            ry="360"
            fill="url(#fieldLight)"
          />
        </g>

        {/* Líneas de la cancha */}
        <g
          fill="none"
          stroke="rgba(225,255,235,0.42)"
          strokeWidth="4"
          filter="url(#lineGlow)"
        >
          {/* Perímetro */}
          <rect
            x="65"
            y="45"
            width="1150"
            height="630"
            rx="12"
          />

          {/* Línea central */}
          <line x1="640" y1="45" x2="640" y2="675" />

          {/* Círculo central */}
          <circle cx="640" cy="360" r="92" />

          {/* Área izquierda */}
          <rect x="65" y="178" width="205" height="364" />

          {/* Área pequeña izquierda */}
          <rect x="65" y="270" width="88" height="180" />

          {/* Portería izquierda */}
          <rect x="39" y="302" width="26" height="116" />

          {/* Área derecha */}
          <rect x="1010" y="178" width="205" height="364" />

          {/* Área pequeña derecha */}
          <rect x="1127" y="270" width="88" height="180" />

          {/* Portería derecha */}
          <rect x="1215" y="302" width="26" height="116" />

          {/* Semicírculo izquierdo */}
          <path d="M270 294 A78 78 0 0 1 270 426" />

          {/* Semicírculo derecho */}
          <path d="M1010 294 A78 78 0 0 0 1010 426" />

          {/* Esquinas */}
          <path d="M65 70 A25 25 0 0 0 90 45" />
          <path d="M1190 45 A25 25 0 0 0 1215 70" />
          <path d="M65 650 A25 25 0 0 1 90 675" />
          <path d="M1190 675 A25 25 0 0 1 1215 650" />
        </g>

        {/* Puntos */}
        <g fill="rgba(235,255,240,0.65)">
          <circle cx="640" cy="360" r="6" />
          <circle cx="205" cy="360" r="5" />
          <circle cx="1075" cy="360" r="5" />
        </g>
      </svg>

      {/* Oscurece el centro para que la carta destaque */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.18) 52%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* Viñeta cinematográfica */}
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 190px 80px rgba(0,0,0,0.7)",
        }}
      />
    </AbsoluteFill>
  );
}