import { useEffect, useState } from "react";
import { api } from "../api/client";
import { fetchMe } from "../store/authSlice";
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
  const coins = useAppSelector((s) => s.auth.user?.coins ?? 0);

  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(500);
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
      dispatch(fetchMe());
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
      `Cláusula subida +${raiseAmount.toLocaleString("es-MX")}`
    );

  const clausulazo = () =>
    run(
      () => api("/clause/pay", { method: "POST", body: JSON.stringify({ leagueId, playerId }) }),
      "¡Clausulazo hecho! El jugador ya es tuyo."
    );

  const sell = () =>
    run(
      () => api("/listings", { method: "POST", body: JSON.stringify({ leagueId, playerId, price: sellPrice }) }),
      "Publicado en el mercado"
    );

  const cancelSale = () =>
    run(() => api(`/listings/${detail?.listing?.id}`, { method: "DELETE" }), "Venta cancelada");

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
                      <IconCoin size={14} /> Cláusula {detail.ownership.clause.toLocaleString("es-MX")}
                    </span>
                    {detail.ownership.protected && (
                      <span className={styles.protectedTag}>
                        <IconShield size={13} /> Protegido hasta {formatDate(detail.ownership.protectedUntil)}
                      </span>
                    )}
                    {detail.listing && (
                      <span className={styles.listedTag}>
                        En venta por {detail.listing.price.toLocaleString("es-MX")}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="caption">Nadie lo tiene todavía en esta liga.</p>
                )}
              </div>
            </div>

            {msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>}

            {detail.ownership?.isMine && (
              <div className={styles.actions}>
                <div className={styles.actionRow}>
                  <label className={styles.field}>
                    <span className="caption">Subir tu cláusula (tienes {coins.toLocaleString("es-MX")})</span>
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
                      Quitar de venta ({detail.listing.price.toLocaleString("es-MX")})
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
                  Clausulazo por {detail.ownership.clause.toLocaleString("es-MX")}
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
            {detail.stats.length === 0 && <p className="muted">Aún no hay partidos jugados registrados.</p>}
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
