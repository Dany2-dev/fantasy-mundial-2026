import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import FlipReveal from "../components/FlipReveal";
import { IconCheck, IconShield, IconTrophy, IconUsers } from "../components/icons";
import { fetchCollection } from "../store/collectionSlice";
import { createLeague, joinLeague, setActiveLeague } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Competition, League, Player, Standing } from "../types";
import styles from "./Leagues.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leagues() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { leagues, activeLeagueId } = useAppSelector((s) => s.leagues);

  const [newName, setNewName] = useState("");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState<number | "">("");
  const [code, setCode] = useState("");
  const [standings, setStandings] = useState<Standing[]>([]);
  const [leagueDetail, setLeagueDetail] = useState<{ currentGameweek: League["currentGameweek"]; competition: League["competition"] } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [starterPack, setStarterPack] = useState<Player[] | null>(null);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  const selectedCompetition = competitions.find((c) => c.id === competitionId);

  useEffect(() => {
    api<{ competitions: Competition[] }>("/competitions").then((d) => {
      setCompetitions(d.competitions);
      setCompetitionId((prev) => (prev === "" && d.competitions[0] ? d.competitions[0].id : prev));
    });
  }, []);

  useEffect(() => {
    if (activeLeagueId) {
      api<{ standings: Standing[]; league: typeof leagueDetail }>(`/leagues/${activeLeagueId}`)
        .then((d) => {
          setStandings(d.standings);
          setLeagueDetail(d.league);
        })
        .catch(() => {
          setStandings([]);
          setLeagueDetail(null);
        });
    } else {
      setStandings([]);
      setLeagueDetail(null);
    }
  }, [activeLeagueId, leagues.length]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (competitionId === "") {
      setMsg({ kind: "error", text: "Elige una competencia" });
      return;
    }
    const result = await dispatch(createLeague({ name: newName, competitionId }));
    if (createLeague.fulfilled.match(result)) {
      setNewName("");
      setMsg({ kind: "ok", text: `Liga creada. Comparte el código ${result.payload.league.inviteCode}` });
      if (result.payload.starterPack) {
        setStarterPack(result.payload.starterPack);
        dispatch(fetchCollection(result.payload.league.id));
      }
    } else {
      setMsg({ kind: "error", text: result.error.message ?? "No se pudo crear la liga" });
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const result = await dispatch(joinLeague(code));
    if (joinLeague.fulfilled.match(result)) {
      setCode("");
      setMsg({ kind: "ok", text: `Ya estás en ${result.payload.league.name}` });
      if (result.payload.starterPack) {
        setStarterPack(result.payload.starterPack);
        dispatch(fetchCollection(result.payload.league.id));
      }
    } else {
      setMsg({ kind: "error", text: result.error.message ?? "No se pudo unir a la liga" });
    }
  }

  function copyCode() {
    if (!activeLeague) return;
    navigator.clipboard.writeText(activeLeague.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const podium = standings.slice(0, 3);

  return (
    <div className={styles.page}>
      {/* ===== Cabecera ===== */}
      <section className={styles.hero}>
        <img src="/brand/wc26-red.jpg" alt="" className={styles.heroArt} aria-hidden="true" />
        <span className={styles.heroWash} aria-hidden="true" />
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Compite con tus amigos</span>
          <h1 className={styles.title}>Ligas</h1>
          <p className={styles.heroSub}>
            Crea tu liga privada o únete con un código. Cada mánager arranca con un once inicial gratis.
          </p>
        </div>
      </section>

      {/* ===== Formularios ===== */}
      <div className={styles.forms}>
        <form onSubmit={handleCreate} className={styles.formCard}>
          <div className={styles.formHead}>
            <span className={styles.formIcon} data-accent="red" aria-hidden="true">
              <IconTrophy size={22} />
            </span>
            <h3>Crear liga</h3>
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de tu liga"
            minLength={3}
            required
          />
          <select
            value={competitionId}
            onChange={(e) => setCompetitionId(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="" disabled>
              Elige una competencia
            </option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isCurrent ? " (en curso)" : ""}
                {!c.hasStarted ? " — aún no empieza" : ""}
              </option>
            ))}
          </select>
          {selectedCompetition && !selectedCompetition.hasStarted && (
            <p className={styles.notStarted}>
              ⚠️ {selectedCompetition.name} todavía no empieza esta temporada. Podrás jugar (sobres, cambios,
              cláusulas), pero no habrá partidos ni puntos hasta que arranque.
            </p>
          )}
          <button className="primary" type="submit">
            Crear liga
          </button>
        </form>

        <form onSubmit={handleJoin} className={styles.formCard}>
          <div className={styles.formHead}>
            <span className={styles.formIcon} data-accent="blue" aria-hidden="true">
              <IconUsers size={22} />
            </span>
            <h3>Unirme con código</h3>
          </div>
          <p className={styles.formHint}>Pídele el código de 6 letras al mánager que creó la liga.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABX4T9"
            maxLength={6}
            className={styles.codeInput}
            required
          />
          <button className="primary" type="submit">
            Unirme
          </button>
        </form>
      </div>

      {msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>}

      {leagues.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Mis ligas</h2>
          <div className={styles.leagueList}>
            {leagues.map((l) => (
              <button
                key={l.id}
                className={`${styles.leagueItem} ${l.id === activeLeagueId ? styles.leagueActive : ""}`}
                onClick={() => dispatch(setActiveLeague(l.id))}
              >
                <span className={styles.leagueItemTop}>
                  <span className={styles.leagueBadge} aria-hidden="true">
                    <IconShield size={18} />
                  </span>
                  <strong>{l.name}</strong>
                </span>
                <span className="caption">{l.competition?.name ?? "Sin competencia"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeLeague && (
        <section className={styles.section}>
          <div className={styles.standingsHeader}>
            <div>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                Clasificación — {activeLeague.name}
              </h2>
              <div className={styles.leagueMeta}>
                {leagueDetail?.competition && <span className={styles.metaChip}>{leagueDetail.competition.name}</span>}
                {leagueDetail?.currentGameweek && (
                  <span className={styles.metaChip} data-accent="red">
                    {leagueDetail.currentGameweek.label}
                    {leagueDetail.currentGameweek.status === "upcoming" ? " (próxima)" : ""}
                  </span>
                )}
              </div>
            </div>
            <button className={`ghost ${styles.copyBtn}`} onClick={copyCode}>
              {copied ? (
                <>
                  <IconCheck size={15} /> Copiado
                </>
              ) : (
                `Código: ${activeLeague.inviteCode}`
              )}
            </button>
          </div>

          {podium.length > 0 && (
            <div className={styles.podium}>
              {podium.map((s, i) => (
                <div key={s.userId} className={styles.podiumCard} data-rank={i + 1}>
                  <span className={styles.podiumMedal} aria-hidden="true">
                    {MEDALS[i]}
                  </span>
                  <span className={`${styles.podiumName} ${s.userId === user?.id ? styles.podiumMe : ""}`}>
                    {s.name}
                    {s.userId === user?.id ? " (tú)" : ""}
                  </span>
                  <span className={styles.podiumPts}>{s.points.toLocaleString("es-MX")} pts</span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mánager</th>
                  <th className={styles.num}>Puntos</th>
                  <th className={styles.num}>Cartas</th>
                  <th className={styles.num}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.userId} className={s.userId === user?.id ? styles.me : ""}>
                    <td className={`${styles.rankCell} tabular`}>
                      {i === 0 ? <IconTrophy size={17} className={styles.trophyIcon} /> : `${i + 1}`}
                    </td>
                    <td>
                      {s.name}
                      {s.userId === user?.id && <span className={styles.youTag}> (tú)</span>}
                    </td>
                    <td className={`${styles.num} tabular`}>{s.points.toLocaleString("es-MX")}</td>
                    <td className={`${styles.num} tabular`}>{s.cardCount}</td>
                    <td className={`${styles.num} tabular`}>{s.teamValue.toLocaleString("es-MX")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`caption ${styles.foot}`}>
            Valor = suma de medias de tus cartas. Los puntos llegarán con las jornadas del torneo.
          </p>
        </section>
      )}

      {starterPack && (
        <div className={styles.overlay} role="dialog" aria-label="Tu once inicial">
          <h2>Tu once inicial</h2>
          <p className="caption">11 cartas gratis para arrancar — la mejor la elegimos capitán.</p>
          <div className={styles.reveal}>
            {starterPack.map((p, i) => (
              <FlipReveal key={p.id} player={p} delay={300 + i * 220} size="sm" />
            ))}
          </div>
          <button className="primary" onClick={() => setStarterPack(null)}>
            ¡Vamos!
          </button>
        </div>
      )}
    </div>
  );
}
