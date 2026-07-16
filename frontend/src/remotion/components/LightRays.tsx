import { useCurrentFrame } from "remotion";

interface LightRaysProps {
  opacity?: number;
  color?: string;
}

// Rayos de luz cónicos girando lento detrás del sobre.
export default function LightRays({ opacity = 0.5, color = "#f0c24b" }: LightRaysProps) {
  const frame = useCurrentFrame();
  const rotate = frame * 0.15;

  return (
    <div
      style={{
        position: "absolute",
        width: 500,
        height: 500,
        opacity,
        transform: `rotate(${rotate}deg)`,
        background: `conic-gradient(from 0deg, transparent 0deg, ${color}33 8deg, transparent 20deg, transparent 160deg, ${color}33 168deg, transparent 180deg, transparent 340deg, ${color}22 350deg, transparent 360deg)`,
        borderRadius: "50%",
        pointerEvents: "none",
      }}
    />
  );
}
