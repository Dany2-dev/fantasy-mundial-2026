import { useState } from "react";
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function PlayerCard({ player, size = "md", ownerName, captain, selected, onClick }: Props) {
  const rarity = rarityOf(player.rating);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const Tag = onClick ? "button" : "div";
  const photoUrl = player.photoUrl;
  // Una foto cargada nunca debe retirarse por un reloj. El fallback se activa
  // únicamente si el navegador confirma que esta URL realmente falló.
  const showPhoto = Boolean(photoUrl && failedPhotoUrl !== photoUrl);

  return (
    <Tag
      className={[styles.card, styles[rarity], styles[size], selected ? styles.selected : ""].join(" ")}
      onClick={onClick}
      type={onClick ? "button" : undefined}
      aria-label={onClick ? `${player.name}, ${POS_LABEL[player.position]}, media ${player.rating}` : undefined}
    >
      <span className={styles.foil} aria-hidden="true" />

      <div className={styles.panel}>
        {rarity === "legendario" && <span className={styles.particles} aria-hidden="true" />}
        <div className={styles.stats}>
          <span className={styles.rating}>{player.rating}</span>
          <span className={`${styles.pos} ${styles[`pos${player.position}`]}`}>{player.position}</span>
          <span className={styles.crest} aria-hidden="true">
            <Flag team={player.team} size={size === "sm" ? 16 : 22} />
          </span>
        </div>

        <div className={styles.photoWrap}>
          {showPhoto ? (
            <img
              src={photoUrl ?? undefined}
              alt=""
              className={styles.photo}
              loading="lazy"
              decoding="async"
              onError={() => photoUrl && setFailedPhotoUrl(photoUrl)}
            />
          ) : (
            <div className={`${styles.initials} ${styles[`bg${player.position}`]}`}>{initials(player.name)}</div>
          )}
        </div>

        <div className={styles.info}>
          <span className={styles.name}>{player.name}</span>
          <span className={styles.teamName}>{player.team?.name ?? ""}</span>
        </div>

        {onClick && <span className={styles.sheen} aria-hidden="true" />}
      </div>

      {ownerName && <div className={styles.owner}>de {ownerName}</div>}
      {captain && (
        <span className={styles.captain} title="Capitán (puntos x2)">
          C
        </span>
      )}
    </Tag>
  );
}
