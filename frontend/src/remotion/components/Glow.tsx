import { CSSProperties } from "react";

interface GlowProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: CSSProperties;
}

// Orbe de luz radial reusable: el "bloom" del set (aura de rareza, halo del
// escudo de la liga en el cierre, etc.)
export default function Glow({ size = 400, color = "#3ecf7a", opacity = 0.9, style }: GlowProps) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
