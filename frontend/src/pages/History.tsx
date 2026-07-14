import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { IconCoin, IconExchange } from "../components/icons";
import { useAppSelector } from "../store/store";
import { GameweekScore, Trade } from "../types";
import styles from "./History.module.css";

type Event =
  | { kind: "jornada"; date: string; gw: GameweekScore }
  | { kind: "trade"; date: string; trade: Trade };

// Naoki trabaja el diseño de esta página. Tus puntos por jornada (GET
// /leagues/:id/scores) y tus intercambios (GET /trades) ya son datos
// reales; el historial de cláusulas y ventas se conecta después.
export default function History() {
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [scores, setScores] = useState<GameweekScore[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLeagueId) return;
    setLoading(true);
    Promise.all([
      api<{ scores: GameweekScore[] }>(`/leagues/${activeLeagueId}/scores`),
      api<{ trades: Trade[] }>(`/trades?leagueId=${activeLeagueId}`),
    ])
      .then(([s, t]) => {
        setScores(s.scores);
        setTrades(t.trades.filter((tr) => tr.status !== "pending"));
      })
      .catch(() => {
        setScores([]);
        setTrades([]);
      })
      .finally(() => setLoading(false));
  }, [activeLeagueId]);

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Historial</h1>
        <p className="muted">Tu historia empieza dentro de una liga. Entra a una y empieza a competir.</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  const totalPoints = scores.reduce((s, g) => s + g.points, 0);
  const events: Event[] = [
    ...scores
      .filter((g) => g.status === "finished")
      .map((g): Event => ({ kind: "jornada", date: `gw-${g.gameweek}`, gw: g })),
    ...trades.map((t): Event => ({ kind: "trade", date: t.createdAt, trade: t })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <h1>Historial</h1>
          <p className="muted">Tus puntos, tus tratos y cada capítulo de esta liga.</p>
        </div>
        <div className={styles.totalBadge}>
          <span className={styles.totalNum}>{totalPoints}</span>
          <span className="caption">pts totales</span>
        </div>
      </div>

      {loading && <p className="muted">Cargando…</p>}
      {!loading && events.length === 0 && (
        <p className="muted">Tu historia aún está por escribirse. La primera jornada o el primer trato aparecerán aquí.</p>
      )}

      <div className={styles.feed}>
        {events.map((e) =>
          e.kind === "jornada" ? (
            <div key={`gw-${e.gw.gameweek}`} className={styles.row}>
              <span className={`${styles.icon} ${styles.iconGw}`}>🏆</span>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{e.gw.gameweekLabel}</span>
                <span className="caption">Puntos de tu once esa jornada</span>
              </div>
              <span className={styles.rowPoints}>{e.gw.points} pts</span>
            </div>
          ) : (
            <div key={e.trade.id} className={styles.row}>
              <span className={`${styles.icon} ${e.trade.status === "accepted" ? styles.iconOk : styles.iconMuted}`}>
                <IconExchange size={16} />
              </span>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>
                  {e.trade.fromUserId === userId
                    ? `Intercambio a ${e.trade.toUser.name}`
                    : `Intercambio de ${e.trade.fromUser.name}`}
                </span>
                <span className="caption">
                  {e.trade.offeredPlayer?.name} ↔ {e.trade.requestedPlayer?.name}
                  {e.trade.coins > 0 && (
                    <>
                      {" "}
                      +{e.trade.coins} <IconCoin size={11} />
                    </>
                  )}
                </span>
              </div>
              <span className={`${styles.statusTag} ${e.trade.status === "accepted" ? styles.statusOk : styles.statusRejected}`}>
                {e.trade.status === "accepted" ? "Aceptado" : "Rechazado"}
              </span>
            </div>
          )
        )}
      </div>

      <p className={`caption ${styles.comingSoon}`}>Pronto también verás aquí tus cláusulas y ventas.</p>
    </div>
  );
}
