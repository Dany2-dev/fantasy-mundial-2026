import { interpolate } from "remotion";

interface TearFlashProps {
  progress: number; // 0-1
}

// Destello blanco/dorado breve cuando el sobre se rasga.
export default function TearFlash({ progress }: TearFlashProps) {
  if (progress <= 0) return null;
  const opacity = interpolate(progress, [0, 0.3, 1], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(progress, [0, 1], [0.6, 2.2]);

  return (
    <div
      style={{
        position: "absolute",
        width: 260,
        height: 260,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(240,194,75,0.6) 45%, transparent 75%)",
        opacity,
        transform: `scale(${scale})`,
        pointerEvents: "none",
      }}
    />
  );
}
