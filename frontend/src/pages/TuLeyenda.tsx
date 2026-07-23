import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COUNTRIES, PITCH_LAYOUT, PitchPosition } from "../lib/careerData";
import { CareerState, newCareer, resolveOption } from "../lib/careerEngine";
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

export default function TuLeyenda() {
  const [screen, setScreen] = useState<Screen>("start");
  const [career, setCareer] = useState<CareerState | null>(null);

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

  if (screen === "start") return <StartScreen onStart={startNewCareer} hasSaved={!!career} onContinue={() => setScreen(career?.retired ? "retired" : "career")} />;

  if (screen === "identity") {
    return (
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
    );
  }

  if (!career) return null;

  if (screen === "retired") {
    return <RetiredScreen career={career} onSummary={() => setScreen("summary")} onPlayAgain={playAgain} />;
  }

  if (screen === "summary") {
    return <SummaryScreen career={career} onPlayAgain={playAgain} />;
  }

  return <CareerScreen career={career} onChoose={choose} />;
}

// ---------------------------------------------------------------------------

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
            <div className={styles.jersey} style={p.country ? ({ "--jc1": "#1a8f4a", "--jc2": "#e6001a" } as never) : undefined}>
              <span className={styles.jerseySurname}>{p.surname || "APELLIDO"}</span>
              <span className={styles.jerseyNumber}>{p.number}</span>
            </div>
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

function CareerScreen({ career, onChoose }: { career: CareerState; onChoose: (id: string) => void }) {
  const event = career.pendingEvent;
  return (
    <div className={styles.careerScreen}>
      <div className={styles.profileCol}>
        <div className={styles.profileCard}>
          <div className={styles.profileHead}>
            <span className={`${styles.ovrBadge} ${ovrTier(career.ovr)}`}>{career.ovr}</span>
            <div className={styles.profileInfo}>
              <div className={styles.profileChips}>
                <img src={flagUrl(career.countryCode)} alt="" width={18} height={13} />
                <span className={styles.posChip}>#{career.number} {career.position}</span>
              </div>
              <div className={styles.profileMeta}>
                <span className={styles.profileAge}>EDAD {career.age}</span>
                <span className={styles.profileValue}>
                  VALOR {formatMoney(career.marketValue)}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.profileClub}>
            <span className={styles.clubDot} style={{ background: career.club.color }} />
            {career.club.name}
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>PJ</span>
              <span className={styles.statValue}>{career.totalPj}</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>GLS</span>
              <span className={styles.statValue}>{career.totalGls}</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>AST</span>
              <span className={styles.statValue}>{career.totalAst}</span>
            </div>
          </div>

          <div className={styles.trophyCase}>
            {career.trophies.length === 0 ? (
              <span className={styles.emptyCase}>Vitrina vacía</span>
            ) : (
              <span className={styles.trophyCount}>🏆 {career.trophies.length} trofeo{career.trophies.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {event && (
            <div className={styles.eventBox}>
              <h3 className={styles.eventTitle}>{event.title}</h3>
              <p className={styles.eventDesc}>{event.description}</p>
              <div className={styles.eventOptions}>
                {event.options.map((opt) => (
                  <button key={opt.id} className={styles.eventOption} onClick={() => onChoose(opt.id)}>
                    <span className={styles.eventOptionLabel}>{opt.label}</span>
                    <span className={styles.eventOptionEffect}>{opt.effect}</span>
                    {opt.risk && <span className={styles.eventOptionRisk}>{opt.risk}</span>}
                  </button>
                ))}
              </div>
            </div>
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
          <div key={i} className={`${styles.timelineRow} ${i === career.history.length - 1 ? styles.timelineRowCurrent : ""}`}>
            <span className={styles.timelineAge}>{h.age}</span>
            <span className={styles.timelineClub}>
              <span className={styles.clubDot} style={{ background: h.club.color }} />
              {h.club.name}
              {h.trophies.length > 0 && <span className={styles.timelineTrophy} title={h.trophies.join(", ")}>🏆</span>}
            </span>
            <span className={`${styles.timelineOvr} ${ovrTier(h.ovr)}`}>{h.ovr}</span>
            <span>{h.pj}</span>
            <span>{h.gls}</span>
            <span>{h.ast}</span>
          </div>
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
    const map = new Map<string, { name: string; color: string; pj: number; gls: number; ast: number; trophies: number }>();
    for (const h of career.history) {
      const cur = map.get(h.club.id) ?? { name: h.club.name, color: h.club.color, pj: 0, gls: 0, ast: 0, trophies: 0 };
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
        {career.surname} #{career.number} · {career.position} · <img src={flagUrl(career.countryCode)} alt="" width={16} height={12} style={{ verticalAlign: "middle" }} /> {career.countryName}
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
          {career.trophies.map((t, i) => (
            <span key={i} className={styles.trophyPill}>
              🏆 {t.label} · {t.club} ({t.age})
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
          <div key={c.name} className={styles.clubCard} style={{ borderColor: c.color }}>
            <div className={styles.clubCardHead}>
              <span className={styles.clubDot} style={{ background: c.color }} />
              <strong>{c.name}</strong>
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
