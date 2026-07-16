import { motion } from "motion/react";
import { CSSProperties, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useScrollHidden } from "../hooks/useScrollHidden";
import { competitionTheme, Theme } from "../lib/competitionTheme";
import { logout } from "../store/authSlice";
import { fetchCollection } from "../store/collectionSlice";
import { clearLeagues, setActiveLeague } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { GameweekInfo, Trade } from "../types";
import {
  IconBall,
  IconCalendar,
  IconCards,
  IconClock,
  IconClose,
  IconCoin,
  IconExchange,
  IconGamepad,
  IconHome,
  IconLogOut,
  IconMore,
  IconPack,
  IconTrophy,
  IconUsers,
} from "./icons";
import styles from "./Layout.module.css";
import StickyBanner from "./StickyBanner";

// Los 5 de uso diario van siempre visibles en el tab bar móvil.
const PRIMARY_NAV = [
  { to: "/", label: "Inicio", Icon: IconHome },
  { to: "/sobres", label: "Sobres", Icon: IconPack },
  { to: "/coleccion", label: "Colección", Icon: IconCards },
  { to: "/once", label: "Mi Once", Icon: IconBall },
  { to: "/mercado", label: "Mercado", Icon: IconExchange },
];
// El resto vive detrás de "Más" en móvil; en escritorio el riel ya cabe todo.
const MORE_NAV = [
  { to: "/ligas", label: "Ligas", Icon: IconTrophy },
  { to: "/partidos", label: "Partidos", Icon: IconCalendar },
  { to: "/rivales", label: "Rivales", Icon: IconUsers },
  { to: "/historial", label: "Historial", Icon: IconClock },
  { to: "/jugar", label: "Jugar", Icon: IconGamepad },
];
const NAV = [...PRIMARY_NAV, ...MORE_NAV];

const THEME_CACHE_KEY = "fm26_tema_liga";

export default function Layout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((s) => s.auth.user);
  const { leagues, activeLeagueId, status: leaguesStatus } = useAppSelector((s) => s.leagues);
  const collection = useAppSelector((s) => s.collection.items);
  const [offer, setOffer] = useState<Trade | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [gameweek, setGameweek] = useState<GameweekInfo | null>(null);
  const hidden = useScrollHidden();
  const moreActive = MORE_NAV.some((item) => location.pathname === item.to);
  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  // El tema arranca leyendo el último aplicado (localStorage) en vez del
  // default: `leagues` todavía no llegó de la API en el primer render, así
  // que sin esto se veía un salto de "rojo por defecto" a los colores reales
  // de la liga apenas resolvía el fetch.
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const cached = localStorage.getItem(THEME_CACHE_KEY);
      return cached ? (JSON.parse(cached) as Theme) : competitionTheme(null);
    } catch {
      return competitionTheme(null);
    }
  });

  useEffect(() => {
    if (!activeLeague) {
      // Todavía cargando: no pisar el tema cacheado con el default mientras
      // esperamos la respuesta. Si ya cargó y de verdad no hay liga activa
      // (cuenta nueva), ahí sí volvemos al tema por defecto.
      if (leaguesStatus !== "ready") return;
      setTheme(competitionTheme(null));
      localStorage.removeItem(THEME_CACHE_KEY);
      return;
    }
    const next = competitionTheme(activeLeague.competition?.name);
    setTheme(next);
    try {
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(next));
    } catch {
      // localStorage puede fallar en modo privado; no es crítico, solo se
      // pierde el cache de arranque optimista.
    }
  }, [activeLeague?.competition?.name, leaguesStatus]);
  const avgRating = collection.length
    ? Math.round(collection.reduce((s, p) => s + p.rating, 0) / collection.length)
    : 0;
  const avatarInitial = user?.name?.trim()?.[0]?.toUpperCase() ?? "?";

  function handleLogout() {
    dispatch(logout());
    dispatch(clearLeagues());
    navigate("/acceso");
  }

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!activeLeagueId || !user) {
      setOffer(null);
      return;
    }
    api<{ trades: Trade[] }>(`/trades?leagueId=${activeLeagueId}`)
      .then((d) => {
        const received = d.trades.find((t) => t.toUserId === user.id && t.status === "pending");
        setOffer(received ?? null);
      })
      .catch(() => setOffer(null));
  }, [activeLeagueId, user]);

  // Media del club y jornada actual: viven en el header en vez de en Home,
  // así se ven en cualquier página, no solo al entrar.
  useEffect(() => {
    if (!activeLeagueId) {
      setGameweek(null);
      return;
    }
    dispatch(fetchCollection(activeLeagueId));
    api<{ league: { currentGameweek: GameweekInfo | null } }>(`/leagues/${activeLeagueId}`)
      .then((d) => setGameweek(d.league.currentGameweek))
      .catch(() => setGameweek(null));
  }, [dispatch, activeLeagueId]);

  return (
    <div
      className={styles.shell}
      style={
        {
          "--league-c1": theme.primary,
          "--league-c2": theme.secondary,
          "--league-cta": theme.cta,
          "--league-accent": theme.accent,
        } as CSSProperties
      }
    >
      {/* Escritorio: riel fijo a la izquierda que se expande al pasar el cursor. */}
      <aside className={styles.sidebar} aria-label="Navegación principal">
        <nav className={styles.sidebarNav}>
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.active : ""}`}
            >
              <Icon size={20} aria-hidden="true" className={styles.sidebarIcon} />
              <span className={styles.sidebarLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.sidebarCoins} title="Tus monedas">
            <IconCoin size={20} className={styles.sidebarIcon} />
            <span className={styles.sidebarLabel}>{user?.coins.toLocaleString("es-MX")}</span>
          </span>
          <button className={styles.sidebarItem} onClick={handleLogout}>
            <IconLogOut size={20} aria-hidden="true" className={styles.sidebarIcon} />
            <span className={styles.sidebarLabel}>Salir</span>
          </button>
        </div>
      </aside>

      <div className={styles.content}>
        {offer && (
          <StickyBanner key={offer.id}>
            <span>
              <strong>{offer.fromUser.name}</strong> quiere fichar a tu <strong>{offer.requestedPlayer?.name}</strong>{" "}
              a cambio de {offer.offeredPlayer?.name}
              {offer.coins > 0 ? ` + ${offer.coins.toLocaleString("es-MX")} monedas` : ""}.
            </span>
            <Link to="/mercado">Ver oferta</Link>
          </StickyBanner>
        )}

        <motion.header
          className={styles.header}
          animate={{ y: hidden ? "-100%" : "0%", opacity: hidden ? 0 : 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className={styles.headerInner}>
            <span className={styles.logo}>
              FM<span className={styles.logoYear}>26</span>
            </span>

            {leagues.length > 0 && (
              <select
                className={styles.leagueSelect}
                value={activeLeagueId ?? ""}
                onChange={(e) => dispatch(setActiveLeague(e.target.value))}
                aria-label="Liga activa"
              >
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}

            {activeLeague?.competition?.logoUrl && (
              <img
                src={activeLeague.competition.logoUrl}
                alt={activeLeague.competition.name}
                className={styles.leagueBadge}
              />
            )}

            <div className={styles.right}>
              {gameweek && (
                <span className={styles.headerStat} title="Jornada actual">
                  <IconTrophy size={16} />
                  <span className={styles.headerStatLabel}>{gameweek.label}</span>
                </span>
              )}
              <span className={styles.headerStat} title="Media de tu club">
                <IconCards size={16} />
                <span className={styles.headerStatLabel}>Media {avgRating || "—"}</span>
              </span>
              <span className={styles.avatar} title={user?.name} aria-hidden="true">
                {avatarInitial}
              </span>
              <span className={`${styles.coins} tabular`} title="Tus monedas">
                <IconCoin size={17} />
                {user?.coins.toLocaleString("es-MX")}
              </span>
              <button className={styles.logoutBtn} onClick={handleLogout} title="Cerrar sesión">
                <IconLogOut size={16} />
                <span className={styles.logoutLabel}>Salir</span>
              </button>
            </div>
          </div>
        </motion.header>

        <main className={styles.main}>
          <Outlet />
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <span className={styles.footerLogo}>
              FM<span className={styles.logoYear}>26</span>
            </span>
            <p className={styles.footerText}>
              Proyecto Integrador · Diseño de Interfaces · Datos en vivo cortesía de FotMob.
            </p>
            <p className={styles.footerCredit}>Fantasy Mundial 2026 — hecho por estudiantes, no afiliado a la FIFA.</p>
          </div>
        </footer>
      </div>

      {/* Móvil: hoja con el resto de páginas, se abre desde "Más". */}
      {moreOpen && (
        <div className={styles.moreBackdrop} onClick={() => setMoreOpen(false)}>
          <div className={styles.moreSheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Más páginas">
            <div className={styles.moreHead}>
              <span className={styles.moreTitle}>Más</span>
              <button className={styles.moreClose} onClick={() => setMoreOpen(false)} aria-label="Cerrar">
                <IconClose size={18} />
              </button>
            </div>
            <div className={styles.moreGrid}>
              {MORE_NAV.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} className={styles.moreItem}>
                  <Icon size={22} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Móvil: tab bar inferior, se oculta al bajar para liberar pantalla. */}
      <motion.nav
        className={styles.mobileNav}
        aria-label="Navegación principal móvil"
        animate={{ y: hidden ? "100%" : "0%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {PRIMARY_NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `${styles.mobileItem} ${isActive ? styles.active : ""}`}
          >
            <Icon size={20} aria-hidden="true" />
            <span className={styles.mobileLabel}>{label}</span>
          </NavLink>
        ))}
        <button
          className={`${styles.mobileItem} ${moreActive ? styles.active : ""}`}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <IconMore size={20} aria-hidden="true" />
          <span className={styles.mobileLabel}>Más</span>
        </button>
      </motion.nav>
    </div>
  );
}
