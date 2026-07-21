import { useEffect, useState } from "react";
import { api } from "../api/client";
import { formatMoney } from "../lib/money";
import { fetchLeagues } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { PlayerDetail } from "../types";
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
            <div className={styles.head}>
              <div className={styles.headCard}>
                <PlayerCard player={detail.player} />
              </div>
              <div className={styles.headInfo}>
                <h3>{detail.player.name}</h3>
                <p className={styles.headSub}>
                  <Flag team={detail.player.team} size={18} /> {detail.player.team.name}
                  {detail.player.age ? ` · ${detail.player.age} años` : ""}
                </p>

                {detail.ownership ? (
                  <div className={styles.ownerBlock}>
                    <span className="caption">
                      {detail.ownership.isMine ? "Es tuyo" : `Dueño: ${detail.ownership.owner.name}`}
                    </span>
                    <span className={styles.clauseTag}>
                      <IconCoin size={14} /> Cláusula {formatMoney(detail.ownership.clause)}
                    </span>
                    {detail.ownership.protected && (
                      <span className={styles.protectedTag}>
                        <IconShield size={13} /> Protegido hasta {formatDate(detail.ownership.protectedUntil)}
                      </span>
                    )}
                    {detail.listing && (
                      <span className={styles.listedTag}>
                        En venta por {formatMoney(detail.listing.price)}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="caption">Todavía está libre en esta liga.</p>
                )}
              </div>
            </div>

            {msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>}

            {detail.ownership?.isMine && (
              <div className={styles.actions}>
                <div className={styles.actionRow}>
                  <label className={styles.field}>
                    <span className="caption">Subir tu cláusula (tienes {formatMoney(coins)})</span>
                    <div className={styles.inputBtn}>
                      <input
                        type="number"
                        min={1}
                        value={raiseAmount}
                        onChange={(e) => setRaiseAmount(Math.max(1, Number(e.target.value)))}
                      />
                      <button className="ghost" onClick={raise} disabled={busy || raiseAmount > coins}>
                        Subir
                      </button>
                    </div>
                  </label>
                </div>

                <div className={styles.actionRow}>
                  {detail.listing ? (
                    <button className="danger" onClick={cancelSale} disabled={busy}>
                      Quitar de venta ({formatMoney(detail.listing.price)})
                    </button>
                  ) : (
                    <label className={styles.field}>
                      <span className="caption">Poner en venta</span>
                      <div className={styles.inputBtn}>
                        <input
                          type="number"
                          min={1}
                          value={sellPrice}
                          onChange={(e) => setSellPrice(Math.max(1, Number(e.target.value)))}
                        />
                        <button className="primary" onClick={sell} disabled={busy}>
                          Vender
                        </button>
                      </div>
                    </label>
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
