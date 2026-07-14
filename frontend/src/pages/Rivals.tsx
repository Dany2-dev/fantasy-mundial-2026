import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import PlayerCard from "../components/PlayerCard";
import PlayerDetailModal from "../components/PlayerDetailModal";
import { useAppSelector } from "../store/store";
import { MarketCard, Trade } from "../types";
import styles from "./Rivals.module.css";

interface RivalGroup {
  owner: { id: string; name: string };
  cards: MarketCard[];
  value: number;
}

// Naoki trabaja el diseño de esta página. Los mánagers de tu liga y sus
// cartas ya son datos reales (GET /collection/market); ver el once completo
// de un rival se conecta después.
export default function Rivals() {
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [market, setMarket] = useState<MarketCard[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLeagueId) return;
    setLoading(true);
    Promise.all([
      api<{ market: MarketCard[] }>(`/collection/market?leagueId=${activeLeagueId}`),
      api<{ trades: Trade[] }>(`/trades?leagueId=${activeLeagueId}`),
    ])
      .then(([m, t]) => {
        setMarket(m.market);
        setTrades(t.trades);
      })
      .catch(() => {
        setMarket([]);
        setTrades([]);
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
    g.value += card.rating;
    byOwner.set(card.owner.id, g);
  }
  const rivals = [...byOwner.values()].sort((a, b) => b.value - a.value);

  return (
    <div>
      <h1>Rivales</h1>
      <p className="muted">Conoce sus plantillas, estudia sus figuras y prepara el próximo clausulazo.</p>

      {loading && <p className="muted">Cargando…</p>}
      {!loading && rivals.length === 0 && (
        <p className="muted">Aún juegas solo. Comparte el código de la liga y trae al grupo.</p>
      )}

      <div className={styles.rivalsList}>
        {rivals.map((r) => {
          const pending = trades.filter(
            (t) =>
              t.status === "pending" &&
              ((t.fromUserId === r.owner.id && t.toUserId === userId) ||
                (t.toUserId === r.owner.id && t.fromUserId === userId))
          );
          const top = [...r.cards].sort((a, b) => b.rating - a.rating).slice(0, 5);
          return (
            <section key={r.owner.id} className={styles.rivalCard}>
              <div className={styles.rivalHead}>
                <div>
                  <h2 className={styles.rivalName}>{r.owner.name}</h2>
                  <span className="caption tabular">
                    {r.cards.length} cartas · valor {r.value}
                  </span>
                </div>
                {pending.length > 0 && (
                  <span className={styles.pendingBadge}>
                    {pending.length === 1 ? "1 oferta pendiente" : `${pending.length} ofertas pendientes`}
                  </span>
                )}
              </div>
              <div className={styles.cardsRow}>
                {top.map((c) => (
                  <div key={c.id} className={styles.miniCard}>
                    <PlayerCard player={c} size="sm" onClick={() => setOpenPlayerId(c.id)} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {openPlayerId != null && (
        <PlayerDetailModal playerId={openPlayerId} leagueId={activeLeagueId} onClose={() => setOpenPlayerId(null)} />
      )}
    </div>
  );
}
