import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import PlayerCard from "../components/PlayerCard";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Standing } from "../types";
import styles from "./Home.module.css";

export default function Home() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { leagues, activeLeagueId } = useAppSelector((s) => s.leagues);
  const collection = useAppSelector((s) => s.collection.items);
  const [standings, setStandings] = useState<Standing[]>([]);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  const bestCard = collection.length
    ? collection.reduce((a, b) => (b.rating > a.rating ? b : a))
    : null;
  const myRank = standings.findIndex((s) => s.userId === user?.id) + 1;

  useEffect(() => {
    if (activeLeagueId) {
      dispatch(fetchCollection(activeLeagueId));
      api<{ standings: Standing[] }>(`/leagues/${activeLeagueId}`)
        .then((d) => setStandings(d.standings))
        .catch(() => setStandings([]));
    }
  }, [dispatch, activeLeagueId]);

  if (!activeLeague) {
    return (
      <div className={styles.empty}>
        <h1>Hola, {user?.name} 👋</h1>
        <p className="muted">
          Aún no estás en ninguna liga. El juego empieza cuando compites con alguien.
        </p>
        <Link to="/ligas">
          <button className="primary">Crear o unirme a una liga</button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Hola, {user?.name}</h1>

      <div className={styles.grid}>
        <Link to="/ligas" className={styles.rankCard}>
          <span className={styles.rankBig}>
            {myRank > 0 ? `${myRank}º` : "—"}
          </span>
          <span>
            de {standings.length} en <strong>{activeLeague.name}</strong>
          </span>
          <span className="caption">Ver clasificación →</span>
        </Link>

        <div className={styles.bestCard}>
          <span className="caption">TU MEJOR CARTA</span>
          {bestCard ? (
            <div className={styles.bestCardInner}>
              <PlayerCard player={bestCard} />
            </div>
          ) : (
            <div className={styles.noCards}>
              <p className="muted">Todavía no tienes cartas en esta liga.</p>
              <Link to="/sobres">
                <button className="primary">Abrir mi primer sobre</button>
              </Link>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Link to="/sobres" className={styles.action}>
            🎁 <strong>Abrir un sobre</strong>
            <span className="caption">Bronce, Plata u Oro</span>
          </Link>
          <Link to="/once" className={styles.action}>
            ⚽ <strong>Armar mi once</strong>
            <span className="caption">Formación y capitán</span>
          </Link>
          <Link to="/mercado" className={styles.action}>
            🔁 <strong>Ir al mercado</strong>
            <span className="caption">Negocia con tu liga</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
