import { Player, rarityOf } from "../types";
import Flag from "./Flag";
import styles from "./PlayerCard.module.css";

interface Props {
  player: Player;
  size?: "sm" | "md";
  ownerName?: string;
  captain?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

const POS_LABEL: Record<Player["position"], string> = {
  POR: "Portero",
  DEF: "Defensa",
  MED: "Medio",
  DEL: "Delantero",
};

export default function PlayerCard({ player, size = "md", ownerName, captain, selected, onClick }: Props) {
  const rarity = rarityOf(player.rating);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={[
        styles.card,
        styles[rarity],
        styles[size],
        selected ? styles.selected : "",
        onClick ? styles.clickable : "",
      ].join(" ")}
      onClick={onClick}
      type={onClick ? "button" : undefined}
      aria-label={onClick ? `${player.name}, ${POS_LABEL[player.position]}, media ${player.rating}` : undefined}
    >
      <div className={styles.inner}>
        <div className={styles.top}>
          <span className={styles.rating}>{player.rating}</span>
          <span className={`${styles.pos} ${styles[`pos${player.position}`]}`}>{player.position}</span>
        </div>
        <div className={styles.flag} aria-hidden="true">
          <Flag country={player.country} size={size === "sm" ? 30 : 42} />
        </div>
        <div className={styles.name}>{player.name}</div>
        <div className={styles.country}>{player.country.name}</div>
        {ownerName && <div className={styles.owner}>de {ownerName}</div>}
        {captain && (
          <span className={styles.captain} title="Capitán (puntos x2)">
            C
          </span>
        )}
      </div>
    </Tag>
  );
}
