import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Flag from "../components/Flag";
import { IconBall, IconClock, IconClose, IconTrophy } from "../components/icons";
import { stadiumPhotoFor } from "../lib/stadiumPhotos";
import { useAppSelector } from "../store/store";
import { Match, MatchEvent, ScorerRow, StandingsGroup } from "../types";
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

// Etiqueta de sección: grupos A-L en el Mundial, jornadas en ligas de clubes,
// y "Eliminatorias" como último recurso.
function groupOf(m: Match): string {
  if (m.group && /^[A-L]$/.test(m.group)) return `Grupo ${m.group}`;
  if (m.roundLabel) return m.roundLabel;
  return "Eliminatorias";
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

  // Lista filtrada y agrupada por grupo/eliminatoria.
  const groups = useMemo(() => {
    const filtered = matches.filter((m) => matchesFilter(m, filter));
    const map = new Map<string, Match[]>();
    for (const m of filtered) {
      const g = groupOf(m);
      (map.get(g) ?? map.set(g, []).get(g)!).push(m);
    }
    const order = [...map.keys()].sort((a, b) =>
      a === "Eliminatorias" ? 1 : b === "Eliminatorias" ? -1 : a.localeCompare(b, "es", { numeric: true })
    );
    for (const g of order) map.get(g)!.sort((a, b) => (a.utcTime ?? "").localeCompare(b.utcTime ?? ""));
    return { map, order };
  }, [matches, filter]);

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

      {groups.order.map((g) => (
        <section key={g} className={styles.groupSection}>
          <h2 className={styles.groupTitle}>{g}</h2>
          <div className={styles.grid}>
            {groups.map.get(g)!.map((m, i) => (
              <MatchCard key={m.id} m={m} index={i} onOpen={() => setOpenMatch(m)} />
            ))}
          </div>
        </section>
      ))}

      {/* ---- Tabla general y goleadores ---- */}
      {competitionId ? (
        <div className={styles.statsGrid}>
          <StandingsSection competitionId={competitionId} />
          <ScorersSection competitionId={competitionId} />
        </div>
      ) : (
        <p className={`caption ${styles.comingSoon}`}>Tabla general y goleadores llegan pronto.</p>
      )}

      {openMatch && <MatchDetailModal m={openMatch} onClose={() => setOpenMatch(null)} />}
    </div>
  );
}

// Modal minuto a minuto: timeline de eventos del partido. Consume
// GET /matches/:id/events (contrato futuro del back); si no existe, cae al
// caption "llega pronto" sin romper nada.
function MatchDetailModal({ m, onClose }: { m: Match; onClose: () => void }) {
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ events: MatchEvent[] }>(`/matches/${m.id}/events`)
      .then((d) => alive && setEvents(d.events))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [m.id]);

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

// Tabla general por grupo. Si el fetch falla, se cae al caption "llegan pronto"
// sin romper el resto de la página.
function StandingsSection({ competitionId }: { competitionId: number }) {
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

  if (failed) {
    return <p className={`caption ${styles.comingSoon}`}>Tabla general llega pronto.</p>;
  }
  if (!groups || groups.length === 0) return null;

  return (
    <section className={styles.statsSection}>
      <h2 className={styles.statsTitle}>
        <IconTrophy size={17} /> Tabla general
      </h2>
      <div className={styles.standingsStack}>
        {groups.map((g) => (
          <div key={g.group} className={`${styles.card} ${styles.standingsCard}`}>
            <h3 className={styles.standingsGroupTitle}>Grupo {g.group}</h3>
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
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => (
                    <tr key={r.teamId} className={i < 2 ? styles.qualifiedRow : ""}>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
