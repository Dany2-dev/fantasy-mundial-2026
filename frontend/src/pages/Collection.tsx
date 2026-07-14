import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconCards } from "../components/icons";
import PlayerCard from "../components/PlayerCard";
import PlayerDetailModal from "../components/PlayerDetailModal";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { rarityOf } from "../types";
import styles from "./Collection.module.css";

const FILTERS = ["Todos", "POR", "DEF", "MED", "DEL"] as const;

export default function Collection() {
  const dispatch = useAppDispatch();
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const { items, status } = useAppSelector((s) => s.collection);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todos");
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);

  useEffect(() => {
    if (activeLeagueId) dispatch(fetchCollection(activeLeagueId));
  }, [dispatch, activeLeagueId]);

  const visible = filter === "Todos" ? items : items.filter((p) => p.position === filter);

  // Estadísticas derivadas para la cabecera y los contadores de filtros.
  const counts = (pos: (typeof FILTERS)[number]) =>
    pos === "Todos" ? items.length : items.filter((p) => p.position === pos).length;
  const avgRating = items.length ? Math.round(items.reduce((s, p) => s + p.rating, 0) / items.length) : 0;
  const totalValue = items.reduce((s, p) => s + p.rating, 0);
  const goldCount = items.filter((p) => rarityOf(p.rating) === "oro").length;

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyBadge} aria-hidden="true">
          <IconCards size={30} />
        </span>
        <h1>Colección</h1>
        <p className="muted">Primero entra a una liga. Ahí vas a reunir todos tus fichajes.</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ===== Cabecera con estadísticas ===== */}
      <section className={styles.hero}>
        <img src="/stadium/stadium-seats.jpg" alt="" className={styles.heroArt} aria-hidden="true" />
        <span className={styles.heroWash} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div>
            <span className={styles.eyebrow}>Mi club</span>
            <h1 className={styles.title}>Colección</h1>
            <p className={styles.sub}>Aquí están todos tus fichajes. Filtra por posición y encuentra tu próximo titular.</p>
          </div>

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{items.length}</span>
              <span className={styles.statLabel}>Cartas</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{avgRating || "—"}</span>
              <span className={styles.statLabel}>Media</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} data-accent="gold">
                {goldCount}
              </span>
              <span className={styles.statLabel}>Cartas oro</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} data-accent="green">
                {totalValue.toLocaleString("es-MX")}
              </span>
              <span className={styles.statLabel}>Valor</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Filtros por posición ===== */}
      <div className={styles.filters} role="group" aria-label="Filtrar por posición">
        {FILTERS.map((f) => (
          <button
            key={f}
            data-pos={f}
            className={`${styles.filterChip} ${filter === f ? styles.filterActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
            <span className={styles.filterCount}>{counts(f)}</span>
          </button>
        ))}
      </div>

      {status === "ready" && items.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyBadge} aria-hidden="true">
            <IconCards size={30} />
          </span>
          <p className="muted">Tu álbum sigue en blanco… Abre un sobre y empieza a armar tu club.</p>
          <Link to="/sobres">
            <button className="primary">Abrir mi primer sobre</button>
          </Link>
        </div>
      )}

      {status === "ready" && items.length > 0 && visible.length === 0 && (
        <div className={styles.empty}>
          <p className="muted">No tienes cartas en esta posición. Prueba otro filtro o sal a fichar.</p>
        </div>
      )}

      <div className={styles.grid}>
        {visible.map((p) => (
          <PlayerCard key={p.id} player={p} onClick={() => setOpenPlayerId(p.id)} />
        ))}
      </div>

      {openPlayerId != null && (
        <PlayerDetailModal
          playerId={openPlayerId}
          leagueId={activeLeagueId}
          onClose={() => setOpenPlayerId(null)}
          onChanged={() => dispatch(fetchCollection(activeLeagueId))}
        />
      )}
    </div>
  );
}
