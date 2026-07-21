import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import CardSelect from "../components/CardSelect";
import { IconArrowRight, IconCheck, IconClock, IconClose } from "../components/icons";
import PlayerCard from "../components/PlayerCard";
import { FORMATIONS } from "../lib/formations";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { League, Player } from "../types";
import styles from "./Squad.module.css";

// Igual que LOCK_WINDOW_MS en backend/src/routes/squad.ts: la ventana en la
// que no se puede editar la plantilla es una decisión de negocio, no un
// detalle de UI, así que debe coincidir en los dos lados. El backend es la
// autoridad real (rechaza el PUT); esto solo evita el viaje redondo inútil
// y explica por qué el botón está apagado.
const LOCK_WINDOW_MS = 60 * 60 * 1000;

const POSITIONS: Player["position"][] = ["POR", "DEF", "MED", "DEL"];
const POS_LABEL: Record<Player["position"], string> = {
  POR: "Porteros",
  DEF: "Defensas",
  MED: "Mediocampistas",
  DEL: "Delanteros",
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
// Margen vertical para que las filas extremas (arriba/abajo) no queden tan
// pegadas al borde: la carta de la fila de abajo se escala hasta 1.08x
// (SCALE_BOTTOM) y sin este margen su mitad inferior se salía unos px por
// debajo del límite de la cancha.
const ROW_Y_MARGIN = 7;
function scaleForRow(rowIndex: number, totalRows: number) {
  const t = totalRows > 1 ? rowIndex / (totalRows - 1) : 0;
  return SCALE_TOP + t * (SCALE_BOTTOM - SCALE_TOP);
}
// Antes cada fila se separaba lo mismo (100-2*margen dividido en partes
// iguales), pero como las cartas de abajo son más grandes (SCALE_BOTTOM)
// que las de arriba (SCALE_TOP), esa distancia fija hacía que las filas de
// abajo —con cartas más altas— se pisaran entre sí (nombre tapado por la
// fila vecina). Ahora cada fila reclama una porción de alto proporcional a
// su propia escala: las filas grandes se llevan más aire y las chicas no
// desperdician espacio de más. Con pesos iguales esto da exactamente lo
// mismo que antes (caso base).
function rowCenterYs(totalRows: number): number[] {
  if (totalRows <= 1) return [50];
  const weights = Array.from({ length: totalRows }, (_, r) => scaleForRow(r, totalRows));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const band = 100 - 2 * ROW_Y_MARGIN;
  const ys: number[] = [];
  let cursor = ROW_Y_MARGIN;
  for (const w of weights) {
    const segment = (w / totalWeight) * band;
    ys.push(cursor + segment / 2);
    cursor += segment;
  }
  return ys;
}

// Líneas reglamentarias de la cancha, calculadas sobre el mismo trapecio de
// perspectiva que usan las filas de cartas (insetAtY) sumando un margen fijo
// por lado, para que cada marca "tapee" en paralelo a las líneas de banda en
// vez de verse como un rectángulo plano encimado. Profundidades y anchos
// vienen de las proporciones reales de una cancha FIFA (área grande 16.5 m /
// área chica 5.5 m de fondo, ~59%/~27% del ancho) traducidas a puntos
// porcentuales del largo total. No dependen de la formación, así que se
// calculan una sola vez a nivel de módulo.
function edgeX(y: number, margin = 0): [number, number] {
  const inset = insetAtY(y) + margin;
  return [inset, 100 - inset];
}
function boxPoints(goalY: number, lineY: number, margin: number) {
  const [lg, rg] = edgeX(goalY, margin);
  const [lb, rb] = edgeX(lineY, margin);
  return `${lg},${goalY} ${lb},${lineY} ${rb},${lineY} ${rg},${goalY}`;
}
const [PITCH_TL, PITCH_TR] = edgeX(0);
const [PITCH_BL, PITCH_BR] = edgeX(100);
const PITCH_OUTLINE = `${PITCH_TL},0 ${PITCH_TR},0 ${PITCH_BR},100 ${PITCH_BL},100`;
const [HALFWAY_L, HALFWAY_R] = edgeX(50);
const BOX_MARGIN = 20;
const SIX_MARGIN = 36;
const NEAR_BOX = boxPoints(100, 84, BOX_MARGIN);
const NEAR_SIX = boxPoints(100, 94.5, SIX_MARGIN);
const FAR_BOX = boxPoints(0, 16, BOX_MARGIN);
const FAR_SIX = boxPoints(0, 5.5, SIX_MARGIN);

type Point = { x: number; y: number };

// Lo que se está arrastrando: de qué jugador se trata y, si venía de un slot
// de la cancha (no de la banca), cuál era ese slot — para poder devolver al
// jugador desplazado ahí mismo en un intercambio cancha-cancha.
type DragPayload = { playerId: number; position: Player["position"]; fromSlot: number | null };

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
  const [dragPlayer, setDragPlayer] = useState<DragPayload | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [benchFilter, setBenchFilter] = useState<Player["position"]>("POR");

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
    api<{ league: League }>(`/leagues/${activeLeagueId}`).then(({ league }) => setLeague(league));
  }, [dispatch, activeLeagueId]);

  // El candado depende de la hora actual, no de ninguna acción del usuario:
  // sin este reloj, alguien que deja la página abierta justo cuando arranca
  // (o termina) la ventana de bloqueo vería el botón en el estado viejo
  // hasta que algo más disparara un re-render.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // El aviso de "guardado" es una confirmación pasajera, no algo que el
  // usuario tenga que leer con calma (a diferencia del banner de jornada en
  // curso, que se queda mientras esa condición siga siendo cierta): se
  // borra solo. Los errores NO se auto-cierran — ahí sí conviene que el
  // usuario los vea y actúe.
  useEffect(() => {
    if (!msg || msg.kind !== "ok") return;
    const id = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(id);
  }, [msg]);

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

  // Soltar un jugador (de la banca o de otro slot) sobre un slot de la
  // cancha. Si el slot destino ya tenía a alguien, se intercambian: el
  // desplazado toma el lugar de origen (si venía de otro slot) o se va a la
  // banca (si venía de ahí).
  function dropOnSlot(targetIndex: number) {
    if (!dragPlayer) return;
    const target = slots[targetIndex];
    if (target.position !== dragPlayer.position) {
      setDragPlayer(null);
      return;
    }
    const displaced = target.playerId;
    const fromSlot = dragPlayer.fromSlot;
    const incomingId = dragPlayer.playerId;
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i === targetIndex) return { ...s, playerId: incomingId };
        if (fromSlot !== null && i === fromSlot) return { ...s, playerId: displaced };
        return s;
      })
    );
    // El desplazado solo "sale del once" de verdad si venía de la banca; si
    // fue un intercambio cancha-cancha, ambos jugadores siguen dentro y el
    // capitán (que se guarda por id de jugador, no por slot) sigue siendo válido.
    if (fromSlot === null && displaced != null && captainId === displaced) setCaptainId(null);
    setDragPlayer(null);
  }

  // Soltar sobre la banca a alguien que se arrastró desde la cancha: lo saca
  // del once (mismo efecto que el botón de quitar).
  function dropOnBench() {
    if (!dragPlayer || dragPlayer.fromSlot === null) {
      setDragPlayer(null);
      return;
    }
    clearSlot(dragPlayer.fromSlot);
    setDragPlayer(null);
  }

  // Ventana de bloqueo: 1h antes y 1h después del primer partido (deadline)
  // de la jornada activa. Fuera de esa ventana siempre se puede guardar; lo
  // que cambia es si el cambio cuenta para la jornada activa (guardado antes
  // del deadline) o recién para la siguiente (guardado después de que la
  // ventana se vuelve a abrir) — eso lo decide el backend con el historial
  // de plantillas, no esta pantalla. El backend es quien de verdad aplica el
  // bloqueo; esto solo evita el viaje redondo y explica por qué está apagado.
  const gameweek = league?.currentGameweek ?? null;
  const deadlineMs = gameweek ? new Date(gameweek.deadline).getTime() : null;
  const lockStart = deadlineMs != null ? deadlineMs - LOCK_WINDOW_MS : null;
  const lockEnd = deadlineMs != null ? deadlineMs + LOCK_WINDOW_MS : null;
  const isLocked = lockStart != null && lockEnd != null && now >= lockStart && now <= lockEnd;
  const isPastDeadline = lockEnd != null && now > lockEnd;
  const reopensAtText =
    lockEnd != null
      ? new Date(lockEnd).toLocaleString("es-MX", { weekday: "short", hour: "2-digit", minute: "2-digit" })
      : null;
  const lockMsg =
    isLocked && gameweek
      ? `No puedes editar tu plantilla entre 1 hora antes y 1 hora después del primer partido de esta jornada (${gameweek.label}). Se reabre ${reopensAtText}.`
      : null;

  async function save() {
    if (!activeLeagueId) return;
    if (isLocked) {
      setMsg({ kind: "error", text: lockMsg ?? "No puedes editar tu plantilla en este momento." });
      return;
    }
    setMsg(null);
    const playerIds = slots.map((s) => s.playerId).filter((id): id is number => id != null);
    try {
      await api("/squad", {
        method: "PUT",
        body: JSON.stringify({ leagueId: activeLeagueId, formation, playerIds, captainId }),
      });
      // El detalle de "cuenta para la jornada activa o para la siguiente" ya
      // lo dice el banner informativo de arriba (isPastDeadline) mientras
      // siga siendo cierto — repetirlo acá era el mismo mensaje dos veces.
      setMsg({ kind: "ok", text: "Once guardado" });
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

  const benchPlayers = collection.filter((p) => !usedIds.has(p.id));
  const benchByPosition = new Map<Player["position"], Player[]>(POSITIONS.map((pos) => [pos, []]));
  for (const p of benchPlayers) benchByPosition.get(p.position)?.push(p);

  // Coordenadas (0-100) de cada slot dentro del trapecio, más las líneas de
  // conexión decorativas entre jugadores de filas vecinas.
  const rowYs = rowCenterYs(displayRows.length);
  const rowPoints: Point[][] = displayRows.map((row, rowIndex) => {
    const y = rowYs[rowIndex];
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
        <div className={styles.control}>
          <span className="caption">Formación</span>
          <CardSelect
            ariaLabel="Formación"
            value={formation}
            onChange={changeFormation}
            options={Object.keys(FORMATIONS).map((f) => ({ value: f, label: f }))}
          />
        </div>
        <div className={styles.control}>
          <span className="caption">Capitán (x2 pts)</span>
          <CardSelect
            ariaLabel="Capitán (x2 pts)"
            value={captainId != null ? String(captainId) : ""}
            onChange={(v) => setCaptainId(v ? Number(v) : null)}
            options={[
              { value: "", label: "Sin capitán" },
              ...captainOptions.map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
        </div>
        <button className="primary" onClick={save} disabled={isLocked} title={lockMsg ?? undefined}>
          Guardar once
        </button>
      </div>

      {lockMsg && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <IconClock size={18} className={styles.bannerIcon} />
          <span>{lockMsg}</span>
        </div>
      )}
      {!isLocked && isPastDeadline && gameweek && (
        <div className={`${styles.banner} ${styles.bannerInfo}`}>
          <IconArrowRight size={18} className={styles.bannerIcon} />
          <span>
            Ya arrancó esta jornada ({gameweek.label}): los cambios que guardes ahora van a puntuar desde la próxima.
          </span>
        </div>
      )}
      {msg && (
        <div className={`${styles.banner} ${msg.kind === "ok" ? styles.bannerSuccess : styles.bannerError}`}>
          {msg.kind === "ok" ? (
            <IconCheck size={18} className={styles.bannerIcon} />
          ) : (
            <IconClose size={18} className={styles.bannerIcon} />
          )}
          <span>{msg.text}</span>
        </div>
      )}
      <p className={`caption ${styles.dragHint}`}>
        Arrastra una carta de la banca hacia la cancha (o entre jugadores de la cancha) para cambiarla.
      </p>

      <div className={styles.workspace}>
        <div className={styles.pitch}>
          <div className={styles.pitchTilt} />
          <svg className={styles.pitchLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={PITCH_OUTLINE} className={styles.lineShape} />
            <line x1={HALFWAY_L} y1={50} x2={HALFWAY_R} y2={50} className={styles.lineShape} />
            <circle cx={50} cy={50} r={9} className={styles.lineShape} />
            <circle cx={50} cy={50} r={0.7} className={styles.lineDot} />
            <polyline points={NEAR_BOX} className={styles.lineShape} />
            <polyline points={NEAR_SIX} className={styles.lineShape} />
            <circle cx={50} cy={89.5} r={0.7} className={styles.lineDot} />
            <polyline points={FAR_BOX} className={styles.lineShape} />
            <polyline points={FAR_SIX} className={styles.lineShape} />
            <circle cx={50} cy={10.5} r={0.7} className={styles.lineDot} />
          </svg>
          <svg className={styles.connectors} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {connections.map(([a, b], i) => (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.pitchConnector} />
            ))}
          </svg>

          {displayRows.map((row, rowIndex) =>
            row.map((slot, i) => {
              const slotIndex = slots.indexOf(slot);
              const player = slot.playerId != null ? byId.get(slot.playerId) : undefined;
              const { x, y } = rowPoints[rowIndex][i];
              const scale = scaleForRow(rowIndex, displayRows.length);
              const isDropTarget = dragPlayer != null && dragPlayer.position === slot.position;
              return (
                <div
                  key={slotIndex}
                  className={`${styles.slotWrap} ${isDropTarget ? styles.dropTarget : ""}`}
                  style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) scale(${scale})` }}
                  onDragOver={(e) => {
                    if (isDropTarget) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropOnSlot(slotIndex);
                  }}
                >
                  {player ? (
                    <div
                      className={styles.filledSlot}
                      draggable
                      onDragStart={() => setDragPlayer({ playerId: player.id, position: player.position, fromSlot: slotIndex })}
                      onDragEnd={() => setDragPlayer(null)}
                    >
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

        <div
          className={`${styles.roster} ${dragPlayer && dragPlayer.fromSlot !== null ? styles.rosterDropTarget : ""}`}
          onDragOver={(e) => {
            if (dragPlayer && dragPlayer.fromSlot !== null) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropOnBench();
          }}
        >
          <div className={styles.rosterHeader}>
            <h3>Banca</h3>
            <span className="caption tabular">{benchPlayers.length} disponibles</span>
          </div>
          {benchPlayers.length === 0 ? (
            <p className="muted">
              No tienes más jugadores libres. Consigue cartas en <Link to="/sobres">sobres</Link> o el{" "}
              <Link to="/mercado">mercado</Link>.
            </p>
          ) : (
            <>
              {/* Filtro por posición: antes se listaban las 4 posiciones una
                  debajo de otra y encontrar, por ejemplo, un delantero
                  significaba scrollear más allá de porteros/defensas/medios.
                  Con esto se ve una sola posición a la vez, como el resto de
                  la banca es la única parte scrolleable de la página, el
                  filtro queda "pegado" arriba (sticky) para no perderlo. */}
              <div className={styles.rosterTabs} role="tablist" aria-label="Filtrar banca por posición">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    role="tab"
                    aria-selected={benchFilter === pos}
                    className={`${styles.rosterTab} ${benchFilter === pos ? styles.rosterTabActive : ""}`}
                    onClick={() => setBenchFilter(pos)}
                  >
                    {POS_LABEL[pos]}
                    <span className={styles.rosterTabCount}>{benchByPosition.get(pos)?.length ?? 0}</span>
                  </button>
                ))}
              </div>
              {(benchByPosition.get(benchFilter)?.length ?? 0) === 0 ? (
                <p className="muted">No tienes {POS_LABEL[benchFilter].toLowerCase()} libres en la banca.</p>
              ) : (
                <div className={styles.rosterGrid}>
                  {benchByPosition.get(benchFilter)!.map((p) => (
                    <div
                      key={p.id}
                      className={styles.benchCard}
                      draggable
                      onDragStart={() => setDragPlayer({ playerId: p.id, position: p.position, fromSlot: null })}
                      onDragEnd={() => setDragPlayer(null)}
                    >
                      <PlayerCard player={p} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
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
