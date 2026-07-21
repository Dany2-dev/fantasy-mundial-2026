import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { IconCoin } from "../components/icons";
import PlayerCard from "../components/PlayerCard";
import PlayerDetailModal from "../components/PlayerDetailModal";
import { formatMoney } from "../lib/money";
import { fetchCollection } from "../store/collectionSlice";
import { fetchLeagues } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Listing, MarketCard, Trade } from "../types";
import styles from "./Market.module.css";

type Tab = "cartas" | "ventas" | "recibidas" | "enviadas";

export default function Market() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  // Presupuesto de la liga activa (el dinero es por liga, no global).
  const budget = useAppSelector(
    (s) => s.leagues.leagues.find((l) => l.id === s.leagues.activeLeagueId)?.myCoins ?? 0
  );
  const myCards = useAppSelector((s) => s.collection.items);

  const [tab, setTab] = useState<Tab>("cartas");
  const [market, setMarket] = useState<MarketCard[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [target, setTarget] = useState<{ playerId: number; ownerId: string; name: string } | null>(null);
  const [offeredId, setOfferedId] = useState<number | "">("");
  const [coins, setCoinsOffer] = useState(0);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(() => {
    if (!activeLeagueId) return;
    api<{ market: MarketCard[] }>(`/collection/market?leagueId=${activeLeagueId}`)
      .then((d) => setMarket(d.market))
      .catch(() => setMarket([]));
    api<{ listings: Listing[] }>(`/listings?leagueId=${activeLeagueId}`)
      .then((d) => setListings(d.listings))
      .catch(() => setListings([]));
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
          toUserId: target.ownerId,
          offeredPlayerId: offeredId,
          requestedPlayerId: target.playerId,
          coins,
        }),
      });
      setTarget(null);
      setOfferedId("");
      setCoinsOffer(0);
      setMsg({ kind: "ok", text: "Oferta enviada. Puedes seguirla en Enviadas." });
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
      setMsg({ kind: "ok", text: accept ? "¡Trato cerrado!" : "Oferta rechazada" });
      refresh();
      dispatch(fetchLeagues()); // refresca el presupuesto de la liga
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo responder" });
    }
  }

  async function buyListing(id: string) {
    setMsg(null);
    try {
      await api(`/listings/${id}/buy`, { method: "POST" });
      setMsg({ kind: "ok", text: "¡Fichaje cerrado!" });
      refresh();
      dispatch(fetchLeagues()); // refresca el presupuesto de la liga
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo comprar" });
    }
  }

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Mercado</h1>
        <p className="muted">El mercado se mueve dentro de tu liga. Entra a una y empieza a fichar.</p>
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
      <p className="muted">Negocia, vende o lanza un clausulazo antes de que otro mánager se adelante.</p>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ["cartas", `Clausulazo (${market.length})`],
            ["ventas", `Ventas (${listings.length})`],
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
          <p className="caption">Toca una carta y mueve ficha: paga su cláusula o manda una oferta.</p>
          {market.length === 0 && (
            <p className="muted">
              El mercado está quieto por ahora. Invita al grupo y que empiecen los fichajes.
            </p>
          )}
          <div className={styles.grid}>
            {market.map((card) => (
              <PlayerCard
                key={card.id}
                player={card}
                ownerName={card.owner.name}
                onClick={() => {
                  setOpenPlayerId(card.id);
                  setMsg(null);
                }}
              />
            ))}
          </div>
        </>
      )}

      {tab === "ventas" && (
        <div className={styles.tradeList}>
          {listings.length === 0 && <p className="muted">No hay cartas a la venta. Vuelve pronto o busca un clausulazo.</p>}
          {listings.map((l) => (
            <div key={l.id} className={styles.trade}>
              <p>
                <strong>{l.player.name}</strong> ({l.player.rating}) de <strong>{l.seller.name}</strong> —{" "}
                {formatMoney(l.price)} <IconCoin size={14} className={styles.inlineIcon} />
              </p>
              {l.sellerId === user?.id ? (
                <span className="caption">Es tu publicación</span>
              ) : (
                <button className="primary" onClick={() => buyListing(l.id)}>
                  Comprar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "recibidas" && (
        <div className={styles.tradeList}>
          {received.length === 0 && <p className="muted">Tu bandeja está tranquila: no tienes ofertas por responder.</p>}
          {received.map((t) => (
            <div key={t.id} className={styles.trade}>
              <p>
                <strong>{t.fromUser.name}</strong> te ofrece{" "}
                <strong>{t.offeredPlayer?.name}</strong>
                {t.coins > 0 && (
                  <>
                    {" "}
                    + {formatMoney(t.coins)} <IconCoin size={14} className={styles.inlineIcon} />
                  </>
                )}{" "}
                por tu <strong>{t.requestedPlayer?.name}</strong>
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
          {sent.length === 0 && <p className="muted">Aún no has movido ficha. Busca un jugador y manda tu primera oferta.</p>}
          {sent.map((t) => (
            <div key={t.id} className={styles.trade}>
              <p>
                Ofreciste <strong>{t.offeredPlayer?.name}</strong>
                {t.coins > 0 && (
                  <>
                    {" "}
                    + {formatMoney(t.coins)} <IconCoin size={14} className={styles.inlineIcon} />
                  </>
                )}{" "}
                a <strong>{t.toUser.name}</strong> por <strong>{t.requestedPlayer?.name}</strong>
              </p>
              <span className={`${styles.status} ${styles[t.status]}`}>
                {t.status === "pending" ? "Pendiente" : t.status === "accepted" ? "Aceptada" : "Rechazada"}
              </span>
            </div>
          ))}
        </div>
      )}

      {openPlayerId != null && (
        <PlayerDetailModal
          playerId={openPlayerId}
          leagueId={activeLeagueId}
          onClose={() => setOpenPlayerId(null)}
          onChanged={refresh}
          onProposeTrade={(playerId, ownerId) => {
            const card = market.find((c) => c.id === playerId);
            setOpenPlayerId(null);
            setTarget({ playerId, ownerId, name: card?.name ?? "" });
          }}
        />
      )}

      {target && (
        <div className={styles.modalBackdrop} onClick={() => setTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Proponer intercambio">
            <h3>Vas por {target.name}</h3>
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
              <span className="caption">Euros extra (opcional) — tienes {formatMoney(budget)} en esta liga</span>
              <input
                type="number"
                min={0}
                max={budget}
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
