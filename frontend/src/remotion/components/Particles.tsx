import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";

interface ParticlesProps {
  count?: number;
  color?: string;
}

// Partículas flotando lento hacia arriba con brillo pulsante. Deterministas
// (semilla por índice vía `random()` de Remotion) para que el render sea
// idéntico en cada frame, sin depender de Math.random().
export default function Particles({ count = 36, color = "rgba(255,255,255,0.6)" }: ParticlesProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const seedX = random(`particle-x-${i}`);
        const seedY = random(`particle-y-${i}`);
        const seedSpeed = random(`particle-speed-${i}`);
        const seedSize = random(`particle-size-${i}`);
        const baseX = seedX * width;
        const baseY = seedY * height;
        const drift = interpolate(frame, [0, 360], [0, -50 - seedSpeed * 70]);
        const pulse = Math.sin((frame / 28 + seedSpeed * 10) * Math.PI);
        const opacity = interpolate(pulse, [-1, 1], [0.12, 0.55]);
        const size = 1.5 + seedSize * 2.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: baseX,
              top: baseY + drift,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity,
              filter: "blur(0.5px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}
