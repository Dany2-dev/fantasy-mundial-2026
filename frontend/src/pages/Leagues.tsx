import { AnimatePresence, motion } from "motion/react";
import { FormEvent, MouseEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import FlipReveal from "../components/FlipReveal";
import { IconCheck, IconClose, IconShield, IconTrophy, IconUsers } from "../components/icons";
import { formatMoney } from "../lib/money";
import { fetchCollection } from "../store/collectionSlice";
import { createLeague, deleteLeague, joinLeague, renameLeague, setActiveLeague } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Competition, League, Player, Standing, WeeklyChallenge, WeeklyChallengeOption } from "../types";
import styles from "./Leagues.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];
// Debe coincidir con CUSTOM_CHALLENGE_ID del backend (lib/weeklyChallenges.ts).
const CUSTOM_CHALLENGE_ID = "custom";

// Foco radial que sigue al cursor sobre la tarjeta del podio (técnica de
// ChromaGrid). Se escribe la posición en variables CSS y el degradado vive en
// el CSS, así no re-renderiza React ni hace falta gsap.
function trackPointer(e: MouseEvent<HTMLDivElement>) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
  card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
}

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
  const [loser, setLoser] = useState<Standing | null>(null);
  const [weeklyChallenge, setWeeklyChallenge] = useState<WeeklyChallenge | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [starterPack, setStarterPack] = useState<Player[] | null>(null);

  // Panel de administración (solo lo ve el dueño de la liga).
  const [challengeCatalog, setChallengeCatalog] = useState<WeeklyChallengeOption[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState("");
  const [customChallengeText, setCustomChallengeText] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [kickConfirmId, setKickConfirmId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  const selectedCompetition = competitions.find((c) => c.id === competitionId);
  const isOwner = !!activeLeague && !!user && activeLeague.ownerId === user.id;

  useEffect(() => {
    api<{ competitions: Competition[] }>("/competitions").then((d) => {
      setCompetitions(d.competitions);
      setCompetitionId((prev) => (prev === "" && d.competitions[0] ? d.competitions[0].id : prev));
    });
  }, []);

  // Se reutiliza tras crear/unirse (efecto de abajo) y tras cualquier acción
  // de administración (expulsar, asignar reto…), para no repetir el fetch.
  const refreshLeagueDetail = useCallback((leagueId: string) => {
    return api<{
      standings: Standing[];
      league: { currentGameweek: League["currentGameweek"]; competition: League["competition"] };
      loser: Standing | null;
      weeklyChallenge: WeeklyChallenge | null;
    }>(`/leagues/${leagueId}`)
      .then((d) => {
        setStandings(d.standings);
        setLeagueDetail(d.league);
        setLoser(d.loser);
        setWeeklyChallenge(d.weeklyChallenge);
      })
      .catch(() => {
        setStandings([]);
        setLeagueDetail(null);
        setLoser(null);
        setWeeklyChallenge(null);
      });
  }, []);

  useEffect(() => {
    if (activeLeagueId) refreshLeagueDetail(activeLeagueId);
    else {
      setStandings([]);
      setLeagueDetail(null);
      setLoser(null);
      setWeeklyChallenge(null);
    }
    // Se cierran los paneles de administración al cambiar de liga.
    setRenaming(false);
    setKickConfirmId(null);
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
  }, [activeLeagueId, leagues.length, refreshLeagueDetail]);

  // El catálogo de retos solo lo necesita el dueño; se pide una vez que se
  // sabe que lo es, no en cada render.
  useEffect(() => {
    if (isOwner && challengeCatalog.length === 0) {
      api<{ challenges: WeeklyChallengeOption[] }>("/leagues/challenges/catalog").then((d) => {
        setChallengeCatalog(d.challenges);
        setSelectedChallengeId((prev) => prev || d.challenges[0]?.id || "");
      });
    }
  }, [isOwner, challengeCatalog.length]);

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
      setMsg({ kind: "ok", text: `¡Liga creada! Comparte el código ${result.payload.league.inviteCode} y que empiece la competencia.` });
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
      setMsg({ kind: "ok", text: `¡Ya estás dentro de ${result.payload.league.name}! Es hora de armar tu club.` });
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

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!activeLeague) return;
    setMsg(null);
    const result = await dispatch(renameLeague({ leagueId: activeLeague.id, name: renameValue }));
    if (renameLeague.fulfilled.match(result)) {
      setRenaming(false);
      setMsg({ kind: "ok", text: "Nombre de la liga actualizado." });
    } else {
      setMsg({ kind: "error", text: result.error.message ?? "No se pudo renombrar la liga" });
    }
  }

  async function handleKick(targetUserId: string) {
    if (!activeLeague) return;
    setAdminBusy(true);
    setMsg(null);
    try {
      await api(`/leagues/${activeLeague.id}/members/${targetUserId}`, { method: "DELETE" });
      setKickConfirmId(null);
      await refreshLeagueDetail(activeLeague.id);
      setMsg({ kind: "ok", text: "Mánager expulsado de la liga." });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "No se pudo expulsar al mánager" });
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleDeleteLeague() {
    if (!activeLeague) return;
    setAdminBusy(true);
    setMsg(null);
    const result = await dispatch(deleteLeague(activeLeague.id));
    setAdminBusy(false);
    if (deleteLeague.fulfilled.match(result)) {
      setDeleteConfirmOpen(false);
      setDeleteConfirmText("");
    } else {
      setMsg({ kind: "error", text: result.error.message ?? "No se pudo eliminar la liga" });
    }
  }

  async function handleSetChallenge(e: FormEvent) {
    e.preventDefault();
    if (!activeLeague || !selectedChallengeId) return;
    const isCustom = selectedChallengeId === CUSTOM_CHALLENGE_ID;
    if (isCustom && customChallengeText.trim().length < 3) {
      setMsg({ kind: "error", text: "Escribe el reto (al menos 3 caracteres)" });
      return;
    }
    setAdminBusy(true);
    setMsg(null);
    try {
      await api(`/leagues/${activeLeague.id}/challenge`, {
        method: "POST",
        body: JSON.stringify(
          isCustom ? { challengeId: CUSTOM_CHALLENGE_ID, text: customChallengeText.trim() } : { challengeId: selectedChallengeId }
        ),
      });
      await refreshLeagueDetail(activeLeague.id);
      setMsg({ kind: "ok", text: "Reto de la semana asignado." });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "No se pudo asignar el reto" });
    } finally {
      setAdminBusy(false);
    }
  }

  const podium = standings.slice(0, 3);

  // Mismo bloque de formularios en dos posibles posiciones (arriba si no
  // tienes ligas, hasta abajo si ya tienes): se define una vez para no
  // duplicar el JSX.
  const formsSection = (
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
          Crear mi liga
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
          Entrar a la liga
        </button>
      </form>
    </div>
  );

  const msgBanner = msg && <p className={msg.kind === "ok" ? "ok-text" : "error-text"}>{msg.text}</p>;

  return (
    <div className={styles.page}>
      {/* ===== Cabecera ===== */}
      <section className={styles.hero}>
        <img src="/brand/stripes.jpg" alt="" className={styles.heroArt} aria-hidden="true" />
        <span className={styles.heroWash} aria-hidden="true" />
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Compite con tus amigos</span>
          <h1 className={styles.title}>Ligas</h1>
          <p className={styles.heroSub}>
            Arma tu liga, invita al grupo y demuestra quién manda. Todos empiezan con 11 cartas gratis.
          </p>
        </div>
      </section>

      {/* ===== Formularios =====
          Si ya tienes ligas, crear/unirse deja de ser la acción principal:
          se mandan hasta abajo, después de la clasificación. Sin ligas
          todavía, se quedan aquí arriba porque son lo primero que hay que
          hacer. */}
      {leagues.length === 0 && (
        <>
          {formsSection}
          {msgBanner}
        </>
      )}

      {leagues.length === 0 && (
        <section className={styles.noLeagues}>
          <span className={styles.noLeaguesBadge} aria-hidden="true">
            <IconShield size={26} />
          </span>
          <div>
            <strong className={styles.noLeaguesTitle}>Todavía no estás en ninguna liga</strong>
            <p className={styles.noLeaguesText}>
              Crea la tuya aquí arriba y comparte el código con tus amigos, o únete a una con el código que te
              pasen. En cuanto entres te regalamos 11 cartas.
            </p>
          </div>
        </section>
      )}

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
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="copied"
                    className={styles.copyBtnInner}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <IconCheck size={15} /> Copiado
                  </motion.span>
                ) : (
                  <motion.span
                    key="code"
                    className={styles.copyBtnInner}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    Código: {activeLeague.inviteCode}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* El reto de la semana lo ve toda la liga, no solo el dueño — el
              chiste es que el último lugar sepa que le tocó. */}
          {weeklyChallenge && loser && (
            <div className={styles.challengeCallout}>
              <span className={styles.challengeEmoji} aria-hidden="true">
                🎯
              </span>
              <p>
                <strong>Reto de {weeklyChallenge.gameweekLabel ?? "la semana"}:</strong> {weeklyChallenge.text}
                <br />
                <span className={styles.challengeLoser}>
                  Le toca a {loser.name}
                  {loser.userId === user?.id ? " (tú 😬)" : ""} — va último con {loser.points.toLocaleString("es-MX")}{" "}
                  pts.
                </span>
              </p>
            </div>
          )}

          {/* Podio real: 2º a la izquierda, 1º al centro (más alto), 3º a la derecha.
              Con menos de 3 mánagers no hay podio que enseñar, basta la tabla. */}
          {podium.length === 3 && (
            <div className={styles.podium}>
              {podium.map((s, i) => (
                <motion.div
                  key={s.userId}
                  className={styles.podiumSlot}
                  data-rank={i + 1}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.12 * (3 - i) }}
                >
                  <div className={styles.podiumCard} onMouseMove={trackPointer}>
                    <span className={styles.podiumSheen} aria-hidden="true" />
                    <span className={styles.podiumMedal} aria-hidden="true">
                      {MEDALS[i]}
                    </span>
                    <span className={`${styles.podiumName} ${s.userId === user?.id ? styles.podiumMe : ""}`}>
                      {s.name}
                      {s.userId === user?.id ? " (tú)" : ""}
                    </span>
                    <span className={styles.podiumPts}>{s.points.toLocaleString("es-MX")} pts</span>
                  </div>
                  <div className={styles.podiumStep} aria-hidden="true">
                    {i + 1}
                  </div>
                </motion.div>
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
                  <th className={styles.num}>Patrimonio</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <motion.tr
                    key={s.userId}
                    className={s.userId === user?.id ? styles.me : ""}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.4) }}
                  >
                    <td className={`${styles.rankCell} tabular`} data-label="Puesto">
                      {i === 0 ? <IconTrophy size={17} className={styles.trophyIcon} /> : `${i + 1}`}
                    </td>
                    <td data-label="Mánager">
                      {s.name}
                      {s.userId === user?.id && <span className={styles.youTag}> (tú)</span>}
                    </td>
                    <td className={`${styles.num} tabular`} data-label="Puntos">
                      {s.points.toLocaleString("es-MX")}
                    </td>
                    <td className={`${styles.num} tabular`} data-label="Cartas">
                      {s.cardCount}
                    </td>
                    <td className={`${styles.num} tabular`} data-label="Valor">
                      {formatMoney(s.teamValue)}
                    </td>
                    <td className={`${styles.num} tabular`} data-label="Patrimonio">
                      {formatMoney(s.netWorth)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`caption ${styles.foot}`}>
            Valor = valor de mercado de tu plantilla. Patrimonio suma además lo que te queda en caja. Los puntos llegarán
            con las jornadas del torneo.
          </p>
        </section>
      )}

      {/* ===== Administración de la liga: solo la ve el dueño ===== */}
      {isOwner && activeLeague && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Administrar liga</h2>
          <div className={styles.adminGrid}>
            {/* Nombre de la liga */}
            <div className={styles.formCard}>
              <h3>Nombre de la liga</h3>
              {renaming ? (
                <form onSubmit={handleRename} className={styles.adminInlineForm}>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    minLength={3}
                    required
                    autoFocus
                  />
                  <button className="primary" type="submit" disabled={adminBusy}>
                    Guardar
                  </button>
                  <button type="button" className="ghost" onClick={() => setRenaming(false)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <div className={styles.adminInlineForm}>
                  <p className={styles.adminCurrentValue}>{activeLeague.name}</p>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setRenameValue(activeLeague.name);
                      setRenaming(true);
                    }}
                  >
                    Cambiar nombre
                  </button>
                </div>
              )}
            </div>

            {/* Reto de la semana */}
            <div className={styles.formCard}>
              <h3>Reto de la semana</h3>
              <p className={styles.formHint}>
                Elige el castigo para el que vaya último en {leagueDetail?.currentGameweek?.label ?? "la jornada actual"}.
              </p>
              <form onSubmit={handleSetChallenge} className={styles.adminInlineForm}>
                <select value={selectedChallengeId} onChange={(e) => setSelectedChallengeId(e.target.value)}>
                  <option value={CUSTOM_CHALLENGE_ID}>✏️ Escribir mi propio reto…</option>
                  {challengeCatalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.text}
                    </option>
                  ))}
                </select>
                {selectedChallengeId === CUSTOM_CHALLENGE_ID && (
                  <input
                    value={customChallengeText}
                    onChange={(e) => setCustomChallengeText(e.target.value)}
                    placeholder="Ej. cambiar el nombre del equipo por 'Soy el peor'"
                    minLength={3}
                    maxLength={200}
                    required
                    autoFocus
                  />
                )}
                <button className="primary" type="submit" disabled={adminBusy || !selectedChallengeId}>
                  Asignar reto
                </button>
              </form>
            </div>

            {/* Miembros */}
            <div className={styles.formCard}>
              <h3>Mánagers ({standings.length})</h3>
              <ul className={styles.memberList}>
                {standings.map((s) => (
                  <li key={s.userId} className={styles.memberRow}>
                    <span>
                      {s.name}
                      {s.userId === activeLeague.ownerId && <span className={styles.ownerTag}> · dueño</span>}
                    </span>
                    {s.userId !== activeLeague.ownerId &&
                      (kickConfirmId === s.userId ? (
                        <span className={styles.confirmInline}>
                          <span className="caption">¿Seguro?</span>
                          <button type="button" className="danger" disabled={adminBusy} onClick={() => handleKick(s.userId)}>
                            Sí, expulsar
                          </button>
                          <button type="button" className="ghost" onClick={() => setKickConfirmId(null)}>
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`ghost ${styles.kickBtn}`}
                          onClick={() => setKickConfirmId(s.userId)}
                        >
                          <IconClose size={14} /> Expulsar
                        </button>
                      ))}
                  </li>
                ))}
              </ul>
            </div>

            {/* Zona de peligro */}
            <div className={`${styles.formCard} ${styles.dangerZone}`}>
              <h3>Eliminar liga</h3>
              <p className={styles.formHint}>
                Borra la liga para todos los mánagers: cartas, historial y clasificación se pierden para siempre.
              </p>
              {deleteConfirmOpen ? (
                <div className={styles.adminInlineForm}>
                  <input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={activeLeague.name}
                  />
                  <button
                    type="button"
                    className="danger"
                    disabled={adminBusy || deleteConfirmText.trim() !== activeLeague.name}
                    onClick={handleDeleteLeague}
                  >
                    Eliminar para siempre
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setDeleteConfirmText("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" className="danger" onClick={() => setDeleteConfirmOpen(true)}>
                  Eliminar liga
                </button>
              )}
              {deleteConfirmOpen && (
                <p className={styles.formHint}>
                  Escribe <strong>{activeLeague.name}</strong> para confirmar.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {leagues.length > 0 && msgBanner}

      {/* Ya con ligas, crear una nueva o unirte a otra pasa a un segundo
          plano: se ofrece hasta abajo, después de ver tu clasificación. */}
      {leagues.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>¿Otra liga?</h2>
          {formsSection}
        </section>
      )}

      {starterPack && (
        <div className={styles.overlay} role="dialog" aria-label="Tu once inicial">
          <h2>Tu once inicial</h2>
          <p className="caption">Tus 11 primeras cartas ya están aquí, listas para armar tu club.</p>
          <div className={styles.reveal}>
            {starterPack.map((p, i) => (
              <FlipReveal key={p.id} player={p} delay={300 + i * 220} size="sm" />
            ))}
          </div>
          <button className="primary" onClick={() => setStarterPack(null)}>
            ¡A jugar!
          </button>
        </div>
      )}
    </div>
  );
}
