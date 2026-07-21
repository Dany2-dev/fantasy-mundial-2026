import { interpolate, useCurrentFrame } from "remotion";

interface AnimatedCounterProps {
  value: number;
  startFrame?: number; // frame relativo al Sequence donde arranca el conteo
  durationInFrames?: number;
  decimals?: number;
  suffix?: string;
}

// Conteo numérico suave (0 -> value) reusado tanto en la carta de cada
// jugador (su rating) como en el panel de estadísticas.
export default function AnimatedCounter({
  value,
  startFrame = 0,
  durationInFrames = 20,
  decimals = 0,
  suffix = "",
}: AnimatedCounterProps) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const current = value * progress;
  return (
    <>
      {current.toFixed(decimals)}
      {suffix}
    </>
  );
}
