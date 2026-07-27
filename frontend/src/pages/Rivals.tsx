import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import AnimatedList from "../components/AnimatedList";
import CompareModal, { SquadOption } from "../components/CompareModal";
import PlayerCard from "../components/PlayerCard";
import PlayerDetailModal from "../components/PlayerDetailModal";
import { pickEleven } from "../lib/formation";
import { formatMoney } from "../lib/money";
import { useAppSelector } from "../store/store";
import { MarketCard, Player, Standing, Trade } from "../types";
import styles from "./Rivals.module.css";

interface RivalGroup {
  owner: { id: string; name: string };
  cards: MarketCard[];
  value: number;
}

// ---- Perspectiva de la cancha (mismo cálculo que "Mi Once") ----
// Las filas se acomodan en un trapecio (más angosto arriba, donde están los
// delanteros; más ancho abajo, junto al arquero) y las cartas se escalan por
// fila para sugerir profundidad. El fondo (pasto) se recorta con el mismo
// trapecio; las cartas se quedan "de pie" y solo cambian de tamaño.
const TOP_INSET = 7;
const BOTTOM_INSET = 1;
const SCALE_TOP = 0.72;
const SCALE_BOTTOM = 1.08;
const ROW_Y_MARGIN = 7;
function insetAtY(y: number) {
  return TOP_INSET + ((BOTTOM_INSET - TOP_INSET) * y) / 100;
}
function scaleForRow(rowIndex: number, totalRows: number) {
  const t = totalRows > 1 ? rowIndex / (totalRows - 1) : 0;
  return SCALE_TOP + t * (SCALE_BOTTOM - SCALE_TOP);
}
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

// Líneas reglamentarias de la cancha, sobre el mismo trapecio de perspectiva.
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

// Valor de mercado de una carta: su cláusula (lo que costaría fichar al
// jugador ahora mismo) y, si no viene, se estima como basePrice x3.
const cardValue = (c: MarketCard) => c.clause ?? c.basePrice * 3;

// basePrice/clause ya están en euros (valor de mercado real de FotMob);
// formatMoney los muestra al estilo FotMob (€853K, €23.9M).

// Naoki trabaja el diseño de esta página. Los mánagers de tu liga y sus
// cartas ya son datos reales (GET /collection/market); los puntos y el valor
// de equipo vienen de la tabla de la liga (GET /leagues/:id).
export default function Rivals() {
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const user = useAppSelector((s) => s.auth.user);
  const userId = user?.id;
  const [market, setMarket] = useState<MarketCard[]>([]);
  const [myCollection, setMyCollection] = useState<Player[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (!activeLeagueId) return;
    setLoading(true);
    Promise.all([
      api<{ market: MarketCard[] }>(`/collection/market?leagueId=${activeLeagueId}`),
      api<{ collection: Player[] }>(`/collection?leagueId=${activeLeagueId}`),
      api<{ trades: Trade[] }>(`/trades?leagueId=${activeLeagueId}`),
      api<{ standings: Standing[] }>(`/leagues/${activeLeagueId}`),
    ])
      .then(([m, c, t, l]) => {
        setMarket(m.market);
        setMyCollection(c.collection);
        setTrades(t.trades);
        setStandings(l.standings);
      })
      .catch(() => {
        setMarket([]);
        setMyCollection([]);
        setTrades([]);
        setStandings([]);
      })
      .finally(() => setLoading(false));
  }, [activeLeagueId]);

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Rivales</h1>
        <p className="muted">Primero entra a una liga. Ahí encontrarás a los mánagers que tendrás que vencer.</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  const byOwner = new Map<string, RivalGroup>();
  for (const card of market) {
    const g = byOwner.get(card.owner.id) ?? { owner: card.owner, cards: [], value: 0 };
    g.cards.push(card);
    g.value += cardValue(card);
    byOwner.set(card.owner.id, g);
  }
  const rivals = [...byOwner.values()].sort((a, b) => b.value - a.value);
  const visibleRivals = rivals.filter((r) =>
    r.owner.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const pendingFor = (ownerId: string) =>
    trades.filter(
      (t) =>
        t.status === "pending" &&
        ((t.fromUserId === ownerId && t.toUserId === userId) ||
          (t.toUserId === ownerId && t.fromUserId === userId))
    ).length;

  const pointsFor = (ownerId: string) => standings.find((s) => s.userId === ownerId)?.points ?? 0;

  // Mánager seleccionado (por defecto el primero, para que el panel derecho no
  // arranque vacío). El clic en la lista actualiza selectedOwnerId.
  const selectedRival = rivals.find((r) => r.owner.id === selectedOwnerId) ?? rivals[0] ?? null;
  const eleven = selectedRival ? pickEleven(selectedRival.cards) : { starters: [], bench: [] };

  // Filas del once por posición (delanteros arriba, arquero abajo) y sus
  // coordenadas dentro del trapecio de perspectiva + líneas de conexión.
  const displayRows = (["DEL", "MED", "DEF", "POR"] as const).map((pos) =>
    eleven.starters.filter((c) => c.position === pos)
  );
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
      if (to.length === 0) continue;
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

  // Plantillas disponibles para comparar: la tuya + la de cada rival.
  const squads: SquadOption[] = [
    ...(userId ? [{ id: userId, name: `${user?.name ?? "Tú"} (tú)`, cards: myCollection }] : []),
    ...rivals.map((r) => ({ id: r.owner.id, name: r.owner.name, cards: r.cards })),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1>Rivales</h1>
          <p className="muted">Conoce sus plantillas, estudia sus figuras y prepara el próximo clausulazo.</p>
        </div>
        {squads.length >= 2 && (
          <button className={`primary ${styles.compareBtn}`} onClick={() => setCompareOpen(true)}>
            Comparar
          </button>
        )}
      </div>

      {loading && <p className="muted">Cargando…</p>}
      {!loading && rivals.length === 0 && (
        <p className="muted">Aún juegas solo. Comparte el código de la liga y trae al grupo.</p>
      )}

      {rivals.length > 0 && (
        <div className={styles.split}>
          {/* IZQUIERDA: lista de mánagers (nombre · cartas · puntos · valor) */}
          <div className={styles.leftCol}>
            <input
              className={styles.search}
              type="search"
              placeholder="Buscar mánager…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {visibleRivals.length === 0 ? (
              <p className="muted">Ningún mánager coincide con “{query}”.</p>
            ) : (
              <AnimatedList
                displayScrollbar
                showGradients
                enableArrowNavigation
                initialSelectedIndex={0}
                onItemSelect={(_item, index) => {
                  const r = visibleRivals[index];
                  if (r) setSelectedOwnerId(r.owner.id);
                }}
                items={visibleRivals.map((r) => {
                  const pc = pendingFor(r.owner.id);
                  return (
                    <div className={styles.managerRow}>
                      <div>
                        <h2 className={styles.rivalName}>{r.owner.name}</h2>
                        <span className="caption tabular">
                          {r.cards.length} cartas · {pointsFor(r.owner.id)} pts · valor {formatMoney(r.value)}
                        </span>
                      </div>
                      {pc > 0 && (
                        <span className={styles.pendingBadge}>{pc === 1 ? "1 oferta" : `${pc} ofertas`}</span>
                      )}
                    </div>
                  );
                })}
              />
            )}
          </div>

          {/* DERECHA: once del mánager seleccionado en la cancha + banca */}
          <div className={styles.rightCol}>
            {selectedRival ? (
              <div className={styles.rightPanel}>
                <div className={styles.rightHead}>
                  <div>
                    <h2 className={styles.rivalName}>{selectedRival.owner.name}</h2>
                    <span className="caption tabular">
                      {selectedRival.cards.length} cartas · {pointsFor(selectedRival.owner.id)} pts · valor{" "}
                      {formatMoney(selectedRival.value)}
                    </span>
                  </div>
                  {pendingFor(selectedRival.owner.id) > 0 && (
                    <span className={styles.pendingBadge}>
                      {pendingFor(selectedRival.owner.id) === 1
                        ? "1 oferta pendiente"
                        : `${pendingFor(selectedRival.owner.id)} ofertas pendientes`}
                    </span>
                  )}
                </div>
                <div className={styles.pitch}>
                  {/* Fondo: pasto pintado con CSS, recortado en trapecio. */}
                  <div className={styles.pitchTilt} aria-hidden="true" />

                  {/* Líneas reglamentarias de la cancha. */}
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

                  {/* Líneas de conexión decorativas entre jugadores. */}
                  <svg className={styles.connectors} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    {connections.map(([a, b], i) => (
                      <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.pitchConnector} />
                    ))}
                  </svg>

                  {/* Cartas: capa plana, siempre "de pie", escaladas por fila. */}
                  {displayRows.map((row, rowIndex) =>
                    row.map((c, i) => {
                      const { x, y } = rowPoints[rowIndex][i];
                      const scale = scaleForRow(rowIndex, displayRows.length);
                      return (
                        <div
                          key={c.id}
                          className={styles.slotWrap}
                          style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) scale(${scale})` }}
                        >
                          <PlayerCard player={c} size="sm" onClick={() => setOpenPlayerId(c.id)} />
                        </div>
                      );
                    })
                  )}
                  {selectedRival.cards.length === 0 && (
                    <p className={styles.pitchEmpty}>Este mánager aún no tiene cartas.</p>
                  )}
                </div>
                {eleven.bench.length > 0 && (
                  <div className={styles.bench}>
                    <span className={`caption ${styles.benchLabel}`}>Banca</span>
                    <div className={styles.benchRow}>
                      {eleven.bench.map((c) => (
                        <div key={c.id} className={styles.pitchSlot}>
                          <PlayerCard player={c} size="sm" onClick={() => setOpenPlayerId(c.id)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.rightEmpty}>
                <p className="muted">Selecciona un mánager para ver sus cartas.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {compareOpen && squads.length >= 2 && (
        <CompareModal
          squads={squads}
          initialLeftId={selectedRival?.owner.id ?? squads[0]?.id}
          initialRightId={userId ?? squads[1]?.id}
          onClose={() => setCompareOpen(false)}
          onOpenPlayer={(id) => setOpenPlayerId(id)}
        />
      )}

      {openPlayerId != null && (
        <PlayerDetailModal playerId={openPlayerId} leagueId={activeLeagueId} onClose={() => setOpenPlayerId(null)} />
      )}
    </div>
  );
}
