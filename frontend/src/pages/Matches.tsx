import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Flag from "../components/Flag";
import { IconBall, IconClock, IconClose, IconTrophy } from "../components/icons";
import { stadiumPhotoFor } from "../lib/stadiumPhotos";
import { useAppSelector } from "../store/store";
import { Match, MatchEvent, MatchStatRow, MatchTeam, ScorerRow, StandingsGroup } from "../types";
import styles from "./Matches.module.css";

type Filter = "todos" | "vivo" | "hoy" | "proximos" | "resultados";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "vivo", label: "En vivo" },
  { key: "hoy", label: "Hoy" },
  { key: "proximos", label: "Próximos" },
  { key: "resultados", label: "Resultados" },
];

const EMPTY_BY_FILTER: Record<Filter, string> = {
  todos: "Todavía no hay partidos disponibles en esta competencia.",
  vivo: "No hay nada en vivo ahora. Revisa los próximos partidos.",
  hoy: "Hoy no rueda el balón en esta competencia.",
  proximos: "El calendario no tiene próximos partidos por ahora.",
  resultados: "Aún no hay resultados para mostrar.",
};

// Etiqueta de sección: grupos A-L en el Mundial, jornadas en ligas de clubes.
// Sin grupo ni jornada: "Eliminatorias" para copas, "Calendario" para ligas.
function groupOf(m: Match, isCup: boolean): string {
  if (m.group && /^[A-L]$/.test(m.group)) return `Grupo ${m.group}`;
  if (m.roundLabel) return m.roundLabel;
  return isCup ? "Eliminatorias" : "Calendario";
}

// ---- Resumen por equipo calculado en el front (estilo FotMob) ----
// Forma (últimos 5), próximo rival y récord salen de la lista de partidos que
// ya está cargada: no requiere endpoints nuevos y funciona con datos reales hoy.
type FormResult = "G" | "E" | "P";

interface TeamSummary {
  team: MatchTeam;
  group: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: FormResult[];
  next: Match | null;
}

function summarizeTeams(matches: Match[]): Map<string, TeamSummary> {
  const map = new Map<string, TeamSummary>();
  const get = (t: MatchTeam, group: string | null): TeamSummary => {
    let s = map.get(t.name);
    if (!s) {
      s = { team: t, group, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [], next: null };
      map.set(t.name, s);
    }
    return s;
  };

  const finished = matches
    .filter((m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => (a.utcTime ?? "").localeCompare(b.utcTime ?? ""));
  for (const m of finished) {
    const home = get(m.home, m.group);
    const away = get(m.away, m.group);
    const hs = m.homeScore!;
    const as_ = m.awayScore!;
    home.played++;
    away.played++;
    home.goalsFor += hs;
    home.goalsAgainst += as_;
    away.goalsFor += as_;
    away.goalsAgainst += hs;
    if (hs > as_) {
      home.won++;
      away.lost++;
      home.points += 3;
      home.form.push("G");
      away.form.push("P");
    } else if (hs < as_) {
      away.won++;
      home.lost++;
      away.points += 3;
      away.form.push("G");
      home.form.push("P");
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
      home.form.push("E");
      away.form.push("E");
    }
  }
  for (const s of map.values()) s.form = s.form.slice(-5);

  const upcoming = matches
    .filter((m) => m.status === "scheduled" && m.utcTime)
    .sort((a, b) => (a.utcTime ?? "").localeCompare(b.utcTime ?? ""));
  for (const m of upcoming) {
    const home = get(m.home, m.group);
    const away = get(m.away, m.group);
    if (!home.next) home.next = m;
    if (!away.next) away.next = m;
  }
  return map;
}

// Tabla calculada localmente (fallback cuando /standings no existe en el back).
function computeStandings(teamStats: Map<string, TeamSummary>): StandingsGroup[] {
  const byGroup = new Map<string, TeamSummary[]>();
  for (const s of teamStats.values()) {
    const g = s.group && /^[A-L]$/.test(s.group) ? s.group : "General";
    (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(s);
  }
  const groups = [...byGroup.keys()].sort((a, b) => (a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b)));
  return groups
    .map((g) => ({
      group: g,
      rows: byGroup
        .get(g)!
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
            b.goalsFor - a.goalsFor ||
            a.team.name.localeCompare(b.team.name)
        )
        .map((s, i) => ({
          teamId: i,
          name: s.team.name,
          flag: s.team.flag,
          logoUrl: s.team.logoUrl,
          played: s.played,
          won: s.won,
          drawn: s.drawn,
          lost: s.lost,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalDiff: s.goalsFor - s.goalsAgainst,
          points: s.points,
        })),
    }))
    .filter((g) => g.rows.length > 0);
}

// Etiqueta de día para la siguiente jornada ("Hoy", "Mañana", "viernes 24 de julio").
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "Hoy";
  if (same(d, tomorrow)) return "Mañana";
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

// Inicio de semana (lunes) para inferir jornadas cuando la fuente no manda
// el número: en ligas los partidos se agrupan por bloques semanales.
function weekKey(iso: string): number {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

function poisson(lambda: number, k: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function matchesFilter(m: Match, f: Filter): boolean {
  switch (f) {
    case "vivo":
      return m.status === "live";
    case "hoy":
      return isToday(m.utcTime);
    case "proximos":
      return m.status === "scheduled";
    case "resultados":
      return m.status === "finished";
    default:
      return true;
  }
}

function kickoff(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString("es-MX", { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : "Por definir";
}

// Cuenta regresiva viva hacia el arranque del próximo partido.
function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className={styles.countdown} role="timer" aria-label="Tiempo para el arranque">
      {d > 0 && (
        <span className={styles.countBlock}>
          {d}
          <small>d</small>
        </span>
      )}
      <span className={styles.countBlock}>
        {pad(h)}
        <small>h</small>
      </span>
      <span className={styles.countBlock}>
        {pad(min)}
        <small>m</small>
      </span>
      <span className={styles.countBlock}>
        {pad(s)}
        <small>s</small>
      </span>
    </div>
  );
}

// Esqueleto de carga con shimmer: silueta del hero + cards mientras llega /matches.
function MatchesSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={`${styles.skel} ${styles.skelHero}`} />
      <div className={styles.grid} style={{ marginTop: "var(--sp-4)" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${styles.skel} ${styles.skelCard}`} />
        ))}
      </div>
    </div>
  );
}

// Juan trabaja el diseño de esta página. Los partidos jugados/en vivo/próximos
// ya vienen de datos reales de FotMob (GET /matches); tabla general y
// goleadores se conectan después. La franja "En vivo" se auto-refresca cada 60s
// para dar sensación de marcador en vivo tipo ESPN.
export default function Matches() {
  const activeLeague = useAppSelector((s) => s.leagues.leagues.find((l) => l.id === s.leagues.activeLeagueId));
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  // Jornadas/grupos desplegados manualmente; sin entrada aquí, las secciones
  // con partidos pendientes o en vivo abren solas y las ya jugadas se pliegan.
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>({});

  const competitionId = activeLeague?.competitionId;

  useEffect(() => {
    if (!competitionId) return;
    let alive = true;
    setLoading(true);
    const load = () =>
      api<{ matches: Match[] }>(`/matches?competitionId=${competitionId}`)
        .then((d) => {
          if (!alive) return;
          setMatches(d.matches);
          setUpdatedAt(new Date());
        })
        .catch(() => alive && setMatches([]))
        .finally(() => alive && setLoading(false));
    load();
    const iv = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [competitionId]);

  const live = useMemo(() => matches.filter((m) => m.status === "live"), [matches]);
  const finished = matches.filter((m) => m.status === "finished").length;

  // Próximo partido (el de arranque más cercano en el futuro) para cuando no hay nada en vivo.
  const nextMatch = useMemo(() => {
    const now = Date.now();
    return matches
      .filter((m) => m.status === "scheduled" && m.utcTime && new Date(m.utcTime).getTime() >= now)
      .sort((a, b) => (a.utcTime ?? "").localeCompare(b.utcTime ?? ""))[0];
  }, [matches]);

  const teamStats = useMemo(() => summarizeTeams(matches), [matches]);

  const counts = useMemo(
    () =>
      FILTERS.reduce<Record<Filter, number>>(
        (acc, { key }) => {
          acc[key] = key === "todos" ? matches.length : matches.filter((m) => matchesFilter(m, key)).length;
          return acc;
        },
        { todos: 0, vivo: 0, hoy: 0, proximos: 0, resultados: 0 }
      ),
    [matches]
  );

  // Lista filtrada y agrupada por grupo/jornada/eliminatoria.
  const isCup = activeLeague?.competition?.type !== "league";

  // Jornadas inferidas por semana cuando la fuente no trae roundLabel (Liga MX
  // vía ESPN, por ejemplo). La numeración usa TODOS los partidos para que no
  // cambie al filtrar.
  const roundByWeek = useMemo(() => {
    if (isCup || matches.some((m) => m.roundLabel)) return null;
    const keys = [...new Set(matches.filter((m) => m.utcTime).map((m) => weekKey(m.utcTime!)))].sort((a, b) => a - b);
    return new Map(keys.map((k, i) => [k, `Jornada ${i + 1}`]));
  }, [matches, isCup]);

  const groups = useMemo(() => {
    const filtered = matches.filter((m) => matchesFilter(m, filter));
    const map = new Map<string, Match[]>();
    for (const m of filtered) {
      const g = roundByWeek && m.utcTime ? roundByWeek.get(weekKey(m.utcTime))! : groupOf(m, isCup);
      (map.get(g) ?? map.set(g, []).get(g)!).push(m);
    }
    const order = [...map.keys()].sort((a, b) =>
      a === "Eliminatorias" ? 1 : b === "Eliminatorias" ? -1 : a.localeCompare(b, "es", { numeric: true })
    );
    for (const g of order) map.get(g)!.sort((a, b) => (a.utcTime ?? "").localeCompare(b.utcTime ?? ""));
    return { map, order };
  }, [matches, filter, isCup, roundByWeek]);

  if (!activeLeague) {
    return (
      <div className={styles.empty}>
        <h1>Partidos</h1>
        <p className="muted">Primero entra a una liga. Ahí podrás seguir cada partido de su competencia.</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <h1>Partidos</h1>
          <p className="muted">{activeLeague.competition?.name}</p>
        </div>
        <div className={styles.badges}>
          {live.length > 0 && (
            <span className={styles.liveBadge}>
              <span className={styles.pulseDot} /> {live.length} en vivo
            </span>
          )}
          <span className={styles.countBadge}>
            {matches.length} partidos · {finished} jugados
          </span>
        </div>
      </div>

      {loading && matches.length === 0 && <MatchesSkeleton />}

      {/* ---- Franja destacada: en vivo ahora, o próximo partido ---- */}
      {live.length > 0 ? (
        <section className={styles.liveHero}>
          <div className={styles.heroHead}>
            <h2 className={styles.heroTitle}>
              <span className={styles.pulseDot} /> En vivo ahora
            </h2>
            {updatedAt && (
              <span className={styles.updated}>
                Actualizado {updatedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className={styles.heroGrid}>
            {live.map((m) => (
              <HeroMatch key={m.id} m={m} onOpen={() => setOpenMatch(m)} />
            ))}
          </div>
        </section>
      ) : (
        nextMatch && (
          <section className={styles.liveHero}>
            <div className={styles.heroHead}>
              <h2 className={styles.heroTitle}>Próximo partido</h2>
            </div>
            <div className={styles.heroGrid}>
              <HeroMatch m={nextMatch} upcoming onOpen={() => setOpenMatch(nextMatch)} />
            </div>
          </section>
        )
      )}

      {/* ---- Filtros segmentados ---- */}
      <div className={styles.segment} role="tablist" aria-label="Filtrar partidos">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={`${styles.segBtn} ${filter === key ? styles.segActive : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
            {counts[key] > 0 && <span className={styles.segCount}>{counts[key]}</span>}
          </button>
        ))}
      </div>

      {/* ---- Lista agrupada ---- */}
      {!loading && groups.order.length === 0 && (
        <p className={`muted ${styles.emptyFiltered}`}>{EMPTY_BY_FILTER[filter]}</p>
      )}

      {groups.order.map((g) => {
        const ms = groups.map.get(g)!;
        const liveCount = ms.filter((m) => m.status === "live").length;
        const playedCount = ms.filter((m) => m.status === "finished").length;
        const isOpen = openRounds[g] ?? ms.some((m) => m.status !== "finished");
        return (
          <section key={g} className={styles.groupSection}>
            <button
              className={styles.roundHeader}
              aria-expanded={isOpen}
              onClick={() => setOpenRounds((prev) => ({ ...prev, [g]: !isOpen }))}
            >
              <span className={styles.roundTitle}>{g}</span>
              <span className={styles.roundMeta}>
                {liveCount > 0 && (
                  <span className={styles.statusLive}>
                    <span className={styles.pulseDot} /> {liveCount}
                  </span>
                )}
                <span className="tabular">
                  {playedCount}/{ms.length}
                </span>
                <span className={styles.chevron} data-open={isOpen} aria-hidden="true" />
              </span>
            </button>
            {isOpen && (
              <div className={styles.grid}>
                {ms.map((m, i) => (
                  <MatchCard key={m.id} m={m} index={i} onOpen={() => setOpenMatch(m)} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* ---- Tabla general, goleadores y siguiente jornada ---- */}
      {competitionId ? (
        <div className={styles.statsGrid}>
          <StandingsSection competitionId={competitionId} teamStats={teamStats} />
          <ScorersSection competitionId={competitionId} />
          <NextRoundSection matches={matches} onOpen={setOpenMatch} />
        </div>
      ) : (
        <p className={`caption ${styles.comingSoon}`}>Tabla general y goleadores llegan pronto.</p>
      )}

      {openMatch && (
        <MatchDetailModal m={openMatch} allMatches={matches} onClose={() => setOpenMatch(null)} />
      )}
    </div>
  );
}

// Modal minuto a minuto: timeline de eventos del partido. Consume
// GET /matches/:id/events (contrato futuro del back); si no existe, cae al
// caption "llega pronto" sin romper nada.
function MatchDetailModal({
  m,
  allMatches = [],
  onClose,
}: {
  m: Match;
  allMatches?: Match[];
  onClose: () => void;
}) {
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [stats, setStats] = useState<MatchStatRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ events: MatchEvent[] }>(`/matches/${m.id}/events`)
      .then((d) => alive && setEvents(d.events))
      .catch(() => alive && setFailed(true));
    // Estadísticas bilaterales (posesión, tiros...): si el endpoint no existe
    // todavía, la sección simplemente no se muestra.
    api<{ stats: MatchStatRow[] }>(`/matches/${m.id}/stats`)
      .then((d) => alive && setStats(d.stats))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [m.id]);

  const teamStats = useMemo(() => summarizeTeams(allMatches), [allMatches]);
  const homeSummary = teamStats.get(m.home.name);
  const awaySummary = teamStats.get(m.away.name);

  // Análisis del duelo (estilo BeSoccer). Con goles reales del torneo usa un
  // Poisson simple (ataque propio vs defensa rival + ligera ventaja de local)
  // que da la barra 1X2 y la matriz de marcadores exactos; sin goles todavía,
  // cae a la heurística por forma reciente.
  const analysis = useMemo(() => {
    if (!homeSummary || !awaySummary) return null;
    if (homeSummary.played > 0 && awaySummary.played > 0) {
      const lambdaH = Math.max(
        0.2,
        ((homeSummary.goalsFor / homeSummary.played + awaySummary.goalsAgainst / awaySummary.played) / 2) * 1.12
      );
      const lambdaA = Math.max(
        0.15,
        (awaySummary.goalsFor / awaySummary.played + homeSummary.goalsAgainst / homeSummary.played) / 2
      );
      const grid: number[][] = [];
      let pH = 0;
      let pD = 0;
      let pA = 0;
      for (let h = 0; h <= 8; h++) {
        for (let a = 0; a <= 8; a++) {
          const p = poisson(lambdaH, h) * poisson(lambdaA, a);
          if (h > a) pH += p;
          else if (h < a) pA += p;
          else pD += p;
          if (h < 5 && a < 5) (grid[h] ??= [])[a] = p;
        }
      }
      return {
        method: "goles" as const,
        grid,
        maxCell: Math.max(...grid.flat()),
        home: Math.round(pH * 100),
        draw: Math.round(pD * 100),
        away: Math.round(pA * 100),
      };
    }
    if (homeSummary.form.length === 0 && awaySummary.form.length === 0) return null;
    const pts = (f: FormResult[]) => f.reduce((s, r) => s + (r === "G" ? 3 : r === "E" ? 1 : 0), 0);
    const wH = 1 + pts(homeSummary.form);
    const wA = 1 + pts(awaySummary.form);
    const wD = (wH + wA) * 0.35;
    const total = wH + wA + wD;
    return {
      method: "forma" as const,
      grid: null,
      maxCell: 0,
      home: Math.round((wH / total) * 100),
      draw: Math.round((wD / total) * 100),
      away: Math.round((wA / total) * 100),
    };
  }, [homeSummary, awaySummary]);
  const prob = analysis;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const show = m.status !== "scheduled";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`${m.home.name} contra ${m.away.name}, minuto a minuto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={styles.modalHero}
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(9,13,24,0.8), rgba(9,13,24,0.94)), url("${stadiumPhotoFor(m.home.name, m.utcTime)}")`,
          }}
        >
          <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
          <span className={styles.heroGroup}>{m.roundLabel ?? (m.group ? `Grupo ${m.group}` : "Partido")}</span>
          <div className={styles.heroMatch}>
            <div className={styles.heroSide}>
              <Flag team={{ id: 0, name: m.home.name, flag: m.home.flag, logoUrl: m.home.logoUrl }} size={44} />
              <span className={styles.heroSideName}>{m.home.name}</span>
            </div>
            <div className={styles.heroScore}>
              {show ? (
                <>
                  {m.homeScore ?? 0}
                  <span className={styles.heroDash}>-</span>
                  {m.awayScore ?? 0}
                </>
              ) : (
                <span className={styles.heroVs}>VS</span>
              )}
            </div>
            <div className={styles.heroSide}>
              <Flag team={{ id: 0, name: m.away.name, flag: m.away.flag, logoUrl: m.away.logoUrl }} size={44} />
              <span className={styles.heroSideName}>{m.away.name}</span>
            </div>
          </div>
          {m.status === "live" && (
            <span className={styles.statusLive}>
              <span className={styles.pulseDot} /> {m.liveMinute ?? "EN VIVO"}
            </span>
          )}
        </div>

        <div className={styles.modalBody}>
          {prob && (
            <>
              <h3 className={styles.timelineTitle}>
                {prob.method === "goles" ? "Probabilidad (goles del torneo)" : "Probabilidad según la forma"}
              </h3>
              {homeSummary && awaySummary && homeSummary.played > 0 && awaySummary.played > 0 && (
                <div className={styles.compareBlock}>
                  <CompareRow label="Pts por partido" home={homeSummary.points / homeSummary.played} away={awaySummary.points / awaySummary.played} />
                  <CompareRow label="Goles a favor" home={homeSummary.goalsFor / homeSummary.played} away={awaySummary.goalsFor / awaySummary.played} />
                  <CompareRow label="Goles en contra" home={homeSummary.goalsAgainst / homeSummary.played} away={awaySummary.goalsAgainst / awaySummary.played} invert />
                </div>
              )}
              <div className={styles.probLabels}>
                <span className={styles.probHome}>{m.home.name} {prob.home}%</span>
                <span className={styles.probDraw}>Empate {prob.draw}%</span>
                <span className={styles.probAway}>{m.away.name} {prob.away}%</span>
              </div>
              <div className={styles.probBar} role="img" aria-label={`Probabilidad: ${m.home.name} ${prob.home} por ciento, empate ${prob.draw} por ciento, ${m.away.name} ${prob.away} por ciento`}>
                <span className={styles.probSegHome} style={{ width: `${prob.home}%` }} />
                <span className={styles.probSegDraw} style={{ width: `${prob.draw}%` }} />
                <span className={styles.probSegAway} style={{ width: `${prob.away}%` }} />
              </div>
              {prob.grid && (
                <>
                  <h3 className={styles.timelineTitle}>Resultados exactos más probables</h3>
                  <div className={styles.matrixWrap}>
                    <table className={styles.matrix} aria-label="Probabilidad de cada marcador exacto">
                      <thead>
                        <tr>
                          <th className={styles.matrixCorner} aria-label="local \ visita" />
                          {[0, 1, 2, 3, 4].map((a) => (
                            <th key={a}>{a}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {prob.grid.map((rowVals, h) => (
                          <tr key={h}>
                            <th>{h}</th>
                            {rowVals.map((p, a) => {
                              const zone = h > a ? "home" : h < a ? "away" : "draw";
                              const alpha = prob.maxCell > 0 ? Math.round((p / prob.maxCell) * 55) : 0;
                              return (
                                <td
                                  key={a}
                                  className={styles.matrixCell}
                                  data-zone={zone}
                                  style={{ "--cell-alpha": `${alpha}%` } as CSSProperties}
                                >
                                  {(p * 100).toFixed(1)}%
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className={`caption ${styles.matrixHint}`}>
                      Filas: goles de {m.home.name} · Columnas: goles de {m.away.name}
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {stats && stats.length > 0 && (
            <>
              <h3 className={styles.timelineTitle}>Estadísticas del partido</h3>
              <div className={styles.statList}>
                {stats.map((s) => {
                  const total = s.home + s.away || 1;
                  return (
                    <div key={s.label} className={styles.statRow}>
                      <div className={styles.statNums}>
                        <span className={styles.statHomeNum}>
                          {s.home}
                          {s.unit ?? ""}
                        </span>
                        <span className={styles.statLabel}>{s.label}</span>
                        <span className={styles.statAwayNum}>
                          {s.away}
                          {s.unit ?? ""}
                        </span>
                      </div>
                      <div className={styles.statTrack}>
                        <span className={styles.statFillHome} style={{ width: `${(s.home / total) * 100}%` }} />
                        <span className={styles.statFillAway} style={{ width: `${(s.away / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {(homeSummary?.form.length || awaySummary?.form.length) ? (
            <>
              <h3 className={styles.timelineTitle}>Últimos partidos</h3>
              <div className={styles.formCompare}>
                <FormStrip name={m.home.name} summary={homeSummary} />
                <FormStrip name={m.away.name} summary={awaySummary} />
              </div>
            </>
          ) : null}

          <h3 className={styles.timelineTitle}>Minuto a minuto</h3>
          {failed && <p className={`caption ${styles.comingSoon}`}>El minuto a minuto llega pronto.</p>}
          {!failed && events === null && <p className="muted">Cargando eventos…</p>}
          {events && events.length === 0 && <p className="muted">Sin eventos todavía.</p>}
          {events && events.length > 0 && (
            <ol className={styles.timeline}>
              {events.map((ev, i) => (
                <li key={i} className={`${styles.timelineRow} ${ev.team === "away" ? styles.timelineAway : ""}`}>
                  <span className={styles.timelineMinute}>{ev.minute}</span>
                  <span className={styles.timelineIcon} data-type={ev.type} aria-hidden="true">
                    {ev.type === "goal" ? (
                      <IconBall size={15} />
                    ) : ev.type === "yellow" || ev.type === "red" ? (
                      <span className={ev.type === "yellow" ? styles.cardYellow : styles.cardRed} />
                    ) : (
                      <IconClock size={14} />
                    )}
                  </span>
                  <span className={styles.timelineText}>
                    {ev.player && <strong>{ev.player}</strong>}
                    {ev.player && ev.detail && " · "}
                    {ev.detail}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

// Tabla general por grupo. Intenta /standings del back; si no existe, la
// calcula localmente de los partidos jugados. Con teamStats agrega columnas
// Forma (últimos 5) y Sig. (próximo rival), estilo FotMob.
function StandingsSection({
  competitionId,
  teamStats,
}: {
  competitionId: number;
  teamStats?: Map<string, TeamSummary>;
}) {
  const [groups, setGroups] = useState<StandingsGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ groups: StandingsGroup[] }>(`/standings?competitionId=${competitionId}`)
      .then((d) => alive && setGroups(d.groups))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [competitionId]);

  const local = useMemo(() => (teamStats ? computeStandings(teamStats) : []), [teamStats]);
  const shown = failed || !groups || groups.length === 0 ? local : groups;

  if (shown.length === 0) {
    return failed ? <p className={`caption ${styles.comingSoon}`}>Tabla general llega pronto.</p> : null;
  }

  return (
    <section className={styles.statsSection}>
      <h2 className={styles.statsTitle}>
        <IconTrophy size={17} /> Tabla general
      </h2>
      <div className={styles.standingsStack}>
        {shown.map((g) => (
          <div key={g.group} className={`${styles.card} ${styles.standingsCard}`}>
            <h3 className={styles.standingsGroupTitle}>{g.group === "General" ? "General" : `Grupo ${g.group}`}</h3>
            <div className={styles.tableScroll}>
              <table className={styles.standingsTable}>
                <thead>
                  <tr>
                    <th className={styles.posHead}>#</th>
                    <th className={styles.teamHead}>Equipo</th>
                    <th>PJ</th>
                    <th>G</th>
                    <th>E</th>
                    <th>P</th>
                    <th>DG</th>
                    <th>PTS</th>
                    {teamStats && <th className={styles.formHead}>Forma</th>}
                    {teamStats && <th>Sig.</th>}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => {
                    const extra = teamStats?.get(r.name);
                    const rival = extra?.next
                      ? extra.next.home.name === r.name
                        ? extra.next.away
                        : extra.next.home
                      : null;
                    return (
                      <tr key={r.name} className={i < 2 ? styles.qualifiedRow : ""}>
                        <td className={styles.posCell}>{i + 1}</td>
                        <td className={styles.teamCell}>
                          <Flag team={{ id: r.teamId, name: r.name, flag: r.flag, logoUrl: r.logoUrl }} size={20} />
                          <span>{r.name}</span>
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.drawn}</td>
                        <td>{r.lost}</td>
                        <td>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                        <td className={styles.ptsCell}>{r.points}</td>
                        {teamStats && (
                          <td>
                            <span className={styles.formRow}>
                              {(extra?.form ?? []).map((f, j) => (
                                <span key={j} className={styles.formDot} data-res={f}>
                                  {f}
                                </span>
                              ))}
                            </span>
                          </td>
                        )}
                        {teamStats && (
                          <td className={styles.nextCell}>
                            {rival && (
                              <Flag team={{ id: 0, name: rival.name, flag: rival.flag, logoUrl: rival.logoUrl }} size={18} />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Siguiente jornada agrupada por día, estilo agenda de FotMob.
function NextRoundSection({ matches, onOpen }: { matches: Match[]; onOpen: (m: Match) => void }) {
  const upcoming = useMemo(
    () =>
      matches
        .filter((m) => m.status === "scheduled" && m.utcTime)
        .sort((a, b) => (a.utcTime ?? "").localeCompare(b.utcTime ?? ""))
        .slice(0, 8),
    [matches]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of upcoming) {
      const d = dayLabel(m.utcTime!);
      (map.get(d) ?? map.set(d, []).get(d)!).push(m);
    }
    return map;
  }, [upcoming]);

  if (upcoming.length === 0) return null;

  return (
    <section className={styles.statsSection}>
      <h2 className={styles.statsTitle}>
        <IconClock size={17} /> Siguiente jornada
      </h2>
      <div className={`${styles.card} ${styles.agendaCard}`}>
        {[...byDay.entries()].map(([day, ms]) => (
          <div key={day}>
            <div className={styles.agendaDay}>{day}</div>
            {ms.map((m) => (
              <button key={m.id} className={styles.agendaRow} onClick={() => onOpen(m)}>
                <span className={styles.agendaTeam}>
                  <span className={styles.agendaName}>{m.home.name}</span>
                  <Flag team={{ id: 0, name: m.home.name, flag: m.home.flag, logoUrl: m.home.logoUrl }} size={20} />
                </span>
                <span className={styles.agendaTime}>
                  {new Date(m.utcTime!).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={`${styles.agendaTeam} ${styles.agendaAway}`}>
                  <Flag team={{ id: 0, name: m.away.name, flag: m.away.flag, logoUrl: m.away.logoUrl }} size={20} />
                  <span className={styles.agendaName}>{m.away.name}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// Top goleadores. Igual que standings: si falla el fetch, cae al caption sin romper la página.
function ScorersSection({ competitionId }: { competitionId: number }) {
  const [scorers, setScorers] = useState<ScorerRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ scorers: ScorerRow[] }>(`/scorers?competitionId=${competitionId}&limit=10`)
      .then((d) => alive && setScorers(d.scorers))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [competitionId]);

  if (failed) {
    return <p className={`caption ${styles.comingSoon}`}>Goleadores llegan pronto.</p>;
  }
  if (!scorers || scorers.length === 0) return null;

  return (
    <section className={styles.statsSection}>
      <h2 className={styles.statsTitle}>
        <IconBall size={17} /> Goleadores
      </h2>
      <div className={`${styles.card} ${styles.scorersCard}`}>
        {scorers.map((s, i) => (
          <div key={s.playerId} className={styles.scorerRow}>
            <span className={`${styles.scorerRank} ${i === 0 ? styles.scorerRankTop : ""}`}>{i + 1}</span>
            <PlayerPhoto photoUrl={s.photoUrl} name={s.name} />
            <div className={styles.scorerInfo}>
              <span className={styles.scorerName}>{s.name}</span>
              <div className={styles.scorerTeam}>
                <Flag team={{ id: s.teamId, name: s.teamName, flag: s.teamFlag, logoUrl: s.teamLogo }} size={18} />
                <span>{s.teamName}</span>
              </div>
            </div>
            <div className={styles.scorerStats}>
              <span className={styles.scorerGoals}>{s.goals}</span>
              <span className={styles.scorerAssists}>{s.assists} asist.</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Foto circular del goleador con fallback a inicial cuando photoUrl es null o falla.
function PlayerPhoto({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!photoUrl || failed) {
    return <div className={styles.playerFallback}>{name.charAt(0).toUpperCase()}</div>;
  }
  return (
    <img
      src={photoUrl}
      alt=""
      width={32}
      height={32}
      className={styles.playerPhoto}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

// Fila comparativa local/visita (estilo BeSoccer): el valor mejor se pinta
// del color de su lado; con `invert`, menos es mejor (goles en contra).
function CompareRow({ label, home, away, invert }: { label: string; home: number; away: number; invert?: boolean }) {
  const homeBetter = invert ? home < away : home > away;
  const awayBetter = invert ? away < home : away > home;
  return (
    <div className={styles.compareRow}>
      <span className={`${styles.compareVal} ${homeBetter ? styles.probHome : ""}`}>{home.toFixed(1)}</span>
      <span className={styles.compareLabel}>{label}</span>
      <span className={`${styles.compareVal} ${styles.compareValAway} ${awayBetter ? styles.probAway : ""}`}>
        {away.toFixed(1)}
      </span>
    </div>
  );
}

// Racha de un equipo (estilo BeSoccer): chips de los últimos 5 con la letra
// del resultado — la letra carga el significado, el color solo refuerza.
function FormStrip({ name, summary }: { name: string; summary?: TeamSummary }) {
  return (
    <div className={styles.formStrip}>
      <span className={styles.formStripName}>{name}</span>
      <span className={styles.formRow}>
        {(summary?.form ?? []).map((f, i) => (
          <span key={i} className={styles.formDot} data-res={f}>
            {f}
          </span>
        ))}
        {(summary?.form ?? []).length === 0 && <span className="muted">Sin historial</span>}
      </span>
    </div>
  );
}

// Tarjeta destacada (en vivo o próximo) con marcador grande y centrado tipo ESPN.
// Fondo de estadio real (mismo asset que Historial) con wash oscuro; el marcador
// re-monta con key cuando cambia el score para disparar la animación de pop.
function HeroMatch({ m, upcoming, onOpen }: { m: Match; upcoming?: boolean; onOpen?: () => void }) {
  const homeWin = m.status === "finished" && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWin = m.status === "finished" && (m.awayScore ?? 0) > (m.homeScore ?? 0);
  const isUpcoming = upcoming || m.status === "scheduled";
  return (
    <div
      className={`${styles.heroCard} ${styles.heroStadium} ${m.status === "live" ? styles.heroLive : ""} ${onOpen ? styles.clickable : ""}`}
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(9,13,24,0.82), rgba(9,13,24,0.94)), url("${stadiumPhotoFor(m.home.name, m.utcTime)}")`,
      }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => onOpen && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
    >
      <div className={styles.heroTop}>
        <span className={styles.heroGroup}>{m.roundLabel ?? (m.group ? `Grupo ${m.group}` : "Partido")}</span>
        {m.status === "live" ? (
          <span className={styles.statusLive}>
            <span className={styles.pulseDot} /> {m.liveMinute ?? "EN VIVO"}
          </span>
        ) : (
          <span className={styles.statusScheduled}>
            <IconClock size={12} /> {kickoff(m.utcTime)}
          </span>
        )}
      </div>
      <div className={styles.heroMatch}>
        <div className={`${styles.heroSide} ${awayWin ? styles.dim : ""}`}>
          <Flag team={{ id: 0, name: m.home.name, flag: m.home.flag, logoUrl: m.home.logoUrl }} size={44} />
          <span className={styles.heroSideName}>{m.home.name}</span>
        </div>
        <div className={styles.heroScore} key={`${m.homeScore}-${m.awayScore}`}>
          {isUpcoming ? (
            <span className={styles.heroVs}>VS</span>
          ) : (
            <>
              {m.homeScore ?? 0}
              <span className={styles.heroDash}>-</span>
              {m.awayScore ?? 0}
            </>
          )}
        </div>
        <div className={`${styles.heroSide} ${homeWin ? styles.dim : ""}`}>
          <Flag team={{ id: 0, name: m.away.name, flag: m.away.flag, logoUrl: m.away.logoUrl }} size={44} />
          <span className={styles.heroSideName}>{m.away.name}</span>
        </div>
      </div>
      {isUpcoming && m.utcTime && <Countdown target={m.utcTime} />}
    </div>
  );
}

// Tarjeta de la lista agrupada. Entra con stagger y abre el minuto a minuto al clic.
function MatchCard({ m, index = 0, onOpen }: { m: Match; index?: number; onOpen?: () => void }) {
  const show = m.status !== "scheduled";
  const homeWin = m.status === "finished" && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWin = m.status === "finished" && (m.awayScore ?? 0) > (m.homeScore ?? 0);
  return (
    <div
      className={`${styles.card} ${m.status === "live" ? styles.cardLive : ""} ${styles.cardEnter} ${onOpen ? styles.clickable : ""}`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => onOpen && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
    >
      <div className={styles.statusLine}>
        {m.status === "finished" ? (
          <span className={styles.statusFinished}>Finalizado</span>
        ) : m.status === "live" ? (
          <span className={styles.statusLive}>
            <span className={styles.pulseDot} /> {m.liveMinute ?? "EN VIVO"}
          </span>
        ) : (
          <span className={styles.statusScheduled}>{kickoff(m.utcTime)}</span>
        )}
      </div>
      <MatchRow team={m.home} score={m.homeScore} show={show} dim={awayWin} />
      <MatchRow team={m.away} score={m.awayScore} show={show} dim={homeWin} />
    </div>
  );
}

function MatchRow({
  team,
  score,
  show,
  dim,
}: {
  team: Match["home"];
  score: number | null;
  show: boolean;
  dim: boolean;
}) {
  return (
    <div className={`${styles.matchRow} ${dim ? styles.dim : ""}`}>
      <div className={styles.matchTeam}>
        <Flag team={{ id: 0, name: team.name, flag: team.flag, logoUrl: team.logoUrl }} size={24} />
        <span>{team.name}</span>
      </div>
      <span className={styles.matchScore}>{show && score !== null ? score : "-"}</span>
    </div>
  );
}
