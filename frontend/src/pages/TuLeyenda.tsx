import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COUNTRIES, CareerClub, PITCH_LAYOUT, PitchPosition, findClub } from "../lib/careerData";
import {
  CareerEvent,
  CareerState,
  LuckRoll,
  RETIREMENT_AGE,
  STAGE_YEARS,
  chooseDevelopment,
  chooseTransfer,
  isGoalkeeper,
  newCareer,
  shootPenalty,
} from "../lib/careerEngine";
import { StageOutcome, careerEpitaph, scoutingHint, stageNarrative } from "../lib/careerNarrative";
import { trophyByName } from "../lib/careerTrophies";
import CountUp from "../components/CountUp";
import LuckGauge from "../components/LuckGauge";
import PenaltyShootout from "../components/PenaltyShootout";
import TrophyCelebration, { CelebrationItem } from "../components/TrophyCelebration";
import { TrophyGlyph } from "../components/TrophyIcons";
import { IconStar } from "../components/icons";
import { formatMoney } from "../lib/money";
import styles from "./TuLeyenda.module.css";

const STORAGE_KEY = "fm26_tu_leyenda";
/** Perfil recordado entre partidas: el jugador no reescribe su nombre cada vez. */
const PROFILE_KEY = "fm26_leyenda_perfil";

type Screen = "start" | "identity" | "career" | "retired" | "summary";

interface SavedProfile {
  surname: string;
  number: number;
  foot: "Izquierda" | "Derecha";
  countryName: string;
  countryCode: string;
  position: PitchPosition | null;
}

function ovrTier(ovr: number): string {
  if (ovr >= 86) return styles.tierElite;
  if (ovr >= 78) return styles.tierGold;
  if (ovr >= 68) return styles.tierBlue;
  if (ovr >= 58) return styles.tierOrange;
  return styles.tierGray;
}

const flagUrl = (code: string) => `https://flagcdn.com/w80/${code}.png`;

/** Número del historial: cuenta hacia arriba solo si es la fila recién jugada. */
function TimelineNum({ value, animate }: { value: number; animate: boolean }) {
  return animate ? <CountUp to={value} duration={0.8} /> : <>{value}</>;
}

function reputationLabel(rep: number): string {
  if (rep >= 85) return "Leyenda mundial";
  if (rep >= 65) return "Estrella internacional";
  if (rep >= 45) return "Nombre reconocido";
  if (rep >= 25) return "Suena en el mercado";
  if (rep >= 10) return "Promesa local";
  return "Desconocido";
}

// Un título se dibuja con su logo real (ligas, copas, Champions, Mundial…) o
// con un SVG propio cuando es un premio individual sin logo oficial.
function TrophyBadge({
  label,
  league,
  size = 24,
  title,
  className,
}: {
  label: string;
  league?: string;
  size?: number;
  title?: string;
  className?: string;
}) {
  const def = trophyByName(label, league);
  if (def.logoUrl) {
    return <img src={def.logoUrl} alt="" title={title ?? def.name} className={className} width={size} height={size} />;
  }
  return (
    <span className={className} title={title ?? def.name} style={{ color: "var(--oro-claro)", display: "inline-flex" }}>
      <TrophyGlyph icon={def.icon ?? "trophy"} size={size} />
    </span>
  );
}

// Entrada de pantalla: SOLO desplazamiento, sin fundido. Un `opacity: 0`
// inicial deja la pantalla invisible si el navegador congela los frames.
const slideIn = { initial: { y: 12 }, animate: { y: 0 } };

export default function TuLeyenda() {
  const [screen, setScreen] = useState<Screen>("start");
  const [career, setCareer] = useState<CareerState | null>(null);
  const [celebration, setCelebration] = useState<CelebrationItem[] | null>(null);
  const reduceMotion = useReducedMotion();

  // Identidad en construcción (precargada con el último perfil usado).
  const [surname, setSurname] = useState("");
  const [number, setNumber] = useState(10);
  const [foot, setFoot] = useState<"Izquierda" | "Derecha">("Derecha");
  const [countryQuery, setCountryQuery] = useState("");
  const [country, setCountry] = useState<{ name: string; code: string } | null>(null);
  const [position, setPosition] = useState<PitchPosition | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as CareerState;
        setCareer(saved);
        setScreen(saved.retired ? "retired" : "career");
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    if (career) localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
  }, [career]);

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as SavedProfile;
      setSurname(p.surname ?? "");
      setNumber(p.number ?? 10);
      setFoot(p.foot ?? "Derecha");
      if (p.countryName && p.countryCode) setCountry({ name: p.countryName, code: p.countryCode });
      setPosition(p.position ?? null);
    } catch {
      localStorage.removeItem(PROFILE_KEY);
    }
  }

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [countryQuery]);

  function startNewCareer() {
    // No se limpian los campos: se reusa el último perfil para que no haya que
    // volver a escribir todo. El jugador puede cambiarlo si quiere.
    loadProfile();
    setCountryQuery("");
    setScreen("identity");
  }

  function confirmIdentity() {
    if (!surname.trim() || !country || !position) return;
    const profile: SavedProfile = {
      surname: surname.trim().toUpperCase(),
      number,
      foot,
      countryName: country.name,
      countryCode: country.code,
      position,
    };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // localStorage puede fallar en modo privado; no es crítico.
    }
    setCareer(
      newCareer({
        surname: profile.surname,
        number: Math.max(1, Math.min(99, number)),
        foot,
        countryName: country.name,
        countryCode: country.code,
        position,
      })
    );
    setScreen("career");
  }

  /** Encola la celebración de títulos/premios de la temporada recién jugada. */
  function queueCelebration(next: CareerState) {
    const stage = next.lastStage;
    if (!stage || (stage.trophies.length === 0 && stage.awards.length === 0)) return;
    setCelebration([
      ...stage.trophies.map((label): CelebrationItem => ({ label, club: next.club.name, league: next.club.league, kind: "team" })),
      ...stage.awards.map((label): CelebrationItem => ({ label, club: next.club.name, league: next.club.league, kind: "individual" })),
    ]);
  }

  function pickTransfer(optionId: string) {
    if (!career) return;
    setCareer(chooseTransfer(career, optionId));
  }

  function pickDevelopment(optionId: string) {
    if (!career) return;
    const next = chooseDevelopment(career, optionId);
    setCareer(next);
    // El penal de la final tiene prioridad: primero se define el título.
    if (!next.pendingPenalty) {
      queueCelebration(next);
      if (next.retired) setScreen("retired");
    }
  }

  function takePenalty(zone: number) {
    if (!career) return;
    const next = shootPenalty(career, zone);
    setCareer(next);
    queueCelebration(next);
    if (next.retired) setScreen("retired");
  }

  function playAgain() {
    localStorage.removeItem(STORAGE_KEY);
    setCareer(null);
    setCelebration(null);
    setScreen("start");
  }

  function restart() {
    if (!confirm("¿Reiniciar tu carrera actual? Se pierde el progreso.")) return;
    playAgain();
  }

  const inGame = screen === "career" || screen === "retired" || screen === "summary";

  return (
    <div>
      <TopBar career={career && inGame ? career : null} onRestart={career ? restart : undefined} />

      <motion.div key={screen} {...(reduceMotion ? {} : slideIn)} transition={{ duration: 0.45 }}>
        {screen === "start" && (
          <StartScreen
            onStart={startNewCareer}
            hasSaved={!!career}
            onContinue={() => setScreen(career?.retired ? "retired" : "career")}
          />
        )}
        {screen === "identity" && (
          <IdentityScreen
            surname={surname}
            setSurname={setSurname}
            number={number}
            setNumber={setNumber}
            foot={foot}
            setFoot={setFoot}
            countryQuery={countryQuery}
            setCountryQuery={setCountryQuery}
            countries={filteredCountries}
            country={country}
            setCountry={setCountry}
            position={position}
            setPosition={setPosition}
            onBack={() => setScreen("start")}
            onConfirm={confirmIdentity}
          />
        )}
        {screen === "career" && career && (
          <CareerScreen
            career={career}
            onTransfer={pickTransfer}
            onDevelopment={pickDevelopment}
            reduceMotion={!!reduceMotion}
          />
        )}
        {screen === "retired" && career && (
          <RetiredScreen career={career} onSummary={() => setScreen("summary")} onPlayAgain={playAgain} />
        )}
        {screen === "summary" && career && <SummaryScreen career={career} onPlayAgain={playAgain} />}
      </motion.div>

      {career?.pendingPenalty && <PenaltyShootout penalty={career.pendingPenalty} onShoot={takePenalty} />}
      {celebration && <TrophyCelebration items={celebration} onDone={() => setCelebration(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TopBar({ career, onRestart }: { career: CareerState | null; onRestart?: () => void }) {
  return (
    <div className={styles.topBar}>
      <span className={styles.topBarBrand}>
        <IconStar size={18} />
        Tu Leyenda
      </span>

      {career && (
        <div className={styles.topBarInfo}>
          <span className={styles.topBarName}>
            {career.surname} <span className={styles.topBarNum}>#{career.number}</span>
          </span>
          <span className={styles.topBarDot} />
          <span className={styles.topBarAge}>{career.age} años</span>
          <span className={styles.topBarDot} />
          <img src={career.club.logoUrl} alt="" className={styles.topBarCrest} />
          <span className={styles.topBarClub}>{career.club.name}</span>
        </div>
      )}

      {career && (
        <div className={styles.topBarProgress} title={`Carrera: ${career.age} de ${RETIREMENT_AGE} años`}>
          <div
            className={styles.topBarProgressFill}
            style={{ transform: `scaleX(${Math.min(1, (career.age - 16) / (RETIREMENT_AGE - 16))})` }}
          />
        </div>
      )}

      {onRestart && (
        <button className={styles.topBarRestart} onClick={onRestart}>
          Reiniciar
        </button>
      )}
    </div>
  );
}

function StartScreen({ onStart, hasSaved, onContinue }: { onStart: () => void; hasSaved: boolean; onContinue: () => void }) {
  return (
    <div className={styles.startScreen}>
      <div className={styles.startInner}>
        <p className={styles.eyebrow}>Minijuegos Copero</p>
        <h1 className={styles.startTitle}>Construí tu carrera futbolística</h1>
        <p className={styles.startDesc}>
          Elegí tu origen, tomá decisiones clave y dejá que el destino te lleve a una trayectoria única de títulos,
          estadísticas y momentos decisivos.
        </p>
        <div className={styles.startActions}>
          <button className="primary" onClick={onStart}>
            {hasSaved ? "Empezar otra carrera" : "Comenzar carrera"}
          </button>
          {hasSaved && (
            <button className="ghost" onClick={onContinue}>
              Continuar carrera
            </button>
          )}
          <Link to="/jugar" className={styles.linkBack}>
            Volver a Juegos
          </Link>
        </div>
      </div>
    </div>
  );
}

interface IdentityProps {
  surname: string;
  setSurname: (v: string) => void;
  number: number;
  setNumber: (v: number) => void;
  foot: "Izquierda" | "Derecha";
  setFoot: (v: "Izquierda" | "Derecha") => void;
  countryQuery: string;
  setCountryQuery: (v: string) => void;
  countries: { name: string; code: string }[];
  country: { name: string; code: string } | null;
  setCountry: (c: { name: string; code: string }) => void;
  position: PitchPosition | null;
  setPosition: (p: PitchPosition) => void;
  onBack: () => void;
  onConfirm: () => void;
}

/**
 * Cabecera de cada columna. El número no es adorno: son los tres datos
 * obligatorios y la marca dice cuáles ya están, que es justo lo que decide si
 * el botón de empezar se habilita.
 */
function StepTitle({ n, children, done }: { n: number; children: string; done: boolean }) {
  return (
    <h2 className={styles.stepTitle} data-done={done ? "sí" : undefined}>
      <span className={styles.stepNum} aria-hidden="true">
        {done ? "✓" : n}
      </span>
      {children}
    </h2>
  );
}

function IdentityScreen(p: IdentityProps) {
  const nameDone = p.surname.trim().length >= 2;
  const ready = nameDone && !!p.country && !!p.position;
  return (
    <div className={styles.identityScreen}>
      <h1 className={styles.identityTitle}>Definí tu identidad</h1>
      <p className={styles.identityLead}>
        Tres decisiones y arranca la carrera: cómo te llamás, de dónde venís y en qué puesto jugás.
      </p>
      <div className={styles.identityGrid}>
        <div className={styles.identityCol}>
          <StepTitle n={1} done={nameDone}>
            Identidad
          </StepTitle>
          <div className={styles.jerseyWrap}>
            <motion.div className={styles.jersey} animate={{ scale: [0.97, 1] }} transition={{ duration: 0.5 }} key={p.number}>
              <span className={styles.jerseySurname}>{p.surname || "APELLIDO"}</span>
              <span className={styles.jerseyNumber}>{p.number}</span>
            </motion.div>
          </div>
          <label className={styles.field}>
            <span>Apellido</span>
            <input value={p.surname} maxLength={16} onChange={(e) => p.setSurname(e.target.value.toUpperCase())} placeholder="APELLIDO" />
          </label>
          <label className={styles.field}>
            <span>Número</span>
            <input type="number" min={1} max={99} value={p.number} onChange={(e) => p.setNumber(Number(e.target.value) || 1)} />
          </label>
          <div className={styles.field}>
            <span>Pierna hábil</span>
            <div className={styles.toggleRow}>
              <button className={p.foot === "Izquierda" ? styles.toggleActive : styles.toggle} onClick={() => p.setFoot("Izquierda")}>
                Izquierda
              </button>
              <button className={p.foot === "Derecha" ? styles.toggleActive : styles.toggle} onClick={() => p.setFoot("Derecha")}>
                Derecha
              </button>
            </div>
          </div>
        </div>

        <div className={styles.identityCol}>
          <StepTitle n={2} done={!!p.country}>
            Nacionalidad
          </StepTitle>
          <input
            className={styles.search}
            placeholder="Buscar país"
            value={p.countryQuery}
            onChange={(e) => p.setCountryQuery(e.target.value)}
          />
          <div className={styles.countryGrid}>
            {p.countries.map((c) => (
              <button
                key={c.code}
                className={`${styles.countryItem} ${p.country?.code === c.code ? styles.countryActive : ""}`}
                onClick={() => p.setCountry(c)}
              >
                <img src={flagUrl(c.code)} alt="" width={22} height={16} />
                <span>{c.name}</span>
                {p.country?.code === c.code && <span className={styles.countryCheck}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.identityCol}>
          <StepTitle n={3} done={!!p.position}>
            Posición
          </StepTitle>
          <PitchPicker position={p.position} setPosition={p.setPosition} />
          {p.position && (
            <p className={styles.positionHint}>
              {isGoalkeeper(p.position)
                ? "Como portero, tu carrera se mide en vallas invictas y atajadas, no en goles."
                : "Tu puesto define qué se espera de vos: goles, asistencias o solidez."}
            </p>
          )}
        </div>
      </div>

      <div className={styles.identityFooter}>
        <button className="ghost" onClick={p.onBack}>
          Volver
        </button>
        <button className="primary" disabled={!ready} onClick={p.onConfirm}>
          Confirmar identidad
        </button>
      </div>
    </div>
  );
}

/** Cancha de selección de puesto, con líneas reales dibujadas en SVG. */
function PitchPicker({ position, setPosition }: { position: PitchPosition | null; setPosition: (p: PitchPosition) => void }) {
  return (
    <div className={styles.pitch}>
      <svg viewBox="0 0 100 150" className={styles.pitchLines} preserveAspectRatio="none">
        {/* Franjas del césped */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x="0"
            y={i * 18.75}
            width="100"
            height="18.75"
            fill={i % 2 === 0 ? "rgba(255,255,255,0.035)" : "transparent"}
          />
        ))}
        <g fill="none" stroke="rgba(235,255,240,0.45)" strokeWidth="0.8">
          <rect x="3" y="3" width="94" height="144" rx="1.5" />
          <line x1="3" y1="75" x2="97" y2="75" />
          <circle cx="50" cy="75" r="14" />
          {/* Área rival (arriba) */}
          <rect x="25" y="3" width="50" height="22" />
          <rect x="38" y="3" width="24" height="9" />
          {/* Área propia (abajo) */}
          <rect x="25" y="125" width="50" height="22" />
          <rect x="38" y="138" width="24" height="9" />
          <path d="M38 25 A14 14 0 0 0 62 25" />
          <path d="M38 125 A14 14 0 0 1 62 125" />
        </g>
        <g fill="rgba(235,255,240,0.6)">
          <circle cx="50" cy="75" r="1" />
          <circle cx="50" cy="17" r="0.9" />
          <circle cx="50" cy="133" r="0.9" />
        </g>
      </svg>

      {PITCH_LAYOUT.map((slot) => (
        <button
          key={slot.pos}
          className={`${styles.pitchSlot} ${position === slot.pos ? styles.pitchSlotActive : ""}`}
          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          onClick={() => setPosition(slot.pos)}
        >
          {slot.pos}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function OptionCard({
  opt,
  onPick,
  picked,
  disabled,
  reduceMotion,
  index,
}: {
  opt: CareerEvent["options"][number];
  onPick: (id: string) => void;
  picked: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  index: number;
}) {
  const club = opt.clubId && opt.id !== "stay" && opt.id !== "titular" ? findClub(opt.clubId.replace(/^loan:/, "")) : null;

  return (
    <motion.button
      className={`${styles.optionCard} ${picked ? styles.optionPicked : ""}`}
      onClick={() => onPick(opt.id)}
      disabled={disabled}
      initial={reduceMotion ? undefined : { y: 10 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, delay: reduceMotion ? 0 : index * 0.06 }}
      whileHover={reduceMotion || disabled ? undefined : { y: -3 }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.98 }}
      style={opt.image ? { backgroundImage: `linear-gradient(180deg, rgba(11,18,32,.86), rgba(11,18,32,.95)), url(${opt.image})` } : undefined}
    >
      {club && <img src={club.logoUrl} alt="" className={styles.optionCrest} />}
      <span className={styles.optionLabel}>{opt.label}</span>
      <span className={styles.optionEffect}>{opt.effect}</span>
      {opt.risk && <span className={styles.optionRisk}>{opt.risk}</span>}
      {picked && <span className={styles.optionCheck}>Elegido ✓</span>}
    </motion.button>
  );
}

function DecisionCard({
  step,
  event,
  picked,
  locked,
  onPick,
  reduceMotion,
}: {
  step: string;
  event: CareerEvent;
  picked: string | null;
  locked: boolean;
  onPick: (id: string) => void;
  reduceMotion: boolean;
}) {
  return (
    <div className={`${styles.decisionCard} ${locked ? styles.decisionLocked : ""}`}>
      <div className={styles.decisionHead}>
        <span className={styles.decisionStep}>{step}</span>
        <h3 className={styles.decisionTitle}>{event.title}</h3>
      </div>
      <p className={styles.decisionDesc}>{event.description}</p>
      <div className={styles.optionGrid}>
        {event.options.map((opt, i) => (
          <OptionCard
            key={opt.id}
            opt={opt}
            index={i}
            onPick={onPick}
            picked={picked === opt.id}
            disabled={locked || picked !== null}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
      {locked && <p className={styles.decisionHint}>Definí primero tu futuro</p>}
    </div>
  );
}

function CareerScreen({
  career,
  onTransfer,
  onDevelopment,
  reduceMotion,
}: {
  career: CareerState;
  onTransfer: (id: string) => void;
  onDevelopment: (id: string) => void;
  reduceMotion: boolean;
}) {
  const turn = career.pendingTurn;
  const gk = isGoalkeeper(career.position);

  return (
    <div className={styles.careerScreen}>
      <div className={styles.profileCol}>
        <div className={styles.profileCard}>
          <div className={styles.profileHead}>
            <span className={`${styles.ovrBadge} ${ovrTier(career.ovr)}`}>
              <CountUp to={career.ovr} duration={0.9} />
            </span>
            <div className={styles.profileInfo}>
              <div className={styles.profileChips}>
                <img src={flagUrl(career.countryCode)} alt="" width={18} height={13} />
                <span className={styles.posChip}>
                  #{career.number} {career.position}
                </span>
              </div>
              <div className={styles.profileMeta}>
                <span className={styles.profileAge}>EDAD {career.age}</span>
                <span className={styles.profileValue}>VALOR {formatMoney(career.marketValue)}</span>
              </div>
            </div>
          </div>

          <div className={styles.profileClub}>
            <img src={career.club.logoUrl} alt="" className={styles.clubCrest} />
            <span>
              {career.club.name}
              <span className={styles.profileClubLeague}>{career.club.league}</span>
            </span>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>PJ</span>
              <span className={styles.statValue}>
                <CountUp to={career.totalPj} duration={0.9} />
              </span>
            </div>
            {gk ? (
              <>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Vallas</span>
                  <span className={styles.statValue}>
                    <CountUp to={career.totalCleanSheets} duration={0.9} />
                  </span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Sel.</span>
                  <span className={styles.statValue}>
                    <CountUp to={career.caps} duration={0.9} />
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>GLS</span>
                  <span className={styles.statValue}>
                    <CountUp to={career.totalGls} duration={0.9} />
                  </span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>AST</span>
                  <span className={styles.statValue}>
                    <CountUp to={career.totalAst} duration={0.9} />
                  </span>
                </div>
              </>
            )}
          </div>

          <div className={styles.repRow}>
            <div className={styles.repHead}>
              <span className={styles.statLabel}>Reputación</span>
              <span className={styles.repValue}>{reputationLabel(career.reputation)}</span>
            </div>
            <div className={styles.repTrack}>
              <motion.div
                className={styles.repFill}
                animate={{ width: `${career.reputation}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <p className={styles.repHint}>{scoutingHint(career.potential, career.ovr)}</p>
          </div>

          <div className={styles.trophyCase}>
            {career.trophies.length === 0 ? (
              <span className={styles.emptyCase}>Vitrina vacía</span>
            ) : (
              <div className={styles.trophyIcons}>
                {career.trophies.slice(-8).map((tr, i) => (
                  <TrophyBadge
                    key={i}
                    label={tr.label}
                    league={career.club.league}
                    title={`${tr.label} · ${tr.club} (${tr.age})`}
                    className={styles.trophyIcon}
                  />
                ))}
                {career.trophies.length > 8 && <span className={styles.trophyMore}>+{career.trophies.length - 8}</span>}
              </div>
            )}
          </div>

        </div>
      </div>

      <div className={styles.timelineCol}>
        <div className={styles.timelineHead}>
          <span>Edad</span>
          <span>Club</span>
          <span>OVR</span>
          <span>PJ</span>
          <span>{gk ? "VI" : "GLS"}</span>
          <span>{gk ? "SEL" : "AST"}</span>
        </div>
        <div className={styles.timelineScroll}>
          {career.history.map((h, i) => (
            <motion.div
              key={i}
              className={`${styles.timelineRow} ${i === career.history.length - 1 ? styles.timelineRowCurrent : ""}`}
              initial={reduceMotion ? undefined : { x: -6 }}
              animate={{ x: 0 }}
              transition={{ duration: 0.3, delay: reduceMotion ? 0 : Math.min(i * 0.02, 0.3) }}
            >
              <span className={styles.timelineAge}>{h.age}</span>
              <span className={styles.timelineClub}>
                <img src={h.club.logoUrl} alt="" className={styles.timelineCrest} />
                {h.club.name}
                {h.trophies.map((t, ti) => (
                  <TrophyBadge key={ti} label={t} league={h.club.league} size={14} className={styles.timelineTrophy} title={t} />
                ))}
              </span>
              {/* Solo la última fila se anima: es la temporada que acabás de
                  jugar. Animar las 23 al recargar la partida sería un caos. */}
              <span className={`${styles.timelineOvr} ${ovrTier(h.ovr)}`}>
                <TimelineNum value={h.ovr} animate={i === career.history.length - 1} />
              </span>
              <span>
                <TimelineNum value={h.pj} animate={i === career.history.length - 1} />
              </span>
              <span>
                <TimelineNum value={gk ? h.cleanSheets : h.gls} animate={i === career.history.length - 1} />
              </span>
              <span>
                {gk ? "—" : <TimelineNum value={h.ast} animate={i === career.history.length - 1} />}
              </span>
            </motion.div>
          ))}
          {!career.retired && (
            <div className={styles.timelineRow}>
              <span className={styles.timelineAge}>{career.age}</span>
              <span className={styles.timelineClubPending}>Temporada por jugar…</span>
            </div>
          )}
        </div>

        {/* El informe vive con el historial, no con el perfil: cuenta la
            temporada que acabás de jugar, que es de lo que habla esta columna.
            Además así la columna izquierda queda libre para las decisiones. */}
        {career.lastStage && (
          <StageReport stage={career.lastStage} luck={career.lastRoll} reduceMotion={reduceMotion} />
        )}
      </div>

      {turn && (
        <motion.div
          key={turn.seasonLabel}
          className={styles.turnPanel}
          initial={reduceMotion ? undefined : { y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.turnHead}>
            <span className={styles.turnSeason}>{turn.seasonLabel}</span>
            <p className={styles.turnIntro}>{turn.intro}</p>
          </div>

          <div className={styles.turnGrid}>
            <DecisionCard
              step="1 · Tu futuro"
              event={turn.transfer}
              picked={career.pickedTransfer}
              locked={false}
              onPick={onTransfer}
              reduceMotion={reduceMotion}
            />
            <DecisionCard
              step="2 · Tu enfoque"
              event={turn.development}
              picked={career.pickedDevelopment}
              locked={!career.pickedTransfer}
              onPick={onDevelopment}
              reduceMotion={reduceMotion}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StageReport({ stage, luck, reduceMotion }: { stage: StageOutcome; luck: LuckRoll | null; reduceMotion: boolean }) {
  const delta = stage.ovrAfter - stage.ovrBefore;
  const gk = isGoalkeeper(stage.position);
  return (
    <motion.div
      className={styles.reportBox}
      initial={reduceMotion ? undefined : { y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {luck && <LuckGauge roll={luck} reduceMotion={reduceMotion} />}

      <div className={styles.reportHead}>
        <span className={styles.reportSeason}>
          {stage.seasonLabel} · {stage.clubName}
        </span>
        <span className={`${styles.reportDelta} ${delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
          {delta >= 0 ? "+" : ""}
          <CountUp to={delta} duration={0.9} />
          {" OVR"}
        </span>
      </div>

      {/* Desglose: cuánto te dio competir el año y cuánto tu decisión. */}
      {stage.ovrBonus !== 0 && (
        <div className={styles.ovrBreakdown}>
          <span>
            <strong>
              {stage.ovrBase >= 0 ? "+" : ""}
              {stage.ovrBase}
            </strong>{" "}
            por la temporada
          </span>
          <span className={styles.ovrBonusChip}>
            <strong>
              {stage.ovrBonus >= 0 ? "+" : ""}
              {stage.ovrBonus}
            </strong>{" "}
            por tu decisión
          </span>
        </div>
      )}

      <div className={styles.reportStats}>
        <span>
          <strong>
            <CountUp to={stage.pj} duration={0.7} />
          </strong>{" "}
          PJ
        </span>
        {gk ? (
          <span>
            <strong>
              <CountUp to={stage.cleanSheets} duration={0.7} />
            </strong>{" "}
            vallas
          </span>
        ) : (
          <>
            <span>
              <strong>
                <CountUp to={stage.gls} duration={0.7} />
              </strong>{" "}
              goles
            </span>
            <span>
              <strong>
                <CountUp to={stage.ast} duration={0.7} />
              </strong>{" "}
              asist.
            </span>
          </>
        )}
      </div>

      <p className={styles.reportText}>{stageNarrative(stage)}</p>

      {(stage.awards.length > 0 || stage.milestones.length > 0) && (
        <div className={styles.reportBadges}>
          {stage.awards.map((a) => (
            <span key={a} className={styles.awardBadge}>
              <TrophyBadge label={a} size={14} className={styles.badgeIcon} /> {a}
            </span>
          ))}
          {stage.milestones.map((m) => (
            <span key={m} className={styles.milestoneBadge}>
              ★ {m}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function RetiredScreen({ career, onSummary, onPlayAgain }: { career: CareerState; onSummary: () => void; onPlayAgain: () => void }) {
  const gk = isGoalkeeper(career.position);
  return (
    <div className={styles.startScreen}>
      <div className={styles.startInner}>
        <p className={styles.eyebrow}>
          {career.surname} · {career.history.length} temporadas
        </p>
        <h1 className={styles.startTitle}>Tu carrera llegó a su fin</h1>
        <p className={styles.startDesc}>
          Colgaste los botines a los {career.age} años con{" "}
          {gk ? `${career.totalCleanSheets} vallas invictas` : `${career.totalGls} goles y ${career.totalAst} asistencias`}, un
          pico de {career.peakOvr} OVR y {career.trophies.length} trofeo{career.trophies.length !== 1 ? "s" : ""} en la vitrina.
        </p>
        <p className={styles.epitaph}>
          {careerEpitaph({
            peakOvr: career.peakOvr,
            totalGls: career.totalGls,
            trophies: career.trophies.length,
            caps: career.caps,
            awards: career.awards.map((a) => a.label),
            clubsPlayed: new Set(career.history.map((h) => h.club.id)).size,
          })}
        </p>
        <div className={styles.startActions}>
          <button className="primary" onClick={onSummary}>
            Ver resumen
          </button>
          <button className="ghost" onClick={onPlayAgain}>
            Volver a jugar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Agrupa edades en tramos seguidos: [26,28,36,38] → "26–28, 36–38". Dos etapas
 * son seguidas si se llevan STAGE_YEARS, que es lo que dura cada turno.
 */
function formatAges(ages: number[]): string {
  const sorted = [...ages].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const age of sorted) {
    const last = runs[runs.length - 1];
    if (last && age - last[1] <= STAGE_YEARS) last[1] = age;
    else runs.push([age, age]);
  }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
}

/** Una etapa de la carrera: un club, con lo que hiciste y ganaste ahí. */
interface ClubSpell {
  club: CareerClub;
  pj: number;
  gls: number;
  ast: number;
  cs: number;
  /** Edades EXACTAS en que jugaste ahí. Se guardan todas porque se puede
      volver a un club después de irse, y un simple mín–máx diría "26–38"
      cuando en medio estuviste en otros tres equipos. */
  ages: number[];
  /** Títulos del club, agrupados: "Ligue 1 ×5" dice más que cinco chapas iguales. */
  titles: { label: string; count: number }[];
}

function SummaryScreen({ career, onPlayAgain }: { career: CareerState; onPlayAgain: () => void }) {
  const gk = isGoalkeeper(career.position);

  const spells = useMemo<ClubSpell[]>(() => {
    const map = new Map<string, ClubSpell>();
    for (const h of career.history) {
      const cur = map.get(h.club.id) ?? { club: h.club, pj: 0, gls: 0, ast: 0, cs: 0, ages: [], titles: [] };
      cur.pj += h.pj;
      cur.gls += h.gls;
      cur.ast += h.ast;
      cur.cs += h.cleanSheets;
      cur.ages.push(h.age);
      map.set(h.club.id, cur);
    }
    // Los títulos se enganchan por NOMBRE de club: es lo que guarda CareerTrophy.
    for (const tr of career.trophies) {
      const spell = [...map.values()].find((s) => s.club.name === tr.club);
      if (!spell) continue;
      const existing = spell.titles.find((t) => t.label === tr.label);
      if (existing) existing.count += 1;
      else spell.titles.push({ label: tr.label, count: 1 });
    }
    for (const s of map.values()) s.titles.sort((a, b) => b.count - a.count);
    return Array.from(map.values());
  }, [career.history, career.trophies]);

  const totalTitles = career.trophies.length;
  const years = career.age - 16;

  return (
    <div className={styles.summaryScreen}>
      {/* La placa: el nombre y el dorsal son la identidad que construiste, así
          que abren la pantalla en vez de un título genérico. */}
      <header className={styles.plate}>
        <span className={styles.plateNumber} aria-hidden="true">
          {career.number}
        </span>
        <div className={styles.plateText}>
          <span className={styles.plateEyebrow}>Carrera terminada</span>
          <h1 className={styles.plateName}>{career.surname}</h1>
          <p className={styles.plateMeta}>
            <img src={flagUrl(career.countryCode)} alt="" width={18} height={13} />
            {career.countryName} · {career.position} · {years} años de profesional
          </p>
        </div>
      </header>

      <div className={styles.summaryStats}>
        <SummaryStat label="OVR máximo" value={career.peakOvr} />
        <SummaryStat label="Valor máximo" text={formatMoney(career.peakValue)} />
        <SummaryStat label="Partidos" value={career.totalPj} />
        {gk ? (
          <SummaryStat label="Vallas invictas" value={career.totalCleanSheets} />
        ) : (
          <>
            <SummaryStat label="Goles" value={career.totalGls} />
            <SummaryStat label="Asistencias" value={career.totalAst} />
          </>
        )}
        <SummaryStat label="Convocatorias" value={career.caps} />
        <SummaryStat label="Títulos" value={totalTitles} />
      </div>

      {/* Los premios individuales van aparte de los títulos de club: son del
          jugador, no del equipo, y son lo más raro de toda la pantalla. */}
      {career.awards.length > 0 && (
        <section className={styles.awardsBand}>
          <h2 className={styles.sectionTitle}>Premios individuales</h2>
          <div className={styles.awardList}>
            {career.awards.map((a, i) => (
              <span key={i} className={styles.awardPill}>
                <TrophyBadge label={a.label} size={18} className={styles.awardIcon} />
                <span className={styles.awardName}>{a.label}</span>
                <span className={styles.awardWhen}>{a.age} años</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={styles.sectionTitle}>Tu carrera, club por club</h2>
        {spells.length === 0 ? (
          <p className={styles.emptyCase}>No llegaste a debutar.</p>
        ) : (
          <div className={styles.spellGrid}>
            {spells.map((s) => (
              <article key={s.club.id} className={styles.spellCard}>
                {/* El escudo, en grande y casi transparente, identifica la
                    tarjeta de un vistazo sin competir con los datos. */}
                {s.club.logoUrl && <img src={s.club.logoUrl} alt="" className={styles.spellWatermark} aria-hidden="true" />}

                <div className={styles.spellHead}>
                  {s.club.logoUrl && <img src={s.club.logoUrl} alt="" className={styles.spellCrest} />}
                  <div className={styles.spellId}>
                    <h3 className={styles.spellClub}>{s.club.name}</h3>
                    <span className={styles.spellLeague}>{s.club.league}</span>
                  </div>
                  <span className={styles.spellYears} title="Edad a la que jugaste ahí">
                    {formatAges(s.ages)}
                  </span>
                </div>

                <dl className={styles.spellStats}>
                  <div>
                    <dt>PJ</dt>
                    <dd className="tabular">{s.pj}</dd>
                  </div>
                  <div>
                    <dt>{gk ? "VI" : "GLS"}</dt>
                    <dd className="tabular">{gk ? s.cs : s.gls}</dd>
                  </div>
                  <div>
                    <dt>{gk ? "PJ/VI" : "AST"}</dt>
                    <dd className="tabular">{gk ? (s.cs ? Math.round(s.pj / s.cs) : "—") : s.ast}</dd>
                  </div>
                </dl>

                <div className={styles.spellTitles}>
                  {s.titles.length === 0 ? (
                    <span className={styles.spellNoTitles}>Sin títulos aquí</span>
                  ) : (
                    s.titles.map((t) => (
                      <span key={t.label} className={styles.titleChip}>
                        <TrophyBadge label={t.label} league={s.club.league} size={15} className={styles.titleChipIcon} />
                        {t.label}
                        {t.count > 1 && <b className={styles.titleCount}>×{t.count}</b>}
                      </span>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className={styles.startActions}>
        <button className="primary" onClick={onPlayAgain}>
          Volver a jugar
        </button>
        <Link to="/jugar" className={styles.linkBack}>
          Volver a Juegos
        </Link>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <div className={styles.summaryStat}>
      <span className={styles.summaryStatLabel}>{label}</span>
      <span className={styles.summaryStatValue}>
        {text ?? (value !== undefined ? <CountUp to={value} duration={1.1} separator="," /> : null)}
      </span>
    </div>
  );
}
