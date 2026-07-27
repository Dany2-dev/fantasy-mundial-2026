import { useEffect, useState } from "react";
import { api } from "../api/client";
import { formatMoney } from "../lib/money";
import { fetchLeagues } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { PlayerDetail, rarityOf } from "../types";
import Flag from "./Flag";
import { IconClose, IconCoin, IconShield } from "./icons";
import PlayerCard from "./PlayerCard";
import styles from "./PlayerDetailModal.module.css";

interface Props {
  playerId: number;
  leagueId: string;
  onClose: () => void;
  onChanged?: () => void;
  onProposeTrade?: (playerId: number, ownerId: string) => void;
}

/** Atajos para subir cláusula sin teclear siete ceros. */
const RAISE_PRESETS = [1_000_000, 5_000_000, 10_000_000, 25_000_000];
/** Atajos de precio de venta, relativos al valor de mercado del jugador. */
const SELL_PRESETS = [
  { label: "Valor", factor: 1 },
  { label: "+25%", factor: 1.25 },
  { label: "+50%", factor: 1.5 },
  { label: "Doble", factor: 2 },
];

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export default function PlayerDetailModal({ playerId, leagueId, onClose, onChanged, onProposeTrade }: Props) {
  const dispatch = useAppDispatch();
  // Presupuesto del usuario EN ESTA LIGA (el dinero es por liga, no global).
  const coins = useAppSelector(
    (s) => s.leagues.leagues.find((l) => l.id === leagueId)?.myCoins ?? 0
  );

  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(1_000_000);
  const [sellPrice, setSellPrice] = useState(0);

  function load() {
    setLoading(true);
    api<PlayerDetail>(`/players/${playerId}?leagueId=${leagueId}`)
      .then((d) => {
        setDetail(d);
        setSellPrice(d.ownership?.clause ?? d.player.basePrice);
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }

  useEffect(load, [playerId, leagueId]);

  async function run(action: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      setMsg({ kind: "ok", text: okText });
      load();
      dispatch(fetchLeagues()); // refresca el presupuesto de la liga
      onChanged?.();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Algo falló" });
    } finally {
      setBusy(false);
    }
  }

  const raise = () =>
    run(
      () => api("/clause/raise", { method: "POST", body: JSON.stringify({ leagueId, playerId, amount: raiseAmount }) }),
      `¡Crack blindado! Sumaste ${formatMoney(raiseAmount)} a su cláusula.`
    );

  const clausulazo = () =>
    run(
      () => api("/clause/pay", { method: "POST", body: JSON.stringify({ leagueId, playerId }) }),
      "¡Clausulazo! Ya es jugador de tu club."
    );

  const sell = () =>
    run(
      () => api("/listings", { method: "POST", body: JSON.stringify({ leagueId, playerId, price: sellPrice }) }),
      "¡Carta publicada! Ya está en el mercado."
    );

  const cancelSale = () =>
    run(() => api(`/listings/${detail?.listing?.id}`, { method: "DELETE" }), "Venta cancelada. Ya no está en el mercado.");

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Detalle del jugador">
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <IconClose size={18} />
        </button>

        {loading && <p className="muted">Cargando…</p>}

        {!loading && !detail && <p className="error-text">No se pudo cargar este jugador.</p>}

        {!loading && detail && (
          <>
            {/* Banda superior teñida por la rareza de la carta: le da identidad
                al modal y separa la identidad del jugador de las acciones. */}
            <header className={styles.head} data-rarity={rarityOf(detail.player.rating)}>
              <div className={styles.headCard}>
                <PlayerCard player={detail.player} />
              </div>
              <div className={styles.headInfo}>
                <span className={styles.posChip}>{detail.player.position}</span>
                <h3 className={styles.name}>{detail.player.name}</h3>
                <p className={styles.headSub}>
                  <Flag team={detail.player.team} size={18} /> {detail.player.team.name}
                  {detail.player.age ? ` · ${detail.player.age} años` : ""}
                </p>

                <div className={styles.ownerBlock}>
                  {detail.ownership ? (
                    <span className={detail.ownership.isMine ? styles.mineTag : styles.ownerTag}>
                      {detail.ownership.isMine ? "En tu club" : detail.ownership.owner.name}
                    </span>
                  ) : (
                    <span className={styles.freeTag}>Agente libre</span>
                  )}
                  {detail.ownership?.protected && (
                    <span className={styles.protectedTag}>
                      <IconShield size={13} /> Protegido hasta {formatDate(detail.ownership.protectedUntil)}
                    </span>
                  )}
                  {detail.listing && <span className={styles.listedTag}>En venta · {formatMoney(detail.listing.price)}</span>}
                </div>
              </div>
            </header>

            {/* Los tres números que de verdad importan para decidir. */}
            <div className={styles.facts}>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Media</span>
                <strong className={`${styles.factValue} tabular`}>{detail.player.rating}</strong>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Valor de mercado</span>
                <strong className={`${styles.factValue} tabular`}>{formatMoney(detail.player.basePrice)}</strong>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Cláusula</span>
                <strong className={`${styles.factValue} ${styles.factClause} tabular`}>
                  {detail.ownership ? formatMoney(detail.ownership.clause) : "—"}
                </strong>
              </div>
            </div>

            {msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>}

            {detail.ownership?.isMine && (
              <div className={styles.actions}>
                <div className={styles.actionBlock}>
                  <div className={styles.actionHead}>
                    <span className={styles.actionTitle}>Blindar</span>
                    <span className={styles.budget}>
                      <IconCoin size={13} /> {formatMoney(coins)}
                    </span>
                  </div>
                  <p className={styles.actionHint}>
                    Subir la cláusula cuesta ese mismo dinero, pero encarece el clausulazo de tus rivales.
                  </p>
                  {/* Atajos: teclear "10000000" a mano era el paso más torpe del modal. */}
                  <div className={styles.presets}>
                    {RAISE_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className={`${styles.preset} ${raiseAmount === amount ? styles.presetOn : ""}`}
                        onClick={() => setRaiseAmount(amount)}
                        disabled={amount > coins}
                      >
                        +{formatMoney(amount)}
                      </button>
                    ))}
                  </div>
                  <div className={styles.inputBtn}>
                    <input
                      type="number"
                      min={1}
                      step={500_000}
                      value={raiseAmount}
                      onChange={(e) => setRaiseAmount(Math.max(1, Number(e.target.value)))}
                      aria-label="Cuánto subir la cláusula"
                    />
                    <button className="ghost" onClick={raise} disabled={busy || raiseAmount > coins}>
                      Subir
                    </button>
                  </div>
                  <p className={styles.preview}>
                    Quedaría en <strong>{formatMoney(detail.ownership.clause + raiseAmount)}</strong>
                    {raiseAmount > coins && <span className={styles.warn}> · no te alcanza</span>}
                  </p>
                </div>

                <div className={styles.actionBlock}>
                  {detail.listing ? (
                    <>
                      <span className={styles.actionTitle}>En venta</span>
                      <p className={styles.actionHint}>
                        Publicado por {formatMoney(detail.listing.price)}. Cualquier mánager de la liga puede comprarlo.
                      </p>
                      <button className="danger" onClick={cancelSale} disabled={busy}>
                        Quitar de venta
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={styles.actionTitle}>Vender</span>
                      <p className={styles.actionHint}>
                        Se publica en el mercado al precio que pongas. Vale {formatMoney(detail.player.basePrice)}.
                      </p>
                      <div className={styles.presets}>
                        {SELL_PRESETS.map(({ label, factor }) => (
                          <button
                            key={label}
                            type="button"
                            className={styles.preset}
                            onClick={() => setSellPrice(Math.max(1, Math.round(detail.player.basePrice * factor)))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className={styles.inputBtn}>
                        <input
                          type="number"
                          min={1}
                          step={500_000}
                          value={sellPrice}
                          onChange={(e) => setSellPrice(Math.max(1, Number(e.target.value)))}
                          aria-label="Precio de venta"
                        />
                        <button className="primary" onClick={sell} disabled={busy}>
                          Vender
                        </button>
                      </div>
                      <p className={styles.preview}>
                        Pides <strong>{formatMoney(sellPrice)}</strong> ·{" "}
                        {sellPrice >= detail.player.basePrice
                          ? `${Math.round((sellPrice / Math.max(1, detail.player.basePrice)) * 100)}% de su valor`
                          : "por debajo de su valor"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {detail.ownership && !detail.ownership.isMine && (
              <div className={styles.actions}>
                <button
                  className="primary"
                  onClick={clausulazo}
                  disabled={busy || detail.ownership.protected || coins < detail.ownership.clause}
                  title={detail.ownership.protected ? "Este jugador está protegido" : undefined}
                >
                  Clausulazo por {formatMoney(detail.ownership.clause)}
                </button>
                {onProposeTrade && (
                  <button
                    className="ghost"
                    onClick={() => onProposeTrade(detail.player.id, detail.ownership!.owner.id)}
                  >
                    Proponer intercambio
                  </button>
                )}
              </div>
            )}

            <h4 className={styles.statsTitle}>Estadísticas por jornada</h4>
            {detail.stats.length === 0 && <p className="muted">Este jugador todavía no tiene estadísticas en el torneo.</p>}
            <div className={styles.statsList}>
              {detail.stats.map((s) => (
                <div key={s.gameweek} className={styles.statRow}>
                  <div className={styles.statGw}>
                    <span>{s.gameweekLabel}</span>
                    {s.match && (
                      <span className="caption">
                        {s.match.home ? "vs" : "@"} {s.match.opponent} · {formatDate(s.match.utcTime)}
                        {s.match.status === "finished" ? ` · ${s.match.homeScore}-${s.match.awayScore}` : ""}
                      </span>
                    )}
                  </div>
                  <div className={styles.statNums}>
                    {s.goals > 0 && <span className={styles.statChip} data-kind="goal">⚽ {s.goals}</span>}
                    {s.assists > 0 && <span className={styles.statChip} data-kind="assist">🅰 {s.assists}</span>}
                    <span className={styles.statPoints}>{s.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
