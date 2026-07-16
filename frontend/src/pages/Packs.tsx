import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { IconCoin } from "../components/icons";
import PackOpeningModal from "../components/PackOpeningModal";
import { setCoins } from "../store/authSlice";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player } from "../types";
import styles from "./Packs.module.css";

const PACKS = [
  { tier: "bronce", label: "Sobre Bronce", cost: 2500, desc: "3 cartas para empezar a armar tu club." },
  { tier: "plata", label: "Sobre Plata", cost: 5000, desc: "3 cartas con mejores opciones de encontrar una figura." },
  { tier: "oro", label: "Sobre Oro", cost: 9000, desc: "3 cartas; incluye una figura de élite si aún queda disponible." },
  { tier: "legendario", label: "Sobre Legendario", cost: 16000, desc: "3 cartas; la mejor probabilidad de encontrar una leyenda del pool." },
] as const;

export default function Packs() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const [opening, setOpening] = useState<string | null>(null);
  const [result, setResult] = useState<Player[] | null>(null);
  const [resultTier, setResultTier] = useState<string | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
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
      setResultTier(tier);
      setRevealIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el sobre");
    } finally {
      setOpening(null);
    }
  }

  function closeReveal() {
    setResult(null);
    setResultTier(null);
    setRevealIndex(0);
  }

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <h1>Sobres</h1>
        <p className="muted">Primero entra a una liga. Ahí cada carta tendrá un solo dueño.</p>
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
        Cada carta es única dentro de tu liga: si te sale una figura, ningún rival podrá tenerla sin negociar contigo o pagar su cláusula.
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

      {result && activeLeagueId && (
        <PackOpeningModal
          key={result[revealIndex].id}
          card={result[revealIndex]}
          packArt={`/packs/${resultTier}.png`}
          leagueId={activeLeagueId}
          index={revealIndex}
          total={result.length}
          onNext={() => setRevealIndex((i) => Math.min(i + 1, result.length - 1))}
          onClose={closeReveal}
        />
      )}
    </div>
  );
}
