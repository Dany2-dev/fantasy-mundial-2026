import { useEffect, useState } from "react";
import { Player } from "../types";
import PlayerCard from "./PlayerCard";
import styles from "./FlipReveal.module.css";

interface Props {
  player: Player;
  delay: number;
  size?: "sm" | "md";
}

// Carta misteriosa con brillo giratorio que voltea en 3D para revelar al
// jugador — la animación que pediste, adaptada a la silueta de escudo.
export default function FlipReveal({ player, delay, size = "md" }: Props) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <button
      type="button"
      className={`${styles.scene} ${styles[size]}`}
      onClick={() => setFlipped(true)}
      aria-label={flipped ? `Carta revelada: ${player.name}` : "Revelar carta"}
    >
      <div className={`${styles.flipCard} ${flipped ? styles.flipped : ""}`}>
        <div className={styles.back} aria-hidden={flipped}>
          <span className={styles.sweep} />
          <span className={styles.mark}>?</span>
        </div>
        <div className={styles.front}>
          <PlayerCard player={player} size={size} />
        </div>
      </div>
    </button>
  );
}
