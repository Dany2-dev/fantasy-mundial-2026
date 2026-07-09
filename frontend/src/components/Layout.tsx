import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../store/authSlice";
import { clearLeagues, setActiveLeague } from "../store/leagueSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import styles from "./Layout.module.css";

const NAV = [
  { to: "/", label: "Inicio", icon: "🏠" },
  { to: "/sobres", label: "Sobres", icon: "🎁" },
  { to: "/coleccion", label: "Colección", icon: "🃏" },
  { to: "/once", label: "Mi Once", icon: "⚽" },
  { to: "/mercado", label: "Mercado", icon: "🔁" },
  { to: "/ligas", label: "Ligas", icon: "🏆" },
];

export default function Layout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { leagues, activeLeagueId } = useAppSelector((s) => s.leagues);

  function handleLogout() {
    dispatch(logout());
    dispatch(clearLeagues());
    navigate("/acceso");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
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
              🪙 {user?.coins.toLocaleString("es-MX")}
            </span>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Cerrar sesión">
              Salir
            </button>
          </div>
        </div>
      </header>

      <nav className={styles.nav} aria-label="Navegación principal">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
