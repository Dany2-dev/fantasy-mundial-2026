import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import PlayerCard from "../components/PlayerCard";
import { fetchCollection } from "../store/collectionSlice";
import { fetchMe } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { MarketCard, Trade } from "../types";
import styles from "./Market.module.css";

type Tab = "cartas" | "recibidas" | "enviadas";

export default function Market() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const myCards = useAppSelector((s) => s.collection.items);

  const [tab, setTab] = useState<Tab>("cartas");
  const [market, setMarket] = useState<MarketCard[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [target, setTarget] = useState<MarketCard | null>(null);
  const [offeredId, setOfferedId] = useState<number | "">("");
  const [coins, setCoinsOffer] = useState(0);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(() => {
    if (!activeLeagueId) return;
    api<{ market: MarketCard[] }>(`/collection/market?leagueId=${activeLeagueId}`)
      .then((d) => setMarket(d.market))
      .catch(() => setMarket([]));
    api<{ trades: Trade[] }>(`/trades?leagueId=${activeLeagueId}`)
      .then((d) => setTrades(d.trades))
      .catch(() => setTrades([]));
    dispatch(fetchCollection(activeLeagueId));
  }, [activeLeagueId, dispatch]);

  useEffect(refresh, [refresh]);

  async function sendOffer() {
    if (!activeLeagueId || !target || offeredId === "") return;
    setMsg(null);
    try {
      await api("/trades", {
        method: "POST",
        body: JSON.stringify({
          leagueId: activeLeagueId,
          toUserId: target.owner.id,
          offeredPlayerId: offeredId,
          requestedPlayerId: target.id,
          coins,
        }),
      });
      setTarget(null);
      setOfferedId("");
      setCoinsOffer(0);
      setMsg({ kind: "ok", text: "Oferta enviada. La verás en Enviadas." });
      refresh();
      setTab("enviadas");
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo enviar la oferta" });
    }
  }

  async function respond(tradeId: string, accept: boolean) {
    setMsg(null);
    try {
      await api(`/trades/${tradeId}/respond`, { method: "POST", body: JSON.stringify({ accept }) });
      setMsg({ kind: "ok", text: accept ? "¡Intercambio hecho!" : "Oferta rechazada" });
      refresh();
      dispatch(fetchMe());
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo responder" });
    }
  }

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Mercado</h1>
        <p className="muted">El mercado es entre los mánagers de tu liga.</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  const received = trades.filter((t) => t.toUserId === user?.id && t.status === "pending");
  const sent = trades.filter((t) => t.fromUserId === user?.id);

  return (
    <div>
      <h1>Mercado</h1>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ["cartas", `Cartas (${market.length})`],
            ["recibidas", `Recibidas (${received.length})`],
            ["enviadas", `Enviadas (${sent.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>}

      {tab === "cartas" && (
        <>
          {market.length === 0 && (
            <p className="muted">
              Nadie más tiene cartas todavía. Invita a tus amigos con el código de la liga.
            </p>
          )}
          <div className={styles.grid}>
            {market.map((card) => (
              <PlayerCard
                key={card.id}
                player={card}
                ownerName={card.owner.name}
                onClick={() => {
                  setTarget(card);
                  setMsg(null);
                }}
              />
            ))}
          </div>
        </>
      )}

      {tab === "recibidas" && (
        <div className={styles.tradeList}>
          {received.length === 0 && <p className="muted">No tienes ofertas pendientes.</p>}
          {received.map((t) => (
            <div key={t.id} className={styles.trade}>
              <p>
                <strong>{t.fromUser.name}</strong> te ofrece{" "}
                <strong>{t.offeredPlayer?.name}</strong>
                {t.coins > 0 && <> + {t.coins.toLocaleString("es-MX")} 🪙</>} por tu{" "}
                <strong>{t.requestedPlayer?.name}</strong>
              </p>
              <div className={styles.tradeActions}>
                <button className="primary" onClick={() => respond(t.id, true)}>
                  Aceptar
                </button>
                <button className="danger" onClick={() => respond(t.id, false)}>
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "enviadas" && (
        <div className={styles.tradeList}>
          {sent.length === 0 && <p className="muted">No has enviado ofertas.</p>}
          {sent.map((t) => (
            <div key={t.id} className={styles.trade}>
              <p>
                Ofreciste <strong>{t.offeredPlayer?.name}</strong>
                {t.coins > 0 && <> + {t.coins.toLocaleString("es-MX")} 🪙</>} a{" "}
                <strong>{t.toUser.name}</strong> por <strong>{t.requestedPlayer?.name}</strong>
              </p>
              <span className={`${styles.status} ${styles[t.status]}`}>
                {t.status === "pending" ? "Pendiente" : t.status === "accepted" ? "Aceptada" : "Rechazada"}
              </span>
            </div>
          ))}
        </div>
      )}

      {target && (
        <div className={styles.modalBackdrop} onClick={() => setTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Proponer intercambio">
            <h3>
              Quieres a {target.name} <span className="muted">(de {target.owner.name})</span>
            </h3>
            <label className={styles.field}>
              <span className="caption">Tu carta a cambio</span>
              <select value={offeredId} onChange={(e) => setOfferedId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Elige una carta…</option>
                {myCards.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.rating} · {p.position})
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className="caption">Monedas extra (opcional) — tienes {user?.coins.toLocaleString("es-MX")}</span>
              <input
                type="number"
                min={0}
                max={user?.coins ?? 0}
                value={coins}
                onChange={(e) => setCoinsOffer(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <div className={styles.tradeActions}>
              <button className="primary" onClick={sendOffer} disabled={offeredId === ""}>
                Enviar oferta
              </button>
              <button className="ghost" onClick={() => setTarget(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
