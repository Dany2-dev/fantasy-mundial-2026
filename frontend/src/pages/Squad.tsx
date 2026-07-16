import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { IconClose } from "../components/icons";
import PlayerCard from "../components/PlayerCard";
import { FORMATIONS } from "../lib/formations";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player } from "../types";
import styles from "./Squad.module.css";

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

// Las filas de jugadores se acomodan en un "cono" (más angosto arriba, donde
// están los delanteros; más ancho abajo, junto al arquero) para que sigan la
// perspectiva del fondo. El fondo (foto real) se inclina en 3D aparte; las
// cartas se quedan siempre "de pie" (sin esa inclinación) y solo cambian de
// tamaño con SCALE_TOP/SCALE_BOTTOM para sugerir cercanía/lejanía.
const TOP_INSET = 7;
const BOTTOM_INSET = 1;
const SCALE_TOP = 0.72;
const SCALE_BOTTOM = 1.08;
function insetAtY(y: number) {
  return TOP_INSET + ((BOTTOM_INSET - TOP_INSET) * y) / 100;
}
function rowCenterY(rowIndex: number, totalRows: number) {
  return ((rowIndex + 0.5) / totalRows) * 100;
}
function scaleForRow(rowIndex: number, totalRows: number) {
  const t = totalRows > 1 ? rowIndex / (totalRows - 1) : 0;
  return SCALE_TOP + t * (SCALE_BOTTOM - SCALE_TOP);
}

type Point = { x: number; y: number };

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
      setMsg({ kind: "ok", text: "¡Once guardado! Ya estás listo para la jornada." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo guardar" });
    }
  }

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Mi Once</h1>
        <p className="muted">Tu once necesita un club… Entra a una liga, recibe tus cartas y empieza a armarlo.</p>
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
  const displayRows = [...rows].reverse(); // delanteros arriba, arquero abajo

  const filled = slots.filter((s) => s.playerId != null).length;
  const filledPlayers = slots
    .map((s) => (s.playerId != null ? byId.get(s.playerId) : undefined))
    .filter((p): p is Player => Boolean(p));
  const avgRating = filledPlayers.length
    ? Math.round(filledPlayers.reduce((sum, p) => sum + p.rating, 0) / filledPlayers.length)
    : null;
  const captainOptions = filledPlayers;

  // Coordenadas (0-100) de cada slot dentro del trapecio, más las líneas de
  // conexión decorativas entre jugadores de filas vecinas.
  const rowPoints: Point[][] = displayRows.map((row, rowIndex) => {
    const y = rowCenterY(rowIndex, displayRows.length);
    const inset = insetAtY(y);
    const n = row.length;
    return row.map((_, i) => ({
      x: inset + ((i + 0.5) / n) * (100 - 2 * inset),
      y,
    }));
  });

  const connections: [Point, Point][] = [];
  for (const row of rowPoints) {
    for (let i = 0; i < row.length - 1; i++) connections.push([row[i], row[i + 1]]);
  }
  for (let r = 0; r < rowPoints.length - 1; r++) {
    const from = rowPoints[r];
    const to = rowPoints[r + 1];
    for (const a of from) {
      let best = to[0];
      let bestDist = Math.abs(a.x - to[0].x);
      for (const b of to) {
        const d = Math.abs(a.x - b.x);
        if (d < bestDist) {
          best = b;
          bestDist = d;
        }
      }
      connections.push([a, best]);
    }
  }

  return (
    <div>
      <div className={styles.headerRow}>
        <h1>Mi Once</h1>
        <div className={styles.stats}>
          <span className={styles.statChip}>
            <span className={styles.statValue}>{filled}/11</span>
            <span className={styles.statLabel}>jugadores</span>
          </span>
          <span className={styles.statChip}>
            <span className={styles.statValue}>{avgRating ?? "—"}</span>
            <span className={styles.statLabel}>media</span>
          </span>
        </div>
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
        {/* Fondo: foto real de cancha, inclinada en 3D para dar profundidad.
            No lleva jugadores adentro para que ellos no hereden esa inclinación. */}
        <div className={styles.pitchTilt} aria-hidden="true" />

        {/* Líneas de conexión decorativas, en su propia capa plana (sin inclinar)
            para que calcen exacto con la posición de las cartas. */}
        <svg className={styles.connectors} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {connections.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.pitchConnector} />
          ))}
        </svg>

        {/* Cartas: capa plana, siempre "de pie". Solo cambian de tamaño por fila
            (más chicas arriba/lejos, más grandes abajo/cerca) para sugerir profundidad
            sin inclinarlas ni deformarlas. */}
        {displayRows.map((row, rowIndex) =>
          row.map((slot, i) => {
            const slotIndex = slots.indexOf(slot);
            const player = slot.playerId != null ? byId.get(slot.playerId) : undefined;
            const { x, y } = rowPoints[rowIndex][i];
            const scale = scaleForRow(rowIndex, displayRows.length);
            return (
              <div
                key={slotIndex}
                className={styles.slotWrap}
                style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) scale(${scale})` }}
              >
                {player ? (
                  <div className={styles.filledSlot}>
                    <PlayerCard player={player} size="sm" captain={captainId === player.id} />
                    <button className={styles.removeBtn} onClick={() => clearSlot(slotIndex)} title="Quitar">
                      <IconClose size={13} />
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
          })
        )}
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
              No tienes más {slots[pickingSlot].position} disponibles. Busca refuerzos en{" "}
              <Link to="/sobres">sobres</Link> o en el <Link to="/mercado">mercado</Link>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
