import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import Burst from "./components/Burst";
import Glow from "./components/Glow";
import LightRays from "./components/LightRays";
import Particles from "./components/Particles";
import TearFlash from "./components/TearFlash";
import { TrophyGlyph } from "../components/TrophyIcons";
import { TrophyIcon } from "../lib/careerTrophies";

export const TROPHY_REVEAL_FPS = 30;
export const TROPHY_REVEAL_WIDTH = 360;
export const TROPHY_REVEAL_HEIGHT = 320;
export const TROPHY_REVEAL_DURATION = 100; // ~3.3s

const FLASH_END = 14;
const BADGE_START = 8;

export interface TrophyRevealProps {
  logoUrl?: string;
  icon?: TrophyIcon;
  color: string; // acento: dorado para títulos/individuales, azul para hitos
}

// Reveal de trofeo: mismo lenguaje visual que el teaser de sobres (Glow +
// Particles + LightRays + Burst + TearFlash), reescalado para un logo/ícono
// en vez de una carta. El nombre del premio y el club se muestran FUERA de
// esta composición (en TrophyCelebration.tsx) — si el navegador congela los
// frames, el texto sigue siendo legible aunque el badge no termine de "entrar".
export default function TrophyReveal({ logoUrl, icon, color }: TrophyRevealProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flashProgress = interpolate(frame, [0, FLASH_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const burstProgress = interpolate(frame, [BADGE_START, BADGE_START + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const raysOpacity = interpolate(frame, [0, 20, 90, TROPHY_REVEAL_DURATION], [0, 0.5, 0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowOpacity = interpolate(frame, [0, 20], [0, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const badgeScale = spring({
    frame: frame - BADGE_START,
    fps,
    config: { damping: 11, stiffness: 140, mass: 0.9 },
  });
  const badgeRotate = interpolate(frame, [BADGE_START, BADGE_START + 18], [-14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.6)),
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Glow size={260} color={color} opacity={glowOpacity} />
      <Particles count={22} color={`${color}88`} />
      {raysOpacity > 0.01 && <LightRays opacity={raysOpacity} color={color} />}

      <div
        style={{
          transform: `scale(${badgeScale}) rotate(${badgeRotate}deg)`,
          width: 148,
          height: 148,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.25) 70%)`,
          boxShadow: `0 0 40px 4px ${color}66`,
        }}
      >
        {logoUrl ? (
          <Img src={logoUrl} style={{ width: 96, height: 96, objectFit: "contain" }} />
        ) : (
          <div style={{ color, width: 84, height: 84 }}>
            <TrophyGlyph icon={icon ?? "trophy"} size={84} />
          </div>
        )}
      </div>

      {burstProgress > 0 && <Burst progress={burstProgress} count={26} maxDistance={150} size={4.5} color={color} />}
      <TearFlash progress={flashProgress} />
    </AbsoluteFill>
  );
}
