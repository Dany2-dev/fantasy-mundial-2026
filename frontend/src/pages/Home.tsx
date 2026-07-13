import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Flag from "../components/Flag";
import {
  IconArrowRight,
  IconBall,
  IconCalendar,
  IconCards,
  IconClock,
  IconCoin,
  IconExchange,
  IconGamepad,
  IconPack,
  IconTrophy,
  IconUsers,
} from "../components/icons";
import PlayerCard from "../components/PlayerCard";
import PlayerDetailModal from "../components/PlayerDetailModal";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { GameweekInfo, Match, rarityOf, Standing } from "../types";
import styles from "./Home.module.css";

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
  { to: "/sobres", title: "Tienda de sobres", desc: "Abre Bronce, Plata y Oro. Consigue a las estrellas.", Icon: IconPack, accent: "red", photo: "/brand/wc26-red.jpg", big: true },
  { to: "/ligas", title: "Ligas privadas", desc: "Compite con tus amigos.", Icon: IconTrophy, accent: "blue", photo: "/brand/wc26-blue.jpg" },
  { to: "/once", title: "Mi once", desc: "Coloca tus cartas en el césped.", Icon: IconBall, accent: "green", },
  { to: "/coleccion", title: "Mi colección", desc: "Todas tus cartas.", Icon: IconCards, accent: "gold" },
  { to: "/mercado", title: "Mercado", desc: "Compra, vende, negocia.", Icon: IconExchange, accent: "blue" },
  { to: "/partidos", title: "Partidos", desc: "Calendario en vivo de tu competencia.", Icon: IconCalendar, accent: "red" },
  { to: "/rivales", title: "Rivales", desc: "Los mánagers de tu liga.", Icon: IconUsers, accent: "green" },
  { to: "/historial", title: "Historial", desc: "Tus jornadas y tus movimientos.", Icon: IconClock, accent: "gold" },
  { to: "/jugar", title: "Jugar", desc: "Minijuegos para ganar monedas.", Icon: IconGamepad, accent: "blue" },
];

export default function Home() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { leagues, activeLeagueId } = useAppSelector((s) => s.leagues);
  const collection = useAppSelector((s) => s.collection.items);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [gameweek, setGameweek] = useState<GameweekInfo | null>(null);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  const sorted = [...collection].sort((a, b) => b.rating - a.rating);
  const bestCard = sorted[0] ?? null;
  const avgRating = sorted.length ? Math.round(sorted.reduce((s, p) => s + p.rating, 0) / sorted.length) : 0;
  const myRank = standings.findIndex((s) => s.userId === user?.id) + 1;

  useEffect(() => {
    if (!activeLeagueId) return;
    dispatch(fetchCollection(activeLeagueId));
    api<{ standings: Standing[]; league: { currentGameweek: GameweekInfo | null } }>(`/leagues/${activeLeagueId}`)
      .then((d) => {
        setStandings(d.standings);
        setGameweek(d.league.currentGameweek);
      })
      .catch(() => {
        setStandings([]);
        setGameweek(null);
      });
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
        <p className={styles.hMuted}>Aún no estás en ninguna liga. El juego empieza cuando compites con alguien.</p>
        <Link to="/ligas">
          <button className={styles.ctaPrimary}>Crear o unirme a una liga</button>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ===== Hero ===== */}
      <section className={styles.hero}>
        <img src="/brand/wc26-red.jpg" alt="" className={styles.heroArt} aria-hidden="true" />
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
              Bienvenido a tu club. Abre sobres, ficha estrellas y domina la liga con tus amigos.
            </p>

            <div className={styles.heroStats}>
              <span className={styles.chip} data-accent="gold">
                <IconCoin size={16} /> {(user?.coins ?? 0).toLocaleString("es-MX")}
              </span>
              <span className={styles.chip} data-accent="blue">
                <IconCards size={16} /> Media {avgRating || "—"}
              </span>
              <span className={styles.chip} data-accent="green">
                <IconCards size={16} /> {collection.length} cartas
              </span>
              {gameweek && (
                <span className={styles.chip} data-accent="red">
                  <IconTrophy size={16} /> {gameweek.label}
                </span>
              )}
            </div>

            <div className={styles.heroActions}>
              <Link to="/sobres">
                <button className={styles.ctaPrimary}>
                  <IconPack size={18} /> Abrir sobres
                </button>
              </Link>
              <Link to="/once">
                <button className={styles.ctaGhost}>
                  <IconBall size={18} /> Editar mi 11
                </button>
              </Link>
            </div>
          </div>

          {bestCard && (
            <div className={styles.heroAside}>
              <span className={styles.hEyebrow}>Tu mejor carta</span>
              <div className={`${styles.showcaseCardWrap} ${styles[`glow-${rarityOf(bestCard.rating)}`]}`}>
                <PlayerCard player={bestCard} onClick={() => setOpenPlayerId(bestCard.id)} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== Plantilla destacada ===== */}
      {collection.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Tu plantilla destacada</h2>
            <Link to="/coleccion" className={styles.sectionLink}>
              Ver colección <IconArrowRight size={15} />
            </Link>
          </div>
          <div className={styles.showcaseRow}>
            {sorted.slice(0, 8).map((p) => (
              <div key={p.id} className={styles.showcaseMini}>
                <PlayerCard player={p} onClick={() => setOpenPlayerId(p.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== Partido + Liga ===== */}
      <div className={styles.twoCol}>
        <section className={`${styles.card} ${styles.matchCard}`}>
          <img src="/brand/confetti.jpg" alt="" className={styles.cardWatermark} aria-hidden="true" />
          <div className={styles.sectionHead}>
            <h2>Partidos del Mundial</h2>
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
            <p className={styles.hMuted}>Sin partidos programados todavía.</p>
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
            {standings.length === 0 && <li className={styles.hMuted}>Sin datos todavía.</li>}
          </ol>
          {myRank > 0 && (
            <p className={styles.standingsFoot}>
              Vas {myRank}º de {standings.length}
            </p>
          )}
        </section>
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
