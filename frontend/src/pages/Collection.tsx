import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PlayerCard from "../components/PlayerCard";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import styles from "./Collection.module.css";

const FILTERS = ["Todos", "POR", "DEF", "MED", "DEL"] as const;

export default function Collection() {
  const dispatch = useAppDispatch();
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const { items, status } = useAppSelector((s) => s.collection);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todos");

  useEffect(() => {
    if (activeLeagueId) dispatch(fetchCollection(activeLeagueId));
  }, [dispatch, activeLeagueId]);

  const visible = filter === "Todos" ? items : items.filter((p) => p.position === filter);

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Colección</h1>
        <p className="muted">Tu colección vive dentro de una liga.</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.headerRow}>
        <h1>Colección</h1>
        <span className="caption tabular">{items.length} cartas</span>
      </div>

      <div className={styles.filters} role="group" aria-label="Filtrar por posición">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`${styles.filterChip} ${filter === f ? styles.filterActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {status === "ready" && items.length === 0 && (
        <div className={styles.empty}>
          <p className="muted">Todavía no tienes cartas en esta liga.</p>
          <Link to="/sobres">
            <button className="primary">Abrir mi primer sobre</button>
          </Link>
        </div>
      )}

      <div className={styles.grid}>
        {visible.map((p) => (
          <PlayerCard key={p.id} player={p} />
        ))}
      </div>
    </div>
  );
}
