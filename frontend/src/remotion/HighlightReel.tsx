import { AbsoluteFill, Sequence } from "remotion";
import Background from "./components/Background";
import Glow from "./components/Glow";
import HighlightPlayerCard from "./components/HighlightPlayerCard";
import Particles from "./components/Particles";
import { RARITY_COLOR } from "../lib/rarityColors";
import { Player, rarityOf } from "../types";

export const HIGHLIGHT_FPS = 30;
export const HIGHLIGHT_WIDTH = 1280;
export const HIGHLIGHT_HEIGHT = 720;

// ~1s por jugador: lo suficientemente lento para leer rating, nombre y club.
const PER_PLAYER_FRAMES = 60;

export function highlightDuration(playerCount: number) {
  return Math.max(1, playerCount) * PER_PLAYER_FRAMES;
}

export interface HighlightReelProps {
  players: Player[];
}

// Loop simple con TODA la colección del club (no solo el 11 titular): cada
// jugador entra, se lee su carta y pasa al siguiente. El <Player> de
// @remotion/player que lo embebe en Home ya tiene `loop`, así que al llegar
// al final vuelve a arrancar solo.
export default function HighlightReel({ players }: HighlightReelProps) {
  return (
    <AbsoluteFill>
      {players.map((p, i) => (
        <Sequence key={p.id} from={i * PER_PLAYER_FRAMES} durationInFrames={PER_PLAYER_FRAMES}>
          <PlayerScene player={p} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function PlayerScene({ player }: { player: Player }) {
  const glow = RARITY_COLOR[rarityOf(player.rating)];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Background />
      <Particles count={16} />
      <Glow size={460} color={glow} opacity={0.4} />
      <HighlightPlayerCard player={player} />
    </AbsoluteFill>
  );
}
