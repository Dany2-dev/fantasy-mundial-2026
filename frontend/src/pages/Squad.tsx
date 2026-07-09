import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import PlayerCard from "../components/PlayerCard";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player } from "../types";
import styles from "./Squad.module.css";

const FORMATIONS: Record<string, ["POR", number, number, number]> = {
  "4-4-2": ["POR", 4, 4, 2],
  "4-3-3": ["POR", 4, 3, 3],
  "3-5-2": ["POR", 3, 5, 2],
};

type Slot = { position: Player["position"]; playerId: number | null };

function buildSlots(formation: string, playerByPos: Map<string, number[]>): Slot[] {
  const [, def, med, del] = FORMATIONS[formation];
  const counts: [Player["position"], number][] = [
    ["POR", 1],
    ["DEF", def],
    ["MED", med],
    ["DEL", del],
  ];
  const slots: Slot[] = [];
  for (const [pos, n] of counts) {
    const ids = [...(playerByPos.get(pos) ?? [])];
    for (let i = 0; i < n; i++) slots.push({ position: pos, playerId: ids.shift() ?? null });
  }
  return slots;
}

export default function Squad() {
  const dispatch = useAppDispatch();
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const collection = useAppSelector((s) => s.collection.items);

  const [formation, setFormation] = useState("4-4-2");
  const [slots, setSlots] = useState<Slot[]>(buildSlots("4-4-2", new Map()));
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const byId = useMemo(() => new Map(collection.map((p) => [p.id, p])), [collection]);

  useEffect(() => {
    if (!activeLeagueId) return;
    dispatch(fetchCollection(activeLeagueId));
    api<{ squad: { formation: string; playerIds: number[]; captainId: number | null } }>(
      `/squad?leagueId=${activeLeagueId}`
    ).then(({ squad }) => {
      setFormation(squad.formation);
      setCaptainId(squad.captainId);
      setSlots(buildSlots(squad.formation, new Map()));
      setSavedIds(squad.playerIds);
    });
  }, [dispatch, activeLeagueId]);

  // Cuando la colección ya cargó, distribuir los ids guardados en los slots
  useEffect(() => {
    if (savedIds.length === 0 || collection.length === 0) return;
    const byPos = new Map<string, number[]>();
    for (const id of savedIds) {
      const p = byId.get(id);
      if (p) byPos.set(p.position, [...(byPos.get(p.position) ?? []), id]);
    }
    setSlots(buildSlots(formation, byPos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIds, collection.length, formation]);

  function changeFormation(f: string) {
    setFormation(f);
    const byPos = new Map<string, number[]>();
    for (const s of slots) {
      if (s.playerId != null) {
        const p = byId.get(s.playerId);
        if (p) byPos.set(p.position, [...(byPos.get(p.position) ?? []), s.playerId]);
      }
    }
    setSlots(buildSlots(f, byPos));
  }

  const usedIds = new Set(slots.map((s) => s.playerId).filter((id): id is number => id != null));

  function assign(slotIndex: number, playerId: number) {
    setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, playerId } : s)));
    setPickingSlot(null);
  }

  function clearSlot(slotIndex: number) {
    const removed = slots[slotIndex].playerId;
    setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, playerId: null } : s)));
    if (removed != null && captainId === removed) setCaptainId(null);
  }

  async function save() {
    if (!activeLeagueId) return;
    setMsg(null);
    const playerIds = slots.map((s) => s.playerId).filter((id): id is number => id != null);
    try {
      await api("/squad", {
        method: "PUT",
        body: JSON.stringify({ leagueId: activeLeagueId, formation, playerIds, captainId }),
      });
      setMsg({ kind: "ok", text: "Once guardado ✔" });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo guardar" });
    }
  }

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Mi Once</h1>
        <p className="muted">Primero necesitas una liga (y cartas).</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  const rows: Slot[][] = [];
  {
    const [, def, med, del] = FORMATIONS[formation];
    let i = 0;
    for (const n of [1, def, med, del]) {
      rows.push(slots.slice(i, i + n));
      i += n;
    }
  }
  const filled = slots.filter((s) => s.playerId != null).length;
  const captainOptions = slots
    .map((s) => (s.playerId != null ? byId.get(s.playerId) : undefined))
    .filter((p): p is Player => Boolean(p));

  return (
    <div>
      <div className={styles.headerRow}>
        <h1>Mi Once</h1>
        <span className="caption tabular">{filled}/11</span>
      </div>

      <div className={styles.controls}>
        <label className={styles.control}>
          <span className="caption">Formación</span>
          <select value={formation} onChange={(e) => changeFormation(e.target.value)}>
            {Object.keys(FORMATIONS).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className={styles.control}>
          <span className="caption">Capitán (x2 pts)</span>
          <select
            value={captainId ?? ""}
            onChange={(e) => setCaptainId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Sin capitán</option>
            {captainOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={save}>
          Guardar once
        </button>
      </div>

      {msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>}

      <div className={styles.pitch}>
        {rows.reverse().map((row, ri) => (
          <div key={ri} className={styles.row}>
            {row.map((slot) => {
              const slotIndex = slots.indexOf(slot);
              const player = slot.playerId != null ? byId.get(slot.playerId) : undefined;
              return (
                <div key={slotIndex} className={styles.slotWrap}>
                  {player ? (
                    <div className={styles.filledSlot}>
                      <PlayerCard player={player} size="sm" captain={captainId === player.id} />
                      <button className={styles.removeBtn} onClick={() => clearSlot(slotIndex)} title="Quitar">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.emptySlot}
                      onClick={() => setPickingSlot(pickingSlot === slotIndex ? null : slotIndex)}
                      aria-label={`Elegir ${slot.position}`}
                    >
                      + {slot.position}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {pickingSlot != null && (
        <div className={styles.picker}>
          <h3>Elige un {slots[pickingSlot].position}</h3>
          <div className={styles.pickerGrid}>
            {collection
              .filter((p) => p.position === slots[pickingSlot].position && !usedIds.has(p.id))
              .map((p) => (
                <PlayerCard key={p.id} player={p} size="sm" onClick={() => assign(pickingSlot, p.id)} />
              ))}
          </div>
          {collection.filter((p) => p.position === slots[pickingSlot].position && !usedIds.has(p.id)).length ===
            0 && (
            <p className="muted">
              No tienes más {slots[pickingSlot].position} disponibles.{" "}
              <Link to="/sobres">Abre un sobre</Link> o <Link to="/mercado">negocia en el mercado</Link>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
