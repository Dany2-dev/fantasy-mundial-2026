import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { formatMoney } from "../lib/money";
import Galaxy from "../components/Galaxy";
import { IconCoin } from "../components/icons";
import PackOpeningModal from "../components/PackOpeningModal";
import TiltCard from "../components/TiltCard";
import { setLeagueCoins } from "../store/leagueSlice";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player } from "../types";
import styles from "./Packs.module.css";

// Costos espejo de backend/src/routes/packs.ts (en €; el backend valida el real).
const PACKS = [
  { tier: "bronce", label: "Sobre Bronce", cost: 8_000_000, desc: "3 cartas para empezar a armar tu club." },
  { tier: "plata", label: "Sobre Plata", cost: 15_000_000, desc: "3 cartas con mejores opciones de encontrar una figura." },
  { tier: "oro", label: "Sobre Oro", cost: 30_000_000, desc: "3 cartas; incluye una figura de élite si aún queda disponible." },
  { tier: "legendario", label: "Sobre Legendario", cost: 60_000_000, desc: "3 cartas; la mejor probabilidad de encontrar una leyenda del pool." },
] as const;

export default function Packs() {
  const dispatch = useAppDispatch();
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  // Presupuesto de la liga activa (el dinero es por liga).
  const budget = useAppSelector(
    (s) => s.leagues.leagues.find((l) => l.id === s.leagues.activeLeagueId)?.myCoins ?? 0
  );
  const [opening, setOpening] = useState<string | null>(null);
  const [result, setResult] = useState<Player[] | null>(null);
  const [resultTier, setResultTier] = useState<string | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // El fondo animado usa WebGL: se omite si el usuario prefiere menos
  // movimiento (accesibilidad), cayendo en el fondo plano de siempre.
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function openPack(tier: string) {
    if (!activeLeagueId) return;
    setOpening(tier);
    setError(null);
    try {
      const data = await api<{ players: Player[]; coins: number }>("/packs/open", {
        method: "POST",
        body: JSON.stringify({ leagueId: activeLeagueId, tier }),
      });
      dispatch(setLeagueCoins({ leagueId: activeLeagueId, coins: data.coins }));
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
      <div className={styles.page}>
        {!prefersReducedMotion && (
          <Galaxy
            className={styles.galaxyBg}
            hueShift={220}
            saturation={0.55}
            density={1.1}
            glowIntensity={0.35}
            twinkleIntensity={0.4}
            starSpeed={0.4}
            rotationSpeed={0.04}
            mouseRepulsion={false}
            transparent
          />
        )}
        <div className={`${styles.empty} ${styles.pageContent}`}>
          <h1>Sobres</h1>
          <p className="muted">Primero entra a una liga. Ahí cada carta tendrá un solo dueño.</p>
          <Link to="/ligas">
            <button className="primary">Ir a Ligas</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {!prefersReducedMotion && (
        <Galaxy
          className={styles.galaxyBg}
          hueShift={220}
          saturation={0.55}
          density={1.1}
          glowIntensity={0.35}
          twinkleIntensity={0.4}
          starSpeed={0.4}
          rotationSpeed={0.04}
          mouseRepulsion={false}
          transparent
        />
      )}
      <div className={styles.pageContent}>
      <h1>Sobres</h1>
      <p className={`muted ${styles.intro}`}>
        Cada carta es única dentro de tu liga: si te sale una figura, ningún rival podrá tenerla sin negociar contigo o pagar su cláusula.
      </p>

      <div className={styles.packs}>
        {PACKS.map((p) => (
          <div
            key={p.tier}
            className={`${styles.pack} ${styles[p.tier]} ${opening === p.tier ? styles.charging : ""}`}
          >
            <TiltCard>
              <span className={styles.tierBadge}>{p.tier}</span>
              <img className={styles.packArt} src={`/packs/${p.tier}.png`} alt="" aria-hidden="true" />
              <h2>{p.label}</h2>
              <p className={styles.packDesc}>{p.desc}</p>
              <button
                className={`primary ${styles.openBtn} ${opening === p.tier ? styles.opening : ""}`}
                disabled={opening !== null || budget < p.cost}
                onClick={() => openPack(p.tier)}
              >
                {opening === p.tier ? (
                  <span className={styles.openingLabel}>
                    <IconCoin size={15} className={styles.spinningCoin} />
                    Abriendo…
                  </span>
                ) : (
                  <span className={styles.costLabel}>
                    Abrir por {formatMoney(p.cost)} <IconCoin size={15} />
                  </span>
                )}
              </button>
              {budget < p.cost && (
                <span className={`caption ${styles.missing}`}>
                  Te faltan {formatMoney(p.cost - budget)} <IconCoin size={12} />
                </span>
              )}
            </TiltCard>
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
    </div>
  );
}
