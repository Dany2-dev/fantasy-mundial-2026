import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CONTINENTAL_CUP_LOGO, COUNTRIES, CareerClub, LEAGUE_LOGOS, PITCH_LAYOUT, PitchPosition } from "../lib/careerData";
import { CareerState, newCareer, resolveOption } from "../lib/careerEngine";
import { IconStar } from "../components/icons";
import { formatMoney } from "../lib/money";
import styles from "./TuLeyenda.module.css";

const STORAGE_KEY = "fm26_tu_leyenda";

type Screen = "start" | "identity" | "career" | "retired" | "summary";

function ovrTier(ovr: number): string {
  if (ovr >= 86) return styles.tierElite;
  if (ovr >= 78) return styles.tierGold;
  if (ovr >= 68) return styles.tierBlue;
  if (ovr >= 58) return styles.tierOrange;
  return styles.tierGray;
}

function flagUrl(code: string) {
  return `https://flagcdn.com/w80/${code}.png`;
}

function trophyLogo(label: string, club: CareerClub): string {
  if (label === "Copa Continental") return CONTINENTAL_CUP_LOGO;
  return LEAGUE_LOGOS[club.league] ?? CONTINENTAL_CUP_LOGO;
}

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// Pop sutil cada vez que cambia el valor — se usa en OVR, valor de mercado y
// PJ/GLS/AST para que se note el avance sin recargar toda la pantalla.
function AnimatedNumber({ value, className, reduceMotion }: { value: string | number; className?: string; reduceMotion?: boolean }) {
  return (
    <motion.span
      key={value}
      className={className}
      initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {value}
    </motion.span>
  );
}

export default function TuLeyenda() {
  const [screen, setScreen] = useState<Screen>("start");
  const [career, setCareer] = useState<CareerState | null>(null);
  const reduceMotion = useReducedMotion();

  // Identidad en construcción
  const [surname, setSurname] = useState("");
  const [number, setNumber] = useState(10);
  const [foot, setFoot] = useState<"Izquierda" | "Derecha">("Derecha");
  const [countryQuery, setCountryQuery] = useState("");
  const [country, setCountry] = useState<{ name: string; code: string } | null>(null);
  const [position, setPosition] = useState<PitchPosition | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as CareerState;
      setCareer(saved);
      setScreen(saved.retired ? "retired" : "career");
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (career) localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
  }, [career]);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [countryQuery]);

  function startNewCareer() {
    setSurname("");
    setNumber(10);
    setFoot("Derecha");
    setCountryQuery("");
    setCountry(null);
    setPosition(null);
    setScreen("identity");
  }

  function confirmIdentity() {
    if (!surname.trim() || !country || !position) return;
    const c = newCareer({
      surname: surname.trim().toUpperCase(),
      number: Math.max(1, Math.min(99, number)),
      foot,
      countryName: country.name,
      countryCode: country.code,
      position,
    });
    setCareer(c);
    setScreen("career");
  }

  function choose(optionId: string) {
    if (!career) return;
    const next = resolveOption(career, optionId);
    setCareer(next);
    if (next.retired) setScreen("retired");
  }

  function playAgain() {
    localStorage.removeItem(STORAGE_KEY);
    setCareer(null);
    setScreen("start");
  }

  function restart() {
    if (!confirm("¿Reiniciar tu carrera actual? Se pierde el progreso.")) return;
    playAgain();
  }

  const inGame = screen === "career" || screen === "retired" || screen === "summary";

  return (
    <div>
      <TopBar
        stageLabel={career && inGame ? `${career.surname} · ${career.age} años · ${career.club.name}` : undefined}
        onRestart={career ? restart : undefined}
      />
      <AnimatePresence mode="wait">
        {screen === "start" && (
          <motion.div key="start" {...(reduceMotion ? {} : fade)} transition={{ duration: 0.45 }}>
            <StartScreen onStart={startNewCareer} hasSaved={!!career} onContinue={() => setScreen(career?.retired ? "retired" : "career")} />
          </motion.div>
        )}
        {screen === "identity" && (
          <motion.div key="identity" {...(reduceMotion ? {} : fade)} transition={{ duration: 0.45 }}>
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
          </motion.div>
        )}
        {screen === "career" && career && (
          <motion.div key="career" {...(reduceMotion ? {} : fade)} transition={{ duration: 0.45 }}>
            <CareerScreen career={career} onChoose={choose} reduceMotion={!!reduceMotion} />
          </motion.div>
        )}
        {screen === "retired" && career && (
          <motion.div key="retired" {...(reduceMotion ? {} : fade)} transition={{ duration: 0.45 }}>
            <RetiredScreen career={career} onSummary={() => setScreen("summary")} onPlayAgain={playAgain} />
          </motion.div>
        )}
        {screen === "summary" && career && (
          <motion.div key="summary" {...(reduceMotion ? {} : fade)} transition={{ duration: 0.45 }}>
            <SummaryScreen career={career} onPlayAgain={playAgain} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TopBar({ stageLabel, onRestart }: { stageLabel?: string; onRestart?: () => void }) {
  return (
    <div className={styles.topBar}>
      <span className={styles.topBarBrand}>
        <IconStar size={18} />
        Tu Leyenda
      </span>
      {stageLabel && <span className={styles.topBarStage}>{stageLabel}</span>}
      {onRestart && (
        <button className={styles.topBarRestart} onClick={onRestart}>
          Reiniciar carrera
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

function IdentityScreen(p: IdentityProps) {
  const ready = p.surname.trim().length >= 2 && !!p.country && !!p.position;
  return (
    <div className={styles.identityScreen}>
      <h1 className={styles.identityTitle}>Definí tu identidad</h1>
      <div className={styles.identityGrid}>
        <div className={styles.identityCol}>
          <h2 className={styles.colTitle}>Identidad</h2>
          <div className={styles.jerseyWrap}>
            <motion.div
              className={styles.jersey}
              animate={{ scale: [0.97, 1] }}
              transition={{ duration: 0.5 }}
              key={p.number}
            >
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
            <input
              type="number"
              min={1}
              max={99}
              value={p.number}
              onChange={(e) => p.setNumber(Number(e.target.value) || 1)}
            />
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
          <h2 className={styles.colTitle}>Nacionalidad</h2>
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
          <h2 className={styles.colTitle}>Posición</h2>
          <div className={styles.pitch}>
            {PITCH_LAYOUT.map((slot) => (
              <button
                key={slot.pos}
                className={`${styles.pitchSlot} ${p.position === slot.pos ? styles.pitchSlotActive : ""}`}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onClick={() => p.setPosition(slot.pos)}
              >
                {slot.pos}
              </button>
            ))}
          </div>
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

function CareerScreen({ career, onChoose, reduceMotion }: { career: CareerState; onChoose: (id: string) => void; reduceMotion: boolean }) {
  const event = career.pendingEvent;
  return (
    <div className={styles.careerScreen}>
      <div className={styles.profileCol}>
        <div className={styles.profileCard}>
          <div className={styles.profileHead}>
            <motion.span
              key={career.ovr}
              className={`${styles.ovrBadge} ${ovrTier(career.ovr)}`}
              initial={reduceMotion ? undefined : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 14 }}
            >
              {career.ovr}
            </motion.span>
            <div className={styles.profileInfo}>
              <div className={styles.profileChips}>
                <img src={flagUrl(career.countryCode)} alt="" width={18} height={13} />
                <span className={styles.posChip}>#{career.number} {career.position}</span>
              </div>
              <div className={styles.profileMeta}>
                <span className={styles.profileAge}>EDAD {career.age}</span>
                <span className={styles.profileValue}>
                  VALOR <AnimatedNumber value={formatMoney(career.marketValue)} reduceMotion={reduceMotion} />
                </span>
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
              <AnimatedNumber value={career.totalPj} className={styles.statValue} reduceMotion={reduceMotion} />
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>GLS</span>
              <AnimatedNumber value={career.totalGls} className={styles.statValue} reduceMotion={reduceMotion} />
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>AST</span>
              <AnimatedNumber value={career.totalAst} className={styles.statValue} reduceMotion={reduceMotion} />
            </div>
          </div>

          <div className={styles.trophyCase}>
            {career.trophies.length === 0 ? (
              <span className={styles.emptyCase}>Vitrina vacía</span>
            ) : (
              <div className={styles.trophyIcons}>
                {career.trophies.slice(-6).map((tr, i) => (
                  <img key={i} src={trophyLogo(tr.label, career.club)} alt={tr.label} title={`${tr.label} · ${tr.club} (${tr.age})`} className={styles.trophyIcon} />
                ))}
                {career.trophies.length > 6 && <span className={styles.trophyMore}>+{career.trophies.length - 6}</span>}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {event && (
              <motion.div
                key={event.title + career.age}
                className={styles.eventBox}
                initial={reduceMotion ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <h3 className={styles.eventTitle}>{event.title}</h3>
                <p className={styles.eventDesc}>{event.description}</p>
                <div className={styles.eventOptions}>
                  {event.options.map((opt) => (
                    <motion.button
                      key={opt.id}
                      className={styles.eventOption}
                      onClick={() => onChoose(opt.id)}
                      whileHover={reduceMotion ? undefined : { scale: 1.015 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      style={opt.image ? { backgroundImage: `linear-gradient(90deg, rgba(11,18,32,.94), rgba(11,18,32,.55)), url(${opt.image})` } : undefined}
                    >
                      <span className={styles.eventOptionLabel}>{opt.label}</span>
                      <span className={styles.eventOptionEffect}>{opt.effect}</span>
                      {opt.risk && <span className={styles.eventOptionRisk}>{opt.risk}</span>}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.timelineCol}>
        <div className={styles.timelineHead}>
          <span>Edad</span>
          <span>Club</span>
          <span>OVR</span>
          <span>PJ</span>
          <span>GLS</span>
          <span>AST</span>
        </div>
        {career.history.map((h, i) => (
          <motion.div
            key={i}
            className={`${styles.timelineRow} ${i === career.history.length - 1 ? styles.timelineRowCurrent : ""}`}
            initial={reduceMotion ? undefined : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: reduceMotion ? 0 : Math.min(i * 0.05, 0.4) }}
          >
            <span className={styles.timelineAge}>{h.age}</span>
            <span className={styles.timelineClub}>
              <img src={h.club.logoUrl} alt="" className={styles.timelineCrest} />
              {h.club.name}
              {h.trophies.length > 0 && (
                <img src={trophyLogo(h.trophies[0], h.club)} alt="" className={styles.timelineTrophy} title={h.trophies.join(", ")} />
              )}
            </span>
            <span className={`${styles.timelineOvr} ${ovrTier(h.ovr)}`}>{h.ovr}</span>
            <span>{h.pj}</span>
            <span>{h.gls}</span>
            <span>{h.ast}</span>
          </motion.div>
        ))}
        <div className={styles.timelineRow}>
          <span className={styles.timelineAge}>{career.age}</span>
          <span className={styles.timelineClubPending}>Eligiendo club…</span>
        </div>
      </div>
    </div>
  );
}

function RetiredScreen({ career, onSummary, onPlayAgain }: { career: CareerState; onSummary: () => void; onPlayAgain: () => void }) {
  return (
    <div className={styles.startScreen}>
      <div className={styles.startInner}>
        <p className={styles.eyebrow}>{career.surname} · {career.history.length} etapas</p>
        <h1 className={styles.startTitle}>Tu carrera llegó a su fin</h1>
        <p className={styles.startDesc}>
          Colgaste los botines a los {career.age} años con {career.totalGls} goles y {career.totalAst} asistencias,
          un pico de {career.peakOvr} OVR y {career.trophies.length} trofeo{career.trophies.length !== 1 ? "s" : ""} en la vitrina.
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

function SummaryScreen({ career, onPlayAgain }: { career: CareerState; onPlayAgain: () => void }) {
  const byClub = useMemo(() => {
    const map = new Map<string, { club: CareerClub; pj: number; gls: number; ast: number; trophies: number }>();
    for (const h of career.history) {
      const cur = map.get(h.club.id) ?? { club: h.club, pj: 0, gls: 0, ast: 0, trophies: 0 };
      cur.pj += h.pj;
      cur.gls += h.gls;
      cur.ast += h.ast;
      cur.trophies += h.trophies.length;
      map.set(h.club.id, cur);
    }
    return Array.from(map.values());
  }, [career.history]);

  return (
    <div className={styles.summaryScreen}>
      <h1 className={styles.identityTitle}>Resumen de carrera</h1>
      <p className={styles.startDesc}>
        {career.surname} #{career.number} · {career.position} ·{" "}
        <img src={flagUrl(career.countryCode)} alt="" width={16} height={12} style={{ verticalAlign: "middle" }} /> {career.countryName}
      </p>

      <div className={styles.summaryStats}>
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>OVR máximo</span>
          <span className={styles.summaryStatValue}>{career.peakOvr}</span>
        </div>
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>Valor máximo</span>
          <span className={styles.summaryStatValue}>{formatMoney(career.peakValue)}</span>
        </div>
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>Partidos</span>
          <span className={styles.summaryStatValue}>{career.totalPj}</span>
        </div>
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>Goles</span>
          <span className={styles.summaryStatValue}>{career.totalGls}</span>
        </div>
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>Asistencias</span>
          <span className={styles.summaryStatValue}>{career.totalAst}</span>
        </div>
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>Convocatorias</span>
          <span className={styles.summaryStatValue}>{career.caps}</span>
        </div>
      </div>

      <h2 className={styles.colTitle}>Trofeos y premios</h2>
      {career.trophies.length === 0 && career.awards.length === 0 ? (
        <p className={styles.emptyCase}>Vitrina vacía</p>
      ) : (
        <div className={styles.trophyList}>
          {career.trophies.map((tr, i) => (
            <span key={i} className={styles.trophyPill}>
              <img src={trophyLogo(tr.label, byClub.find((c) => c.club.name === tr.club)?.club ?? career.club)} alt="" className={styles.trophyPillIcon} />
              {tr.label} · {tr.club} ({tr.age})
            </span>
          ))}
          {career.awards.map((a, i) => (
            <span key={`a${i}`} className={styles.trophyPill}>
              🎖️ {a}
            </span>
          ))}
        </div>
      )}

      <h2 className={styles.colTitle}>Por club</h2>
      <div className={styles.clubBreakdown}>
        {byClub.map((c) => (
          <div key={c.club.id} className={styles.clubCard}>
            <div className={styles.clubCardHead}>
              <img src={c.club.logoUrl} alt="" className={styles.clubCrest} />
              <strong>{c.club.name}</strong>
            </div>
            <div className={styles.clubCardStats}>
              <span>{c.pj} PJ</span>
              <span>{c.gls} GLS</span>
              <span>{c.ast} AST</span>
              {c.trophies > 0 && <span>🏆 {c.trophies}</span>}
            </div>
          </div>
        ))}
      </div>

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
