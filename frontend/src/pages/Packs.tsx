import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { formatMoney } from "../lib/money";
import BubbleMenu, { BubbleMenuItem } from "../components/BubbleMenu";
import Flag from "../components/Flag";
import Galaxy from "../components/Galaxy";
import { IconCoin } from "../components/icons";
import PackOpeningModal from "../components/PackOpeningModal";
import TiltCard from "../components/TiltCard";
import { setLeagueCoins } from "../store/leagueSlice";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player, Team } from "../types";
import styles from "./Packs.module.css";

// Costos espejo de backend/src/routes/packs.ts (en €; el backend valida el real).
// CARDS_PER_PACK espeja PACKS[tier].count (igual para los 4 tiers ahí).
const CARDS_PER_PACK = 3;
const PACKS = [
  { tier: "bronce", label: "Sobre Bronce", cost: 8_000_000, desc: "3 cartas para empezar a armar tu club." },
  { tier: "plata", label: "Sobre Plata", cost: 15_000_000, desc: "3 cartas con mejores opciones de encontrar una figura." },
  { tier: "oro", label: "Sobre Oro", cost: 30_000_000, desc: "3 cartas; incluye una figura de élite si aún queda disponible." },
  { tier: "legendario", label: "Sobre Legendario", cost: 60_000_000, desc: "3 cartas; la mejor probabilidad de encontrar una leyenda del pool." },
] as const;

interface TeamOption extends Team {
  freeCount: number;
}

interface DailyStatus {
  canClaim: boolean;
  nextAvailableAt: string | null;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

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
  // Modo "por selección": restringe el sorteo del sobre a los jugadores de
  // UNA selección/equipo (país) en vez de toda la competencia. Usa el
  // endpoint nuevo /packs/open-by-team (ver backend/src/routes/packsByTeam.ts).
  const [countryMode, setCountryMode] = useState(false);
  const [teams, setTeams] = useState<TeamOption[] | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const selectedTeam = teams?.find((t) => t.id === selectedTeamId) ?? null;
  // Sobre gratis diario (bronce o plata, nunca oro/legendario): el estado
  // real vive en el backend (GET /packs/daily), acá solo lo reflejamos y
  // hacemos tick para el contador regresivo.
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // El fondo animado usa WebGL: se omite si el usuario prefiere menos
  // movimiento (accesibilidad), cayendo en el fondo plano de siempre.
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!activeLeagueId) return;
    let cancelled = false;
    setDailyLoading(true);
    api<DailyStatus>(`/packs/daily?leagueId=${activeLeagueId}`)
      .then((data) => {
        if (!cancelled) setDailyStatus(data);
      })
      .catch(() => {
        // El sobre gratis es un extra: si falla la consulta, dejamos
        // intentar igual y que el backend valide al reclamar.
        if (!cancelled) setDailyStatus({ canClaim: true, nextAvailableAt: null });
      })
      .finally(() => {
        if (!cancelled) setDailyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLeagueId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dailyRemainingMs = dailyStatus?.nextAvailableAt ? new Date(dailyStatus.nextAvailableAt).getTime() - now : 0;
  const canClaimDaily = !dailyStatus || dailyStatus.canClaim || dailyRemainingMs <= 0;

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

  async function openPackForTeam(tier: string) {
    if (!activeLeagueId || !selectedTeamId) return;
    setOpening(tier);
    setError(null);
    try {
      const data = await api<{ players: Player[]; coins: number }>("/packs/open-by-team", {
        method: "POST",
        body: JSON.stringify({ leagueId: activeLeagueId, tier, teamId: selectedTeamId }),
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

  async function claimDailyPack() {
    if (!activeLeagueId) return;
    setClaimingDaily(true);
    setError(null);
    try {
      const data = await api<{ tier: string; players: Player[]; nextAvailableAt: string }>("/packs/daily/claim", {
        method: "POST",
        body: JSON.stringify({ leagueId: activeLeagueId }),
      });
      dispatch(fetchCollection(activeLeagueId));
      setResult(data.players);
      setResultTier(data.tier);
      setRevealIndex(0);
      setDailyStatus({ canClaim: false, nextAvailableAt: data.nextAvailableAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reclamar el sobre gratis");
    } finally {
      setClaimingDaily(false);
    }
  }

  async function toggleCountryMode() {
    if (countryMode) {
      setCountryMode(false);
      setSelectedTeamId(null);
      return;
    }
    setCountryMode(true);
    setSelectedTeamId(null);
    if (teams !== null || !activeLeagueId) return;
    setTeamsLoading(true);
    setTeamsError(null);
    try {
      const data = await api<{ teams: TeamOption[] }>(`/packs/teams?leagueId=${activeLeagueId}`);
      setTeams(data.teams);
    } catch (e) {
      setTeamsError(e instanceof Error ? e.message : "No se pudieron cargar las selecciones");
    } finally {
      setTeamsLoading(false);
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

      <div className={styles.dailyCard}>
        <div className={styles.dailyInfo}>
          <span className={styles.dailyBadge}>Gratis</span>
          <div>
            <h2>Sobre gratis diario</h2>
            <p className="muted">Uno cada 24 horas: bronce o plata.</p>
          </div>
        </div>
        {dailyLoading ? (
          <span className="muted">Cargando…</span>
        ) : canClaimDaily ? (
          <button
            type="button"
            className={`primary ${styles.dailyBtn}`}
            disabled={claimingDaily || opening !== null}
            onClick={claimDailyPack}
          >
            {claimingDaily ? "Abriendo…" : "Reclamar sobre gratis"}
          </button>
        ) : (
          <div className={styles.dailyCountdown}>
            <span className="muted">Próximo sobre en</span>
            <span className={styles.dailyTimer}>{formatCountdown(dailyRemainingMs)}</span>
          </div>
        )}
      </div>

      <div className={styles.countryBar}>
        <button type="button" className="primary" disabled={opening !== null} onClick={toggleCountryMode}>
          {countryMode ? "Cancelar por país" : "Abrir por país"}
        </button>

        {countryMode && (
          <div className={styles.teamPicker}>
            {teamsLoading && <span className="muted">Cargando selecciones…</span>}
            {teamsError && <span className="error-text">{teamsError}</span>}
            {teams && teams.length === 0 && (
              <span className="muted">No hay selecciones con cartas libres en esta competencia.</span>
            )}
            {teams && teams.length > 0 && (
              <BubbleMenu
                reducedMotion={prefersReducedMotion}
                animationDuration={0.18}
                staggerDelay={0.008}
                onSelect={(item) => setSelectedTeamId(item.id as number)}
                items={teams.map(
                  (t): BubbleMenuItem => ({
                    id: t.id,
                    ariaLabel: t.name,
                    selected: selectedTeamId === t.id,
                    disabled: opening !== null,
                    label: (
                      <>
                        <Flag team={t} size={20} />
                        <span>{t.name}</span>
                        <span className={styles.teamChipCount}>{t.freeCount}</span>
                      </>
                    ),
                  })
                )}
              />
            )}
            {teams && teams.length > 0 && !selectedTeamId && (
              <span className="muted">Elegí una selección para poder abrir un sobre.</span>
            )}
          </div>
        )}
      </div>

      <div className={styles.packs}>
        {PACKS.map((p) => {
          const notEnoughForTeam = countryMode && !!selectedTeam && selectedTeam.freeCount < CARDS_PER_PACK;
          const disabled =
            opening !== null ||
            budget < p.cost ||
            (countryMode && (!selectedTeamId || notEnoughForTeam));
          return (
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
                  disabled={disabled}
                  onClick={() => (countryMode ? openPackForTeam(p.tier) : openPack(p.tier))}
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
                {countryMode && selectedTeamId && notEnoughForTeam && (
                  <span className={`caption ${styles.missing}`}>No quedan suficientes cartas de esa selección</span>
                )}
              </TiltCard>
            </div>
          );
        })}
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
