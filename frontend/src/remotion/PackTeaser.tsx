import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import Burst from "./components/Burst";
import Glow from "./components/Glow";
import HighlightPlayerCard from "./components/HighlightPlayerCard";
import LightRays from "./components/LightRays";
import Particles from "./components/Particles";
import SealedPack from "./components/SealedPack";
import TearFlash from "./components/TearFlash";
import { RARITY_COLOR } from "../lib/rarityColors";
import { Player } from "../types";

export const PACK_TEASER_FPS = 30;
export const PACK_TEASER_WIDTH = 480;
export const PACK_TEASER_HEIGHT = 480;
export const PACK_TEASER_DURATION = 210; // 7s — loop decorativo, no un video que alguien "ve completo"

const SHAKE_START = 45;
const TEAR_START = 90;
const TEAR_END = 108;
const BURST_START = 100;
const BURST_END = 140;
const CARD_START = 130;

export interface PackTeaserProps {
  packArt: string;
  card: Player;
}

function progressBetween(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

// Teaser de apertura de sobre para el feature block de "Sobres" del login:
// se cierra, tiembla, se rasga con un destello y suelta la carta. Todo
// dirigido por un único frame de referencia (sin Sequences anidados para
// las piezas simples) para no pelear con el scoping de useVideoConfig().
export default function PackTeaser({ packArt, card }: PackTeaserProps) {
  const frame = useCurrentFrame();

  const shakeProgress = progressBetween(frame, SHAKE_START, TEAR_START);
  const flashProgress = progressBetween(frame, TEAR_START, TEAR_START + 20);
  const burstProgress = progressBetween(frame, BURST_START, BURST_END);
  const raysOpacity = interpolate(frame, [30, 60, TEAR_START], [0, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowOpacity = interpolate(frame, [0, 40, TEAR_END], [0.15, 0.4, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const packOpacity = interpolate(frame, [0, TEAR_START, TEAR_END], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Glow size={340} color={RARITY_COLOR.oro} opacity={glowOpacity} />
      <Particles count={20} color="rgba(240, 194, 75, 0.55)" />

      {raysOpacity > 0.01 && <LightRays opacity={raysOpacity} color="#f0c24b" />}

      {packOpacity > 0.01 && (
        <div style={{ opacity: packOpacity }}>
          <SealedPack src={packArt} shakeProgress={shakeProgress} />
        </div>
      )}

      {shakeProgress > 0.3 && <Burst progress={shakeProgress} count={10} maxDistance={50} size={2.5} color="#fff3c4" />}

      <TearFlash progress={flashProgress} />

      <Burst progress={burstProgress} count={30} maxDistance={180} size={5} color={RARITY_COLOR.oro} />

      {frame >= CARD_START && (
        <Sequence from={CARD_START} durationInFrames={PACK_TEASER_DURATION - CARD_START}>
          <HighlightPlayerCard player={card} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}
