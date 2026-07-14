import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import FlipReveal from "../components/FlipReveal";
import { IconCoin } from "../components/icons";
import { setCoins } from "../store/authSlice";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player } from "../types";
import styles from "./Packs.module.css";

const PACKS = [
  { tier: "bronce", label: "Sobre Bronce", cost: 2500, desc: "3 cartas. Para arrancar tu colección." },
  { tier: "plata", label: "Sobre Plata", cost: 5000, desc: "3 cartas con mejores probabilidades." },
  { tier: "oro", label: "Sobre Oro", cost: 9000, desc: "3 cartas. Una 85+ garantizada." },
] as const;

export default function Packs() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const [opening, setOpening] = useState<string | null>(null);
  const [result, setResult] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPack(tier: string) {
    if (!activeLeagueId) return;
    setOpening(tier);
    setError(null);
    try {
      const data = await api<{ players: Player[]; coins: number }>("/packs/open", {
        method: "POST",
        body: JSON.stringify({ leagueId: activeLeagueId, tier }),
      });
      dispatch(setCoins(data.coins));
      dispatch(fetchCollection(activeLeagueId));
      setResult(data.players);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el sobre");
    } finally {
      setOpening(null);
    }
  }

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Sobres</h1>
        <p className="muted">Los sobres se abren dentro de una liga: las cartas que te salgan serán tuyas ahí.</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Sobres</h1>
      <p className={`muted ${styles.intro}`}>
        Cada carta tiene un solo dueño por liga: lo que abras aquí es tuyo y de nadie más.
      </p>

      <div className={styles.packs}>
        {PACKS.map((p) => (
          <div key={p.tier} className={`${styles.pack} ${styles[p.tier]}`}>
            <span className={styles.packShine} aria-hidden="true" />
            <span className={styles.tierBadge}>{p.tier}</span>
            <img className={styles.packArt} src={`/packs/${p.tier}.png`} alt="" aria-hidden="true" />
            <h2>{p.label}</h2>
            <p className={styles.packDesc}>{p.desc}</p>
            <button
              className={`primary ${styles.openBtn}`}
              disabled={opening !== null || (user?.coins ?? 0) < p.cost}
              onClick={() => openPack(p.tier)}
            >
              {opening === p.tier ? (
                "Abriendo…"
              ) : (
                <span className={styles.costLabel}>
                  Abrir por {p.cost.toLocaleString("es-MX")} <IconCoin size={15} />
                </span>
              )}
            </button>
            {(user?.coins ?? 0) < p.cost && (
              <span className={`caption ${styles.missing}`}>
                Te faltan {(p.cost - (user?.coins ?? 0)).toLocaleString("es-MX")} <IconCoin size={12} />
              </span>
            )}
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className={styles.overlay} role="dialog" aria-label="Cartas obtenidas">
          <h2 className={styles.overlayTitle}>¡Nuevas cartas!</h2>
          <p className={styles.overlaySub}>Toca para revelar cada carta.</p>
          <div className={styles.reveal}>
            {result.map((p, i) => (
              <FlipReveal key={p.id} player={p} delay={500 + i * 650} />
            ))}
          </div>
          <button className="primary" onClick={() => setResult(null)}>
            Guardar en mi colección
          </button>
        </div>
      )}
    </div>
  );
}
