// Cuando ganás un título (equipo) o un premio (individual), esto lo anuncia
// en grande: un reveal de Remotion (mismo lenguaje visual que el teaser de
// sobres) más el nombre del premio y el club en texto plano — el texto NUNCA
// depende de que la animación termine, así que si el navegador congela los
// frames (pestaña en segundo plano) el jugador igual se entera de qué ganó.
import { Player } from "@remotion/player";
import { useEffect, useState } from "react";
import { trophyByName } from "../lib/careerTrophies";
import TrophyReveal, {
  TROPHY_REVEAL_DURATION,
  TROPHY_REVEAL_FPS,
  TROPHY_REVEAL_HEIGHT,
  TROPHY_REVEAL_WIDTH,
} from "../remotion/TrophyReveal";
import styles from "./TrophyCelebration.module.css";

export interface CelebrationItem {
  label: string;
  club: string;
  league?: string;
  kind: "team" | "individual";
}

const AUTO_ADVANCE_MS = 4200;

export default function TrophyCelebration({ items, onDone }: { items: CelebrationItem[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  const isLast = index >= items.length - 1;

  function next() {
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  }

  useEffect(() => {
    const t = setTimeout(next, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!item) return null;
  const def = trophyByName(item.label, item.league);
  const color = item.kind === "individual" ? "#a06bff" : "#f0c24b";
  const heading = item.kind === "individual" ? `¡${item.label}!` : `¡Campeón de ${item.label}!`;

  return (
    <div className={styles.backdrop} onClick={next}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && (
          <span className={styles.counter}>
            {index + 1} / {items.length}
          </span>
        )}
        <div className={styles.playerWrap}>
          <Player
            key={index}
            component={TrophyReveal}
            inputProps={{ logoUrl: def.logoUrl, icon: def.icon, color }}
            durationInFrames={TROPHY_REVEAL_DURATION}
            fps={TROPHY_REVEAL_FPS}
            compositionWidth={TROPHY_REVEAL_WIDTH}
            compositionHeight={TROPHY_REVEAL_HEIGHT}
            style={{ width: "100%" }}
            controls={false}
            clickToPlay={false}
            initiallyMuted
            autoPlay
          />
        </div>

        <p className={styles.eyebrow}>{item.kind === "individual" ? "Premio individual" : "Título de equipo"}</p>
        <h2 className={styles.heading} style={{ color }}>
          {heading}
        </h2>
        <p className={styles.subtitle}>{item.club}</p>

        <button className={styles.continueBtn} onClick={next}>
          {isLast ? "Continuar" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
