import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import Burst from "./components/Burst";
import Glow from "./components/Glow";

export const LUCK_WHEEL_FPS = 30;
export const LUCK_WHEEL_SIZE = 220;
export const LUCK_WHEEL_DURATION = 70; // ~2.3s: gira, frena, estalla

const START = -120; // grados: extremo izquierdo del arco
const END = 120; // grados: extremo derecho
const SWEEP = END - START;
const R = 78;
const CX = 100;
const CY = 104;
const SPIN_END = 46; // frame en que la aguja llega al valor final

function polar(value: number, radius: number) {
  const angle = (START + (value / 100) * SWEEP - 90) * (Math.PI / 180);
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function arcPath(from: number, to: number, radius: number) {
  const a = polar(from, radius);
  const b = polar(to, radius);
  const large = ((to - from) / 100) * SWEEP > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${large} 1 ${b.x} ${b.y}`;
}

export interface LuckWheelProps {
  chance: number; // 0-100: tamaño de la zona verde
  rolled: number; // 0-100: dónde se frena la aguja
  success: boolean;
}

// Ruleta de la suerte, en Remotion: la aguja da un par de vueltas de más
// (siempre se "pasa" del valor real y regresa) antes de clavarse en el
// resultado — la sobre-rotación es lo que hace que un frenado instantáneo se
// LEA como una tirada real y no como un salto. Al frenar, estalla un burst
// del color del resultado. El texto del resultado vive FUERA de esta
// composición (en LuckGauge.tsx): si el navegador congela los frames, la
// aguja puede quedar quieta, pero el veredicto sigue siendo legible.
export default function LuckWheel({ chance, rolled, success }: LuckWheelProps) {
  const frame = useCurrentFrame();
  const finalAngle = START + (rolled / 100) * SWEEP;

  // Gira 2.4 vueltas de más y se pasa un poco del ángulo final antes de
  // volver — ease-out fuerte para que la frenada se sienta con peso.
  const overshoot = finalAngle + 26;
  const spinTo = interpolate(frame, [0, SPIN_END * 0.72], [finalAngle - 360 * 2.4, overshoot], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const settle = interpolate(frame, [SPIN_END * 0.72, SPIN_END], [overshoot, finalAngle], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const needleAngle = frame < SPIN_END * 0.72 ? spinTo : settle;

  const burstProgress = interpolate(frame, [SPIN_END, SPIN_END + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowOpacity = interpolate(frame, [SPIN_END - 4, SPIN_END + 10], [0, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const resultColor = success ? "#3ecf7a" : "#ff6b7a";

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {glowOpacity > 0.01 && <Glow size={130} color={resultColor} opacity={glowOpacity} />}

      <svg viewBox="0 0 200 150" width={LUCK_WHEEL_SIZE} height={LUCK_WHEEL_SIZE * 0.75}>
        <path d={arcPath(0, chance, R)} fill="none" stroke="#3ecf7a" strokeWidth={11} strokeLinecap="round" />
        <path d={arcPath(chance, 100, R)} fill="none" stroke="#ff6b7a" strokeWidth={11} strokeLinecap="round" opacity={0.75} />
        <g transform={`rotate(${needleAngle} ${CX} ${CY})`}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - R + 10} stroke="#f4f6fb" strokeWidth={4} strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r={7} fill="#f4f6fb" />
      </svg>

      {burstProgress > 0 && <Burst progress={burstProgress} count={18} maxDistance={70} size={3.5} color={resultColor} />}
    </AbsoluteFill>
  );
}
