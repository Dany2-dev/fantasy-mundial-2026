import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COUNTRIES, CareerClub, PITCH_LAYOUT, PitchPosition, findClub } from "../lib/careerData";
import { CareerEvent, CareerState, LuckRoll, newCareer, resolveOption } from "../lib/careerEngine";
import { StageOutcome, careerEpitaph, scoutingHint, stageNarrative } from "../lib/careerNarrative";
import { trophyByName } from "../lib/careerTrophies";
import CountUp from "../components/CountUp";
import LuckGauge from "../components/LuckGauge";
import { TrophyGlyph } from "../components/TrophyIcons";
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

function reputationLabel(rep: number): string {
  if (rep >= 85) return "Leyenda mundial";
  if (rep >= 65) return "Estrella internacional";
  if (rep >= 45) return "Nombre reconocido";
  if (rep >= 25) return "Suena en el mercado";
  if (rep >= 10) return "Promesa local";
  return "Desconocido";
}

// Panel de historia: qué pasó en las dos temporadas que acabás de jugar.
function StageReport({
  stage,
  position,
  luck,
  reduceMotion,
}: {
  stage: StageOutcome;
  position: PitchPosition;
  luck: LuckRoll | null;
  reduceMotion: boolean;
}) {
  const delta = stage.ovrAfter - stage.ovrBefore;
  return (
    <motion.div
      className={styles.reportBox}
      initial={reduceMotion ? undefined : { y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {/* Si la decisión anterior tenía porcentaje, primero se ve cómo cayó. */}
      {luck && <LuckGauge roll={luck} />}

      <div className={styles.reportHead}>
        <span className={styles.reportSeason}>
          {stage.ageFrom}–{stage.ageTo} · {stage.clubName}
        </span>
        <span className={`${styles.reportDelta} ${delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
          {delta >= 0 ? "+" : ""}
          {delta} OVR
        </span>
      </div>

      <div className={styles.reportStats}>
        <span>
          <strong>{stage.pj}</strong> PJ
        </span>
        <span>
          <strong>{stage.gls}</strong> goles
        </span>
        <span>
          <strong>{stage.ast}</strong> asist.
        </span>
      </div>

      <p className={styles.reportText}>{stageNarrative(stage, position)}</p>

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

// Entrada de pantalla: SOLO desplazamiento, sin fundido. Un `opacity: 0`
// inicial deja la pantalla entera invisible si el navegador congela los
// frames (pestaña en segundo plano, ahorro de energía); con transform, el
// peor caso es que aparezca 12px desplazada pero perfectamente usable.
const fade = {
  initial: { y: 12 },
  animate: { y: 0 },
};

// Pop sutil cada vez que cambia el valor — se usa en OVR, valor de mercado y
// PJ/GLS/AST para que se note el avance sin recargar toda la pantalla.
function AnimatedNumber({ value, className, reduceMotion }: { value: string | number; className?: string; reduceMotion?: boolean }) {
  return (
    <motion.span
      key={value}
      className={className}
      initial={reduceMotion ? undefined : { y: -4 }}
      animate={{ y: 0 }}
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
      {/* Sin AnimatePresence a nivel de pantalla: `mode="wait"` retrasa el
          montaje de la pantalla siguiente hasta terminar la animación de
          salida, y si el navegador congela los frames (pestaña en segundo
          plano) el juego se queda trabado. Cada pantalla anima solo su
          entrada — más robusto y sin el salto entre etapas. */}
      <motion.div key={screen} {...(reduceMotion ? {} : fade)} transition={{ duration: 0.45 }}>
        {screen === "start" && (
          <StartScreen onStart={startNewCareer} hasSaved={!!career} onContinue={() => setScreen(career?.retired ? "retired" : "career")} />
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
          <CareerScreen career={career} onChoose={choose} reduceMotion={!!reduceMotion} />
        )}
        {screen === "retired" && career && (
          <RetiredScreen career={career} onSummary={() => setScreen("summary")} onPlayAgain={playAgain} />
        )}
        {screen === "summary" && career && <SummaryScreen career={career} onPlayAgain={playAgain} />}
      </motion.div>
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

// Todas las opciones se ven a la vez, una al lado de la otra. Antes eran una
// pila arrastrable, pero el gesto de arrastrar para ver la siguiente terminaba
// disparando el click y elegías sin querer: con las cartas desplegadas no hay
// ambigüedad entre "mirar" y "elegir".
function EventOptions({ event, onChoose, reduceMotion }: { event: CareerEvent; onChoose: (id: string) => void; reduceMotion: boolean }) {
  const isClubChoice = event.options.length > 1 && event.options.every((o) => o.clubId);

  if (isClubChoice) {
    return (
      <div className={styles.clubChoiceGrid}>
        {event.options.map((opt, i) => {
          const club = opt.clubId ? findClub(opt.clubId) : undefined;
          if (!club) return null;
          // Solo se anima el desplazamiento, nunca la opacidad: si el navegador
          // congela los frames, la carta queda visible y clickeable.
          return (
            <motion.button
              key={opt.id}
              className={styles.clubChoiceCard}
              onClick={() => onChoose(opt.id)}
              initial={reduceMotion ? undefined : { y: 12 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : i * 0.07 }}
              whileHover={reduceMotion ? undefined : { y: -4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <img src={club.logoUrl} alt="" className={styles.clubChoiceCrest} />
              <strong className={styles.clubChoiceName}>{club.name}</strong>
              <span className={styles.clubChoiceLeague}>{club.league}</span>
              <span className={styles.clubChoiceAction}>{opt.label}</span>
              {opt.risk && <span className={styles.clubChoiceRisk}>{opt.risk}</span>}
            </motion.button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.eventOptions}>
      {event.options.map((opt, i) => (
        <motion.button
          key={opt.id}
          className={styles.eventOption}
          onClick={() => onChoose(opt.id)}
          initial={reduceMotion ? undefined : { y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.35, delay: reduceMotion ? 0 : i * 0.07 }}
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
  );
}

function CareerScreen({ career, onChoose, reduceMotion }: { career: CareerState; onChoose: (id: string) => void; reduceMotion: boolean }) {
  const event = career.pendingEvent;
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
              <span className={styles.statValue}>
                <CountUp to={career.totalPj} duration={0.9} />
              </span>
            </div>
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
                {career.trophies.slice(-6).map((tr, i) => (
                  <TrophyBadge
                    key={i}
                    label={tr.label}
                    league={career.club.league}
                    title={`${tr.label} · ${tr.club} (${tr.age})`}
                    className={styles.trophyIcon}
                  />
                ))}
                {career.trophies.length > 6 && <span className={styles.trophyMore}>+{career.trophies.length - 6}</span>}
              </div>
            )}
          </div>

          {career.lastStage && (
            <StageReport
              stage={career.lastStage}
              position={career.position}
              luck={career.lastRoll}
              reduceMotion={reduceMotion}
            />
          )}
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
            initial={reduceMotion ? undefined : { x: -8 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.4, delay: reduceMotion ? 0 : Math.min(i * 0.05, 0.4) }}
          >
            <span className={styles.timelineAge}>{h.age}</span>
            <span className={styles.timelineClub}>
              <img src={h.club.logoUrl} alt="" className={styles.timelineCrest} />
              {h.club.name}
              {h.trophies.map((t, ti) => (
                <TrophyBadge key={ti} label={t} league={h.club.league} size={15} className={styles.timelineTrophy} title={t} />
              ))}
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

      {/* La decisión ocupa todo el ancho: es la interacción principal y así
          las opciones caben lado a lado, sin pilas ni arrastres. */}
      {event && (
        <motion.div
          key={event.title + career.age}
          className={styles.decisionPanel}
          initial={reduceMotion ? undefined : { y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className={styles.eventTitle}>{event.title}</h3>
          <p className={styles.eventDesc}>{event.description}</p>
          <EventOptions event={event} onChoose={onChoose} reduceMotion={reduceMotion} />
        </motion.div>
      )}
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
              <TrophyBadge
                label={tr.label}
                league={byClub.find((c) => c.club.name === tr.club)?.club.league ?? career.club.league}
                size={16}
                className={styles.trophyPillIcon}
              />
              {tr.label} · {tr.club} ({tr.age})
            </span>
          ))}
          {career.awards.map((a, i) => (
            <span key={`a${i}`} className={styles.trophyPill}>
              <TrophyBadge label={a.label} size={16} className={styles.trophyPillIcon} />
              {a.label} · {a.club} ({a.age})
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
