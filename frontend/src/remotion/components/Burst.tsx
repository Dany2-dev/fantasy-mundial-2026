import { random } from "remotion";

interface BurstProps {
  progress: number; // 0-1
  count?: number;
  color?: string;
  maxDistance?: number;
  size?: number;
}

// Partículas radiando desde el centro — se reusa tanto para las chispas del
// sobre temblando (radio chico) como para la explosión al rasgarse (radio
// grande), solo cambiando las props.
export default function Burst({ progress, count = 24, color = "#f0c24b", maxDistance = 140, size = 4 }: BurstProps) {
  if (progress <= 0) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + random(`burst-angle-${i}`) * 0.5;
        const speed = 0.6 + random(`burst-speed-${i}`) * 0.4;
        const dist = maxDistance * speed * progress;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const opacity = Math.max(0, 1 - progress * 1.1);
        const s = size * (1 - progress * 0.4);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: s,
              height: s,
              borderRadius: "50%",
              background: color,
              opacity,
              transform: `translate(${x - s / 2}px, ${y - s / 2}px)`,
              boxShadow: `0 0 ${s * 2}px ${color}`,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
}
