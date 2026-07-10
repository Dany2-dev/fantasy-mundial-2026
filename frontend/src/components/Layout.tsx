import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useScrollHidden } from "../hooks/useScrollHidden";
import { logout } from "../store/authSlice";
import { clearLeagues, setActiveLeague } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Trade } from "../types";
import { IconBall, IconCards, IconCoin, IconExchange, IconHome, IconLogOut, IconPack, IconTrophy } from "./icons";
import styles from "./Layout.module.css";
import StickyBanner from "./StickyBanner";

const NAV = [
  { to: "/", label: "Inicio", Icon: IconHome },
  { to: "/sobres", label: "Sobres", Icon: IconPack },
  { to: "/coleccion", label: "Colección", Icon: IconCards },
  { to: "/once", label: "Mi Once", Icon: IconBall },
  { to: "/mercado", label: "Mercado", Icon: IconExchange },
  { to: "/ligas", label: "Ligas", Icon: IconTrophy },
];

export default function Layout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { leagues, activeLeagueId } = useAppSelector((s) => s.leagues);
  const [offer, setOffer] = useState<Trade | null>(null);
  const hidden = useScrollHidden();

  function handleLogout() {
    dispatch(logout());
    dispatch(clearLeagues());
    navigate("/acceso");
  }

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

  return (
    <div className={styles.shell}>
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

            <div className={styles.right}>
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
      </div>

      {/* Móvil: tab bar inferior, se oculta al bajar para liberar pantalla. */}
      <motion.nav
        className={styles.mobileNav}
        aria-label="Navegación principal móvil"
        animate={{ y: hidden ? "100%" : "0%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {NAV.map(({ to, label, Icon }) => (
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
      </motion.nav>
    </div>
  );
}
