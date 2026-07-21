import { Player as RemotionPlayer } from "@remotion/player";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Flag from "../components/Flag";
import {
  IconArrowRight,
  IconBall,
  IconCalendar,
  IconCards,
  IconClock,
  IconExchange,
  IconGamepad,
  IconPack,
  IconTrophy,
  IconUsers,
} from "../components/icons";
import PlayerCard, { initials } from "../components/PlayerCard";
import PlayerDetailModal from "../components/PlayerDetailModal";
import { formationRows } from "../lib/formations";
import HighlightReel, {
  HIGHLIGHT_FPS,
  HIGHLIGHT_HEIGHT,
  HIGHLIGHT_WIDTH,
  highlightDuration,
} from "../remotion/HighlightReel";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Match, Player, rarityOf, Standing } from "../types";
import styles from "./Home.module.css";

interface SquadInfo {
  formation: string;
  playerIds: number[];
  captainId: number | null;
}

const SHOWCASE_PAGE_SIZE = 4;

const PITCH_MARKINGS = (
  <span className={styles.pitchMarkings} aria-hidden="true">
    <span className={styles.pitchCenterLine} />
    <span className={styles.pitchCenterCircle} />
    <span className={styles.pitchCenterSpot} />
    <span className={`${styles.pitchPenaltyArea} ${styles.pitchPenaltyAreaLeft}`} />
    <span className={`${styles.pitchPenaltyArea} ${styles.pitchPenaltyAreaRight}`} />
    <span className={`${styles.pitchGoalArea} ${styles.pitchGoalAreaLeft}`} />
    <span className={`${styles.pitchGoalArea} ${styles.pitchGoalAreaRight}`} />
    <span className={`${styles.pitchGoal} ${styles.pitchGoalLeft}`} />
    <span className={`${styles.pitchGoal} ${styles.pitchGoalRight}`} />
    <span className={`${styles.pitchPenaltySpot} ${styles.pitchPenaltySpotLeft}`} />
    <span className={`${styles.pitchPenaltySpot} ${styles.pitchPenaltySpotRight}`} />
  </span>
);

// Agrupa los ids guardados del once por posición real (según la colección)
// y los reparte en las filas de la formación — igual que Squad.tsx, pero de
// solo lectura: aquí no hay que reasignar slots, solo mostrar un preview.
function buildFormationPreview(
  formation: string,
  playerIds: number[],
  byId: Map<number, Player>
): (Player | null)[][] {
  const byPosition = new Map<string, number[]>();
  for (const id of playerIds) {
    const p = byId.get(id);
    if (p) byPosition.set(p.position, [...(byPosition.get(p.position) ?? []), id]);
  }
  return formationRows(formation).map(([pos, count]) => {
    const ids = [...(byPosition.get(pos) ?? [])];
    return Array.from({ length: count }, () => {
      const id = ids.shift();
      return id != null ? byId.get(id) ?? null : null;
    });
  });
}

// Círculo del preview de formación: foto real del jugador con fallback a
// iniciales (igual que PlayerCard) si no hay foto o si la URL falla al cargar.
function MiniPitchDot({ player, captain }: { player: Player | null; captain: boolean }) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  if (!player) {
    return (
      <span className={styles.miniPlayer}>
        <span className={styles.miniDot} title="Slot vacío" />
        <span className={styles.miniPlayerName}>Vacante</span>
      </span>
    );
  }

  const showPhoto = Boolean(player.photoUrl && failedPhotoUrl !== player.photoUrl);
  return (
    <span className={styles.miniPlayer}>
      <span
        className={`${styles.miniDot} ${styles.miniDotFilled} ${captain ? styles.miniDotCaptain : ""}`}
        title={player.name}
      >
        {showPhoto ? (
          <img
            src={player.photoUrl ?? undefined}
            alt=""
            className={styles.miniDotPhoto}
            loading="lazy"
            decoding="async"
            onError={() => player.photoUrl && setFailedPhotoUrl(player.photoUrl)}
          />
        ) : (
          <span className={`${styles.miniDotInitials} ${styles[`miniDotPos${player.position}`]}`}>
            {initials(player.name)}
          </span>
        )}
        {captain && <span className={styles.miniDotCaptainBadge}>C</span>}
        <span className={styles.miniDotRating}>{player.rating}</span>
      </span>
      <span className={styles.miniPlayerName} title={player.name}>
        {player.name}
      </span>
    </span>
  );
}

function pickFeaturedMatch(matches: Match[]): Match | null {
  const timed = matches.filter((m) => m.utcTime);
  const live = timed.find((m) => m.status === "live");
  if (live) return live;
  const upcoming = timed
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => new Date(a.utcTime!).getTime() - new Date(b.utcTime!).getTime())[0];
  if (upcoming) return upcoming;
  const recent = timed
    .filter((m) => m.status === "finished")
    .sort((a, b) => new Date(b.utcTime!).getTime() - new Date(a.utcTime!).getTime())[0];
  return recent ?? null;
}

interface MenuItem {
  to: string;
  title: string;
  desc: string;
  Icon: typeof IconPack;
  accent: "red" | "blue" | "green" | "gold";
  photo?: string;
  big?: boolean;
}

const MENU: MenuItem[] = [
  { to: "/sobres", title: "Tienda de sobres", desc: "Abre un sobre y encuentra a tu próximo titular.", Icon: IconPack, accent: "red", photo: "/stadium/dribble.jpg", big: true },
  { to: "/ligas", title: "Ligas privadas", desc: "Invita al grupo y pelea por la cima.", Icon: IconTrophy, accent: "blue", photo: "/stadium/stadium-benfica.jpg" },
  { to: "/once", title: "Mi once", desc: "Alinea a tus figuras y elige capitán.", Icon: IconBall, accent: "green", photo: "/stadium/match-amateur2.jpg" },
  { to: "/coleccion", title: "Mi colección", desc: "Revisa tus fichajes y encuentra figuras.", Icon: IconCards, accent: "gold", photo: "/stadium/stadium-seats.jpg" },
  { to: "/mercado", title: "Mercado", desc: "Ficha, vende y negocia antes que nadie.", Icon: IconExchange, accent: "blue", photo: "/stadium/match-amateur1.jpg" },
  { to: "/partidos", title: "Partidos", desc: "Sigue horarios, resultados y lo que viene.", Icon: IconCalendar, accent: "red", photo: "/stadium/stadium-sansiro.jpg" },
  { to: "/rivales", title: "Rivales", desc: "Estudia sus figuras y prepara el golpe.", Icon: IconUsers, accent: "green", photo: "/stadium/stadium-akron.jpg" },
  { to: "/historial", title: "Historial", desc: "Revive tus puntos y los tratos cerrados.", Icon: IconClock, accent: "gold", photo: "/stadium/stadium-night.jpg" },
  { to: "/jugar", title: "Jugar", desc: "Supera retos y gana monedas para fichar.", Icon: IconGamepad, accent: "blue", photo: "/stadium/dribble.jpg" },
];

export default function Home() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { leagues, activeLeagueId } = useAppSelector((s) => s.leagues);
  const collection = useAppSelector((s) => s.collection.items);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [squad, setSquad] = useState<SquadInfo | null>(null);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  // Ordena toda la colección (puede ser larga) solo cuando cambia, no en
  // cada render — por ejemplo, al abrir el modal de detalle de un jugador.
  const sorted = useMemo(() => [...collection].sort((a, b) => b.rating - a.rating), [collection]);
  const bestCard = sorted[0] ?? null;
  const myRank = standings.findIndex((s) => s.userId === user?.id) + 1;
  const byId = useMemo(() => new Map(collection.map((p) => [p.id, p])), [collection]);

  // Solo tus mejores cartas: sin segunda página con jugadores de menor rating.
  const showcasePlayers = sorted.slice(0, SHOWCASE_PAGE_SIZE);

  useEffect(() => {
    if (!activeLeagueId) return;
    dispatch(fetchCollection(activeLeagueId));
    api<{ standings: Standing[] }>(`/leagues/${activeLeagueId}`)
      .then((d) => setStandings(d.standings))
      .catch(() => setStandings([]));
    api<{ squad: SquadInfo }>(`/squad?leagueId=${activeLeagueId}`)
      .then((d) => setSquad(d.squad))
      .catch(() => setSquad(null));
  }, [dispatch, activeLeagueId]);

  useEffect(() => {
    if (!activeLeague?.competitionId) return;
    api<{ matches: Match[] }>(`/matches?competitionId=${activeLeague.competitionId}`)
      .then((d) => setMatch(pickFeaturedMatch(d.matches)))
      .catch(() => setMatch(null));
  }, [activeLeague?.competitionId]);

  if (!activeLeague) {
    return (
      <div className={`${styles.page} ${styles.emptyState}`}>
        <span className={styles.emptyBadge} aria-hidden="true">
          <IconTrophy size={30} />
        </span>
        <h1>Hola, {user?.name}</h1>
        <p className={styles.hMuted}>Todavía no tienes liga. Crea una o únete a la de tus amigos para empezar a jugar.</p>
        <Link to="/ligas">
          <button className={styles.ctaPrimary}>Entrar a una liga</button>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ===== Hero ===== */}
      <section className={styles.hero}>
        <img src="/stadium/stadium-night.jpg" alt="" className={styles.heroArt} aria-hidden="true" />
        <span className={styles.heroWash} aria-hidden="true" />

        <div className={styles.heroGrid}>
          <div>
            <span className={styles.chip} data-accent="red">
              {activeLeague.competition?.name ?? "Tu liga"}
            </span>
            <h1 className={styles.heroTitle}>
              Hola, <span className={styles.heroName}>{user?.name}</span>
            </h1>
            <p className={styles.heroSub}>
              Este es tu club: abre sobres, ficha figuras y demuestra quién manda entre tus amigos.
            </p>

            <div className={styles.heroActions}>
              <Link to="/sobres">
                <button className={styles.ctaPrimary}>
                  <IconPack size={18} /> Abrir sobres
                </button>
              </Link>
              <Link to="/once">
                <button className={styles.ctaGhost}>
                  <IconBall size={18} /> Armar mi once
                </button>
              </Link>
            </div>
          </div>

          {bestCard && (
            <div className={styles.heroAside}>
              <span className={styles.hEyebrow}>Tu figura</span>
              <div className={`${styles.showcaseCardWrap} ${styles[`glow-${rarityOf(bestCard.rating)}`]}`}>
                <PlayerCard player={bestCard} onClick={() => setOpenPlayerId(bestCard.id)} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== Plantilla destacada: carrusel con autoplay + video de la colección ===== */}
      {showcasePlayers.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Las figuras de tu club</h2>
            <Link to="/coleccion" className={styles.sectionLink}>
              Ver colección <IconArrowRight size={15} />
            </Link>
          </div>

          <div className={styles.showcaseSplit}>
            <div className={styles.carousel}>
              <div className={styles.carouselTrack}>
                {showcasePlayers.map((p) => (
                  <div key={p.id} className={styles.showcaseMini}>
                    <PlayerCard player={p} onClick={() => setOpenPlayerId(p.id)} />
                  </div>
                ))}
              </div>
            </div>

            {sorted.length > 0 && (
              <div className={styles.highlightCol}>
                <div className={styles.highlightWrap}>
                  <RemotionPlayer
                    component={HighlightReel}
                    inputProps={{ players: sorted }}
                    durationInFrames={highlightDuration(sorted.length)}
                    fps={HIGHLIGHT_FPS}
                    compositionWidth={HIGHLIGHT_WIDTH}
                    compositionHeight={HIGHLIGHT_HEIGHT}
                    style={{ width: "100%" }}
                    controls={false}
                    clickToPlay={false}
                    initiallyMuted
                    loop
                    autoPlay
                  />
                </div>
                <p className={styles.highlightCaption}>
                  Tu Coleccion.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== Partido + Liga ===== */}
      <div className={styles.twoCol}>
        <section className={`${styles.card} ${styles.matchCard}`}>
          <img src="/brand/confetti.jpg" alt="" className={styles.cardWatermark} aria-hidden="true" />
          <div className={styles.sectionHead}>
            <h2>Partido destacado</h2>
            {match?.status === "live" && <span className={styles.liveBadge}>EN VIVO</span>}
          </div>
          {match ? (
            <div className={styles.matchRow}>
              <div className={styles.matchTeam}>
                <Flag team={{ id: 0, name: match.home.name, flag: match.home.flag, logoUrl: match.home.logoUrl }} size={36} />
                <span>{match.home.name}</span>
              </div>
              <div className={styles.matchScore}>
                {match.status === "scheduled" ? (
                  <span className={styles.matchTime}>
                    {new Date(match.utcTime!).toLocaleString("es-MX", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : (
                  <span className={styles.matchScoreNums}>
                    {match.homeScore} – {match.awayScore}
                  </span>
                )}
              </div>
              <div className={`${styles.matchTeam} ${styles.matchTeamRight}`}>
                <span>{match.away.name}</span>
                <Flag team={{ id: 0, name: match.away.name, flag: match.away.flag, logoUrl: match.away.logoUrl }} size={36} />
              </div>
            </div>
          ) : (
            <p className={styles.hMuted}>Todavía no hay partido en cartelera. Cuando haya fecha, aparecerá aquí.</p>
          )}
        </section>

        <section className={`${styles.card} ${styles.standingsCard}`}>
          <div className={styles.sectionHead}>
            <h2>Tu liga</h2>
            <Link to="/ligas" className={styles.sectionLink}>
              Ver ligas <IconArrowRight size={15} />
            </Link>
          </div>
          <ol className={styles.standingsList}>
            {standings.slice(0, 3).map((s, i) => (
              <li key={s.userId} className={s.userId === user?.id ? styles.me : ""}>
                <span className={styles.standingsRank}>{i + 1}</span>
                <span className={styles.standingsName}>{s.name}</span>
                <span className={styles.standingsPoints}>{s.points.toLocaleString("es-MX")} pts</span>
              </li>
            ))}
            {standings.length === 0 && <li className={styles.hMuted}>Todavía no hay resultados en tu liga.</li>}
          </ol>
          {myRank > 0 && (
            <p className={styles.standingsFoot}>
              Vas {myRank}º de {standings.length}
            </p>
          )}
        </section>

        {squad && squad.playerIds.length > 0 && (
          <section className={`${styles.card} ${styles.formationCard}`}>
            <div className={styles.sectionHead}>
              <h2>Tu once</h2>
              <Link to="/once" className={styles.sectionLink}>
                Editar once <IconArrowRight size={15} />
              </Link>
            </div>
            <div className={styles.miniPitch}>
              {PITCH_MARKINGS}
              {buildFormationPreview(squad.formation, squad.playerIds, byId)
                .map((row, ri) => (
                  <div key={ri} className={styles.miniRow}>
                    {row.map((player, i) => (
                      <MiniPitchDot key={i} player={player} captain={Boolean(player && squad.captainId === player.id)} />
                    ))}
                  </div>
                ))}
            </div>
            <p className={styles.formationCaption}>
              Formación {squad.formation} · {squad.playerIds.length}/11 confirmados
            </p>
          </section>
        )}
      </div>

      {/* ===== Menú del club ===== */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tu club</h2>
        <div className={styles.menuGrid}>
          {MENU.map(({ to, title, desc, Icon, accent, photo, big }) => (
            <Link key={to} to={to} className={`${styles.menuTile} ${big ? styles.menuTileBig : ""}`} data-accent={accent}>
              {photo && (
                <>
                  <img src={photo} alt="" className={styles.menuPhoto} aria-hidden="true" />
                  <span className={styles.menuPhotoWash} aria-hidden="true" />
                </>
              )}
              <span className={styles.menuIcon}>
                <Icon size={24} />
              </span>
              <strong className={styles.menuTitle}>{title}</strong>
              <span className={styles.menuDesc}>{desc}</span>
              <IconArrowRight size={16} className={styles.menuArrow} />
            </Link>
          ))}
        </div>
      </section>

      {openPlayerId != null && activeLeague && (
        <PlayerDetailModal
          playerId={openPlayerId}
          leagueId={activeLeague.id}
          onClose={() => setOpenPlayerId(null)}
          onChanged={() => dispatch(fetchCollection(activeLeague.id))}
        />
      )}
    </div>
  );
}
