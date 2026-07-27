import { ReactNode, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import FlipReveal from "../components/FlipReveal";
import { IconClock, IconCoin, IconExchange } from "../components/icons";
import PlayerCard from "../components/PlayerCard";
import PlayerDetailModal from "../components/PlayerDetailModal";
import { formatMoney } from "../lib/money";
import { fetchCollection } from "../store/collectionSlice";
import { fetchLeagues } from "../store/leagueSlice";
import { clearLastSigned, signFreeAgent } from "../store/marketSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { FreeAgent, Listing, MarketCard, Player, Trade } from "../types";
import styles from "./Market.module.css";

type Tab = "libres" | "cartas" | "ventas" | "recibidas" | "enviadas";

/** Cuenta atrás legible hasta el próximo lote de agentes libres. */
function useCountdown(target: string | null) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!target) return setLeft("");
    const tick = () => {
      const ms = new Date(target).getTime() - Date.now();
      if (ms <= 0) return setLeft("¡ya casi!");
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(h > 0 ? `${h} h ${m} min` : `${m} min`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

/** Una oferta puesta cara a cara: lo que se ofrece contra lo que se pide, con
 *  el dinero de por medio. Se lee de un vistazo, sin frases largas. */
function TradeDuel({
  trade,
  incoming,
  actions,
  onOpenPlayer,
}: {
  trade: Trade;
  incoming?: boolean;
  actions: ReactNode;
  onOpenPlayer: (playerId: number) => void;
}) {
  const rival = incoming ? trade.fromUser.name : trade.toUser.name;
  return (
    <article className={styles.duel}>
      <header className={styles.duelHead}>
        <span className={styles.duelWho}>
          {incoming ? (
            <>
              <strong>{rival}</strong> quiere tu carta
            </>
          ) : (
            <>
              Tu oferta a <strong>{rival}</strong>
            </>
          )}
        </span>
        <span className={styles.duelWhen}>{timeAgo(trade.createdAt)}</span>
      </header>

      <div className={styles.duelBody}>
        <div className={styles.duelSide}>
          <span className={styles.duelTag}>{incoming ? "Te dan" : "Ofreces"}</span>
          {trade.offeredPlayer ? (
            <PlayerCard size="sm" player={trade.offeredPlayer} onClick={() => onOpenPlayer(trade.offeredPlayer!.id)} />
          ) : (
            <span className="muted">Carta no disponible</span>
          )}
        </div>

        <div className={styles.duelMiddle}>
          <span className={styles.duelSwap} aria-hidden="true">
            <IconExchange size={20} />
          </span>
          {trade.coins > 0 && (
            <span className={styles.duelCoins}>
              <IconCoin size={13} className={styles.inlineIcon} />
              {formatMoney(trade.coins)}
            </span>
          )}
        </div>

        <div className={styles.duelSide}>
          <span className={styles.duelTag}>{incoming ? "Te piden" : "Pides"}</span>
          {trade.requestedPlayer ? (
            <PlayerCard size="sm" player={trade.requestedPlayer} onClick={() => onOpenPlayer(trade.requestedPlayer!.id)} />
          ) : (
            <span className="muted">Carta no disponible</span>
          )}
        </div>
      </div>

      <footer className={styles.duelFoot}>{actions}</footer>
    </article>
  );
}

/** "hace 5 min", "hace 2 h", "hace 3 d" — para saber qué tan fresca es la oferta. */
function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export default function Market() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  // Presupuesto de la liga activa (el dinero es por liga, no global).
  const budget = useAppSelector(
    (s) => s.leagues.leagues.find((l) => l.id === s.leagues.activeLeagueId)?.myCoins ?? 0
  );
  const myCards = useAppSelector((s) => s.collection.items);

  // Estado del fichaje (en curso, recién cerrado y error) desde el slice.
  const { signingPlayerId, lastSigned, error: signError } = useAppSelector((s) => s.market);

  const [tab, setTab] = useState<Tab>("libres");
  const [market, setMarket] = useState<MarketCard[]>([]);
  const [agents, setAgents] = useState<FreeAgent[]>([]);
  const [refreshesAt, setRefreshesAt] = useState<string | null>(null);
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
    api<{ agents: FreeAgent[]; refreshesAt: string | null }>(`/free-agents?leagueId=${activeLeagueId}`)
      .then((d) => {
        setAgents(d.agents);
        setRefreshesAt(d.refreshesAt);
      })
      .catch(() => setAgents([]));
    dispatch(fetchCollection(activeLeagueId));
  }, [activeLeagueId, dispatch]);

  useEffect(refresh, [refresh]);

  // Se llama antes de cualquier return temprano: es un hook.
  const countdown = useCountdown(refreshesAt);

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

  // El fichaje vive en el slice de mercado: el thunk hace la llamada, refresca
  // presupuesto y colección, y deja el jugador en `lastSigned` para que salga
  // la carta dándose la vuelta.
  async function signAgent(player: Player, price: number) {
    if (!activeLeagueId) return;
    setMsg(null);
    const result = await dispatch(signFreeAgent({ leagueId: activeLeagueId, player, price }));
    if (signFreeAgent.fulfilled.match(result)) refresh();
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
  // Valor de tu plantilla, para saber de un vistazo qué tan grande eres.
  const squadValue = myCards.reduce((sum, c) => sum + (c.basePrice ?? 0), 0);

  return (
    <div>
      <h1>Mercado</h1>
      <p className="muted">Ficha libre, cierra tratos o paga la cláusula. Aquí no hay amigos.</p>

      {/* ---- Tu caja: el dinero es el recurso central de esta página ---- */}
      <section className={styles.wallet}>
        <div className={styles.walletMain}>
          <span className={styles.walletLabel}>Tu presupuesto en esta liga</span>
          <strong className={styles.walletAmount}>{formatMoney(budget)}</strong>
        </div>
        <div className={styles.walletStats}>
          <div className={styles.walletStat}>
            <span className={styles.walletStatValue}>{myCards.length}</span>
            <span className={styles.walletStatLabel}>Cartas</span>
          </div>
          <div className={styles.walletStat}>
            <span className={styles.walletStatValue}>{formatMoney(squadValue)}</span>
            <span className={styles.walletStatLabel}>Valor plantilla</span>
          </div>
          <div className={styles.walletStat}>
            <span className={styles.walletStatValue}>{received.length}</span>
            <span className={styles.walletStatLabel}>Ofertas por responder</span>
          </div>
        </div>
        {countdown && (
          <span className={styles.walletTimer} title="Tiempo hasta el próximo lote de agentes libres">
            <IconClock size={14} /> Nuevo mercado en {countdown}
          </span>
        )}
      </section>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ["libres", `Agentes libres (${agents.length})`],
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
            {/* Las ofertas por responder no se pueden pasar por alto */}
            {key === "recibidas" && received.length > 0 && tab !== "recibidas" && (
              <span className={styles.tabDot} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      {msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>}
      {signError && <p className="error-text">{signError}</p>}

      {tab === "libres" && (
        <>
          <div className={styles.agentsHead}>
            <p className="caption">
              Jugadores sin dueño en tu liga. Se van al primero que pague, y el lote se renueva entero cada 24 h.
            </p>
            {countdown && (
              <span className={styles.agentsTimer} title="Tiempo hasta el próximo lote">
                <IconClock size={14} /> Nuevo mercado en {countdown}
              </span>
            )}
          </div>

          {agents.length === 0 && (
            <p className="muted">Ya no quedan jugadores libres. Aquí todo tiene dueño: ve por un clausulazo.</p>
          )}

          <div className={styles.agentGrid}>
            {agents.map((a) => {
              const tooExpensive = a.price > budget;
              return (
                <div key={a.id} className={styles.agentCard}>
                  <button
                    className={styles.agentCardBtn}
                    onClick={() => {
                      setOpenPlayerId(a.playerId);
                      setMsg(null);
                    }}
                    aria-label={`Ver a ${a.player.name}`}
                  >
                    <PlayerCard player={a.player} />
                  </button>
                  <button
                    className={`primary ${styles.agentSign}`}
                    onClick={() => signAgent(a.player, a.price)}
                    disabled={signingPlayerId !== null || tooExpensive}
                    title={tooExpensive ? "No te alcanza el presupuesto de esta liga" : undefined}
                  >
                    {signingPlayerId === a.playerId ? "Fichando…" : `Fichar · ${formatMoney(a.price)}`}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

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
        <>
          {listings.length === 0 && <p className="muted">No hay cartas a la venta. Vuelve pronto o busca un clausulazo.</p>}
          <div className={styles.listingGrid}>
            {listings.map((l) => {
              const mine = l.sellerId === user?.id;
              const tooExpensive = l.price > budget;
              // Comparar el precio pedido contra el valor de mercado dice si es ganga o robo.
              const diff = l.player.basePrice ? Math.round(((l.price - l.player.basePrice) / l.player.basePrice) * 100) : 0;
              return (
                <article key={l.id} className={styles.listing}>
                  <PlayerCard size="sm" player={l.player} onClick={() => setOpenPlayerId(l.playerId)} />
                  <div className={styles.listingInfo}>
                    <span className={styles.listingSeller}>
                      {mine ? "Tu publicación" : `Vende ${l.seller.name}`}
                    </span>
                    <strong className={styles.listingPrice}>{formatMoney(l.price)}</strong>
                    {l.player.basePrice > 0 && (
                      <span className={styles.listingDiff} data-deal={diff <= 0 ? "si" : "no"}>
                        {diff <= 0 ? `${Math.abs(diff)}% bajo valor` : `${diff}% sobre valor`}
                      </span>
                    )}
                    <span className={styles.listingWhen}>{timeAgo(l.createdAt)}</span>
                    {mine ? (
                      <span className="caption">Esperando comprador</span>
                    ) : (
                      <button
                        className={`primary ${styles.listingBuy}`}
                        onClick={() => buyListing(l.id)}
                        disabled={tooExpensive}
                        title={tooExpensive ? "No te alcanza el presupuesto de esta liga" : undefined}
                      >
                        Comprar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {tab === "recibidas" && (
        <div className={styles.tradeList}>
          {received.length === 0 && <p className="muted">Tu bandeja está tranquila: no tienes ofertas por responder.</p>}
          {received.map((t) => (
            <TradeDuel
              key={t.id}
              trade={t}
              incoming
              onOpenPlayer={(id) => setOpenPlayerId(id)}
              actions={
                <div className={styles.tradeActions}>
                  <button className="primary" onClick={() => respond(t.id, true)}>
                    Aceptar
                  </button>
                  <button className="danger" onClick={() => respond(t.id, false)}>
                    Rechazar
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {tab === "enviadas" && (
        <div className={styles.tradeList}>
          {sent.length === 0 && <p className="muted">Aún no has movido ficha. Busca un jugador y manda tu primera oferta.</p>}
          {sent.map((t) => (
            <TradeDuel
              key={t.id}
              trade={t}
              onOpenPlayer={(id) => setOpenPlayerId(id)}
              actions={
                <span className={`${styles.status} ${styles[t.status]}`}>
                  {t.status === "pending" ? "Pendiente" : t.status === "accepted" ? "Aceptada" : "Rechazada"}
                </span>
              }
            />
          ))}
        </div>
      )}

      {/* ---- Fichaje cerrado: la carta se da la vuelta, como en el sobre ---- */}
      {lastSigned && (
        <div className={styles.signOverlay} role="dialog" aria-label={`Fichaste a ${lastSigned.player.name}`}>
          <p className={styles.signKicker}>Fichaje cerrado</p>
          <h2 className={styles.signTitle}>¡{lastSigned.player.name} es tuyo!</h2>
          <FlipReveal player={lastSigned.player} delay={350} />
          <p className={styles.signPrice}>
            <IconCoin size={16} className={styles.inlineIcon} />
            Se fueron {formatMoney(lastSigned.price)} de tu presupuesto
          </p>
          <button className="primary" onClick={() => dispatch(clearLastSigned())}>
            Seguir en el mercado
          </button>
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
