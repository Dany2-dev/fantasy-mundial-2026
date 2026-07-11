import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Flag from "../components/Flag";
import { useAppSelector } from "../store/store";
import { Match } from "../types";
import styles from "./Matches.module.css";

function groupOf(m: Match): string {
  return m.group && /^[A-L]$/.test(m.group) ? m.group : "Eliminatorias";
}

// Juan trabaja el diseño de esta página. Los partidos jugados/en vivo/próximos
// ya vienen de datos reales de FotMob (GET /matches); tabla general y
// goleadores se conectan después.
export default function Matches() {
  const activeLeague = useAppSelector((s) => s.leagues.leagues.find((l) => l.id === s.leagues.activeLeagueId));
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLeague?.competitionId) return;
    setLoading(true);
    api<{ matches: Match[] }>(`/matches?competitionId=${activeLeague.competitionId}`)
      .then((d) => setMatches(d.matches))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [activeLeague?.competitionId]);

  if (!activeLeague) {
    return (
      <div className={styles.empty}>
        <h1>Partidos</h1>
        <p className="muted">Los partidos se ven dentro de una liga (dependen de su competencia).</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  const live = matches.filter((m) => m.status === "live");
  const finished = matches.filter((m) => m.status === "finished").length;

  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const g = groupOf(m);
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(m);
  }
  const order = [...groups.keys()].sort((a, b) =>
    a === "Eliminatorias" ? 1 : b === "Eliminatorias" ? -1 : a.localeCompare(b)
  );
  for (const g of order) {
    groups.get(g)!.sort((a, b) => (a.utcTime ?? "").localeCompare(b.utcTime ?? ""));
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

      {loading && <p className="muted">Cargando…</p>}
      {!loading && matches.length === 0 && <p className="muted">Sin calendario todavía para esta competencia.</p>}

      {order.map((g) => (
        <section key={g} className={styles.groupSection}>
          <h2 className={styles.groupTitle}>{g === "Eliminatorias" ? g : `Grupo ${g}`}</h2>
          <div className={styles.grid}>
            {groups.get(g)!.map((m) => (
              <div key={m.id} className={`${styles.card} ${m.status === "live" ? styles.cardLive : ""}`}>
                <div className={styles.statusLine}>
                  {m.status === "finished" ? (
                    <span className={styles.statusFinished}>Finalizado</span>
                  ) : m.status === "live" ? (
                    <span className={styles.statusLive}>
                      <span className={styles.pulseDot} /> EN VIVO
                    </span>
                  ) : (
                    <span className={styles.statusScheduled}>
                      {m.utcTime
                        ? new Date(m.utcTime).toLocaleString("es-MX", {
                            weekday: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Por definir"}
                    </span>
                  )}
                </div>
                <MatchRow team={m.home} score={m.homeScore} show={m.status !== "scheduled"} />
                <MatchRow team={m.away} score={m.awayScore} show={m.status !== "scheduled"} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className={`caption ${styles.comingSoon}`}>Tabla general y goleadores llegan pronto.</p>
    </div>
  );
}

function MatchRow({
  team,
  score,
  show,
}: {
  team: Match["home"];
  score: number | null;
  show: boolean;
}) {
  return (
    <div className={styles.matchRow}>
      <div className={styles.matchTeam}>
        <Flag team={{ id: 0, name: team.name, flag: team.flag, logoUrl: team.logoUrl }} size={24} />
        <span>{team.name}</span>
      </div>
      <span className={styles.matchScore}>{show && score !== null ? score : "-"}</span>
    </div>
  );
}
