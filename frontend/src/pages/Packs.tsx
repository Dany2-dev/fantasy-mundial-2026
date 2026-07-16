import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import ColorBends from "../components/ColorBends";
import FlipReveal from "../components/FlipReveal";
import Galaxy from "../components/Galaxy";
import { IconCoin } from "../components/icons";
import TiltCard from "../components/TiltCard";
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

// Paleta del fondo animado del revelado, por tier (mismos tonos que --foil-*
// en variables.css, para que combine con el badge/franja/destello ya
// existentes). Legendario lleva más colores: se siente más "vivo".
const REVEAL_COLORS: Record<string, string[]> = {
  bronce: ["#4a2f18", "#b0713a", "#e8b380"],
  plata: ["#49535f", "#aab6c5", "#eef2f7"],
  oro: ["#6e5418", "#f0c24b", "#fff3c4"],
  legendario: ["#2d0b57", "#7b2fff", "#d9a6ff", "#ffd76f"],
};

export default function Packs() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const [opening, setOpening] = useState<string | null>(null);
  const [revealTier, setRevealTier] = useState<string | null>(null);
  const [result, setResult] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // El fondo animado usa WebGL: se omite si el usuario prefiere menos
  // movimiento (accesibilidad), cayendo en el fondo plano de siempre.
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function openPack(tier: string) {
    if (!activeLeagueId) return;
    setOpening(tier);
    setRevealTier(tier); // se queda hasta cerrar el reveal: el overlay lo usa para tomar el color del tier
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
      setRevealTier(null);
    } finally {
      setOpening(null);
    }
  }

  function closeReveal() {
    setResult(null);
    setRevealTier(null);
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
                disabled={opening !== null || (user?.coins ?? 0) < p.cost}
                onClick={() => openPack(p.tier)}
              >
                {opening === p.tier ? (
                  <span className={styles.openingLabel}>
                    <IconCoin size={15} className={styles.spinningCoin} />
                    Abriendo…
                  </span>
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
            </TiltCard>
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div
          className={`${styles.overlay} ${revealTier ? styles[revealTier] : ""}`}
          role="dialog"
          aria-label="Cartas obtenidas"
        >
          {!prefersReducedMotion && (
            <ColorBends
              className={styles.bendsBg}
              colors={REVEAL_COLORS[revealTier ?? "oro"]}
              rotation={90}
              speed={0.15}
              scale={1.2}
              frequency={1}
              warpStrength={1}
              mouseInfluence={0.6}
              parallax={0.3}
              noise={0.08}
              iterations={2}
              intensity={1.3}
              bandWidth={6}
              transparent
            />
          )}
          <span className={styles.burst} aria-hidden="true" />
          <div className={styles.overlayContent}>
            <h2 className={styles.overlayTitle}>¡Llegaron refuerzos!</h2>
            <p className={styles.overlaySub}>Toca cada carta y descubre quién se suma al club.</p>
            <div className={styles.reveal}>
              {result.map((p, i) => (
                <FlipReveal key={p.id} player={p} delay={500 + i * 650} />
              ))}
            </div>
            <button className="primary" onClick={closeReveal}>
              Seguir con mi club
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
