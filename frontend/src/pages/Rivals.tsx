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

  // Plantillas disponibles para comparar: la tuya + la de cada rival.
  const squads: SquadOption[] = [
    ...(userId ? [{ id: userId, name: `${user?.name ?? "Tú"} (tú)`, cards: myCollection }] : []),
    ...rivals.map((r) => ({ id: r.owner.id, name: r.owner.name, cards: r.cards })),
  ];

  return (
    <div>
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
                  {(["DEL", "MED", "DEF", "POR"] as const).map((pos) => {
                    const line = eleven.starters.filter((c) => c.position === pos);
                    if (line.length === 0) return null;
                    return (
                      <div key={pos} className={styles.pitchRow}>
                        {line.map((c) => (
                          <div key={c.id} className={styles.pitchSlot}>
                            <PlayerCard player={c} size="sm" onClick={() => setOpenPlayerId(c.id)} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
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
