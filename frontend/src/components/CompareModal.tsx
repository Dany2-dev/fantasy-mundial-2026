import { useMemo, useState } from "react";
import { FORMATION, pickEleven } from "../lib/formation";
import { Player } from "../types";
import styles from "./CompareModal.module.css";
import { IconClose } from "./icons";
import PlayerCard from "./PlayerCard";

export interface SquadOption {
  id: string;
  name: string;
  cards: Player[];
}

interface Props {
  squads: SquadOption[];
  initialLeftId?: string | null;
  initialRightId?: string | null;
  onClose: () => void;
  onOpenPlayer?: (playerId: number) => void;
}

const ROWS = ["DEL", "MED", "DEF", "POR"] as const;

// Empareja titulares por posición (mejor con mejor, segundo con segundo…) y
// marca quién gana cada duelo según su media (rating). Empates no se marcan.
function compareStarters(left: Player[], right: Player[]) {
  const leftBetter = new Set<number>();
  const rightBetter = new Set<number>();
  let leftWins = 0;
  let rightWins = 0;
  (["POR", "DEF", "MED", "DEL"] as const).forEach((pos) => {
    const l = left.filter((c) => c.position === pos).sort((a, b) => b.rating - a.rating);
    const r = right.filter((c) => c.position === pos).sort((a, b) => b.rating - a.rating);
    const n = Math.max(l.length, r.length);
    for (let i = 0; i < n; i++) {
      const lc = l[i];
      const rc = r[i];
      if (!lc || !rc) continue;
      if (lc.rating > rc.rating) {
        leftBetter.add(lc.id);
        leftWins++;
      } else if (rc.rating > lc.rating) {
        rightBetter.add(rc.id);
        rightWins++;
      }
    }
  });
  return { leftBetter, rightBetter, leftWins, rightWins };
}

export default function CompareModal({ squads, initialLeftId, initialRightId, onClose, onOpenPlayer }: Props) {
  const [leftId, setLeftId] = useState<string | null>(initialLeftId ?? squads[0]?.id ?? null);
  const [rightId, setRightId] = useState<string | null>(() => {
    const left = initialLeftId ?? squads[0]?.id ?? null;
    // No se puede comparar a alguien contra sí mismo: si el lado derecho
    // caería igual al izquierdo, se busca la siguiente plantilla disponible.
    if (initialRightId && initialRightId !== left) return initialRightId;
    return squads.find((s) => s.id !== left)?.id ?? left ?? null;
  });

  // Cambiar de plantilla en un lado: si coincide con el otro lado, se
  // intercambian entre sí en vez de dejar la misma plantilla dos veces.
  function chooseLeft(id: string) {
    if (id === rightId) setRightId(leftId);
    setLeftId(id);
  }
  function chooseRight(id: string) {
    if (id === leftId) setLeftId(rightId);
    setRightId(id);
  }

  const leftSquad = squads.find((s) => s.id === leftId) ?? null;
  const rightSquad = squads.find((s) => s.id === rightId) ?? null;

  const leftEleven = useMemo(() => pickEleven(leftSquad?.cards ?? []), [leftSquad]);
  const rightEleven = useMemo(() => pickEleven(rightSquad?.cards ?? []), [rightSquad]);

  const { leftBetter, rightBetter, leftWins, rightWins } = useMemo(
    () => compareStarters(leftEleven.starters, rightEleven.starters),
    [leftEleven, rightEleven]
  );

  function renderPitch(starters: Player[], betterIds: Set<number>) {
    return (
      <div className={styles.pitch}>
        {ROWS.map((pos) => {
          const line = starters.filter((c) => c.position === pos);
          if (line.length === 0) return null;
          return (
            <div key={pos} className={styles.pitchRow}>
              {line.map((c) => (
                <div key={c.id} className={`${styles.pitchSlot} ${betterIds.has(c.id) ? styles.better : ""}`}>
                  {betterIds.has(c.id) && (
                    <span className={styles.betterBadge} title="Mejor media en su posición">
                      ▲
                    </span>
                  )}
                  <PlayerCard player={c} size="sm" onClick={onOpenPlayer ? () => onOpenPlayer(c.id) : undefined} />
                </div>
              ))}
            </div>
          );
        })}
        {starters.length === 0 && <p className={styles.pitchEmpty}>Sin cartas suficientes.</p>}
      </div>
    );
  }

  const totalSlots = Object.values(FORMATION).reduce((a, b) => a + b, 0);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Comparar plantillas">
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <IconClose size={18} />
        </button>

        <div>
          <h2 className={styles.title}>Comparar plantillas</h2>
          <p className={`muted ${styles.subtitle}`}>
            Se resalta al jugador con mejor media en cada posición ({totalSlots} duelos posibles).
          </p>
        </div>

        <div className={styles.pickers}>
          <select value={leftId ?? ""} onChange={(e) => chooseLeft(e.target.value)}>
            {squads.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === rightId}>
                {s.name}
              </option>
            ))}
          </select>
          <span className={styles.vs}>VS</span>
          <select value={rightId ?? ""} onChange={(e) => chooseRight(e.target.value)}>
            {squads.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === leftId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {squads.length < 2 && <p className="muted">Hace falta otra plantilla para poder comparar.</p>}

        <div className={styles.grid}>
          <div className={styles.side}>
            <div className={styles.sideHead}>
              <span className={styles.sideName}>{leftSquad?.name ?? "—"}</span>
              <span
                className={`${styles.score} ${
                  leftWins > rightWins ? styles.scoreWin : leftWins < rightWins ? styles.scoreLose : styles.scoreTie
                }`}
              >
                {leftWins} duelos ganados
              </span>
            </div>
            {renderPitch(leftEleven.starters, leftBetter)}
          </div>

          <div className={styles.side}>
            <div className={styles.sideHead}>
              <span className={styles.sideName}>{rightSquad?.name ?? "—"}</span>
              <span
                className={`${styles.score} ${
                  rightWins > leftWins ? styles.scoreWin : rightWins < leftWins ? styles.scoreLose : styles.scoreTie
                }`}
              >
                {rightWins} duelos ganados
              </span>
            </div>
            {renderPitch(rightEleven.starters, rightBetter)}
          </div>
        </div>
      </div>
    </div>
  );
}
