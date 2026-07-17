import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ElectricBorder from "../components/ElectricBorder";
import { IconCards } from "../components/icons";
import PlayerCard from "../components/PlayerCard";
import PlayerDetailModal from "../components/PlayerDetailModal";
import { fetchCollection } from "../store/collectionSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player, Rarity, rarityOf } from "../types";
import styles from "./Collection.module.css";

const FILTERS = ["Todos", "POR", "DEF", "MED", "DEL"] as const;
const RARITIES = ["Todas", "legendario", "oro", "plata", "bronce"] as const;
const SORTS = ["media", "nombre", "posicion"] as const;

type Filter = (typeof FILTERS)[number];
type RarityFilter = (typeof RARITIES)[number];
type Sort = (typeof SORTS)[number];

const RARITY_LABEL: Record<Exclude<RarityFilter, "Todas">, string> = {
  legendario: "Legendaria",
  oro: "Oro",
  plata: "Plata",
  bronce: "Bronce",
};

const SORT_LABEL: Record<Sort, string> = {
  media: "Media (mayor primero)",
  nombre: "Nombre (A-Z)",
  posicion: "Posición",
};

const POS_ORDER: Record<Player["position"], number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

// Color del rayo según la rareza, tomado de los materiales foil de
// variables.css. Se usan los tonos medios de cada foil: la página es blanca y
// los claros se pierden contra el fondo.
const ELECTRIC: Record<Rarity, string> = {
  legendario: "#7b2fff",
  oro: "#d49a17",
  plata: "#7b8798",
  bronce: "#a9713c",
};

// Lupa local: icons.tsx es compartido con otras páginas, así que no lo tocamos.
// Mismo trazo que el resto de iconos del proyecto.
function IconSearch({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

// "Martínez" y "martinez" deben encontrarse igual.
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export default function Collection() {
  const dispatch = useAppDispatch();
  const activeLeagueId = useAppSelector((s) => s.leagues.activeLeagueId);
  const { items, status } = useAppSelector((s) => s.collection);
  const [filter, setFilter] = useState<Filter>("Todos");
  const [rarity, setRarity] = useState<RarityFilter>("Todas");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("media");
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  // Solo la carta con el cursor encima anima su borde eléctrico.
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  useEffect(() => {
    if (activeLeagueId) dispatch(fetchCollection(activeLeagueId));
  }, [dispatch, activeLeagueId]);

  // Base = todo lo que pasa búsqueda + rareza. Los contadores de posición se
  // calculan sobre esta base para que digan cuántas cartas verías al pulsarlos.
  const base = useMemo(() => {
    const q = normalize(query.trim());
    return items.filter((p) => {
      if (rarity !== "Todas" && rarityOf(p.rating) !== rarity) return false;
      if (!q) return true;
      return normalize(p.name).includes(q) || normalize(p.team?.name ?? "").includes(q);
    });
  }, [items, query, rarity]);

  const visible = useMemo(() => {
    const list = filter === "Todos" ? base : base.filter((p) => p.position === filter);
    const sorted = [...list];
    if (sort === "media") sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === "nombre") sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
    else sorted.sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || b.rating - a.rating);
    return sorted;
  }, [base, filter, sort]);

  const counts = (pos: Filter) => (pos === "Todos" ? base.length : base.filter((p) => p.position === pos).length);
  const rarityCount = (r: Rarity) => items.filter((p) => rarityOf(p.rating) === r).length;

  const avgRating = items.length ? Math.round(items.reduce((s, p) => s + p.rating, 0) / items.length) : 0;
  const totalValue = items.reduce((s, p) => s + p.rating, 0);
  const goldCount = items.filter((p) => {
    const r = rarityOf(p.rating);
    return r === "oro" || r === "legendario";
  }).length;

  const isFiltering = query.trim() !== "" || rarity !== "Todas" || filter !== "Todos";

  function resetFilters() {
    setQuery("");
    setRarity("Todas");
    setFilter("Todos");
  }

  if (!activeLeagueId) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyBadge} aria-hidden="true">
          <IconCards size={30} />
        </span>
        <h1>Colección</h1>
        <p className="muted">Primero entra a una liga. Ahí vas a reunir todos tus fichajes.</p>
        <Link to="/ligas">
          <button className="primary">Ir a Ligas</button>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ===== Cabecera con estadísticas ===== */}
      <section className={styles.hero}>
        <img src="/stadium/stadium-seats.jpg" alt="" className={styles.heroArt} aria-hidden="true" />
        <span className={styles.heroWash} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div>
            <span className={styles.eyebrow}>Mi club</span>
            <h1 className={styles.title}>Colección</h1>
            <p className={styles.sub}>Aquí están todos tus fichajes. Filtra por posición y encuentra tu próximo titular.</p>
          </div>

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{items.length}</span>
              <span className={styles.statLabel}>Cartas</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{avgRating || "—"}</span>
              <span className={styles.statLabel}>Media</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{goldCount}</span>
              <span className={styles.statLabel}>Oro o mejor</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{totalValue.toLocaleString("es-MX")}</span>
              <span className={styles.statLabel}>Valor</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Buscador + orden ===== */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <IconSearch size={17} />
          </span>
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por jugador o selección…"
            aria-label="Buscar carta por nombre o selección"
          />
        </div>
        <label className={styles.sortWrap}>
          <span className={styles.sortLabel}>Ordenar</span>
          <select className={styles.sort} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ===== Filtros por posición ===== */}
      <div className={styles.filters} role="group" aria-label="Filtrar por posición">
        {FILTERS.map((f) => (
          <button
            key={f}
            data-pos={f}
            className={`${styles.filterChip} ${filter === f ? styles.filterActive : ""}`}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {f}
            <span className={styles.filterCount}>{counts(f)}</span>
          </button>
        ))}
      </div>

      {/* ===== Filtros por rareza ===== */}
      <div className={styles.rarities} role="group" aria-label="Filtrar por rareza">
        {RARITIES.map((r) => (
          <button
            key={r}
            data-rarity={r}
            className={`${styles.rarityChip} ${rarity === r ? styles.rarityActive : ""}`}
            onClick={() => setRarity(r)}
            aria-pressed={rarity === r}
          >
            {r === "Todas" ? "Todas" : `${RARITY_LABEL[r]} · ${rarityCount(r)}`}
          </button>
        ))}
      </div>

      {status === "ready" && items.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyBadge} aria-hidden="true">
            <IconCards size={30} />
          </span>
          <p className="muted">Tu álbum sigue en blanco… Abre un sobre y empieza a armar tu club.</p>
          <Link to="/sobres">
            <button className="primary">Abrir mi primer sobre</button>
          </Link>
        </div>
      )}

      {status === "ready" && items.length > 0 && visible.length === 0 && (
        <div className={styles.empty}>
          <p className="muted">
            {query.trim()
              ? `Ninguna carta coincide con “${query.trim()}”.`
              : "No tienes cartas con esos filtros."}
          </p>
          {isFiltering && (
            <button className="ghost" onClick={resetFilters}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      <div className={styles.grid}>
        {visible.map((p, i) => (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              // El escalonado es solo para la entrada; al recolocarse por un
              // filtro la carta debe moverse ya, sin arrastrar ese retardo.
              opacity: { duration: 0.22, delay: Math.min(i * 0.02, 0.3) },
              y: { duration: 0.22, delay: Math.min(i * 0.02, 0.3) },
              layout: { duration: 0.25 },
            }}
            onMouseEnter={() => setHoveredId(p.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === p.id ? null : cur))}
          >
            <ElectricBorder
              active={hoveredId === p.id}
              color={ELECTRIC[rarityOf(p.rating)]}
              borderRadius={16}
              speed={1.1}
              chaos={0.14}
            >
              <PlayerCard player={p} onClick={() => setOpenPlayerId(p.id)} />
            </ElectricBorder>
          </motion.div>
        ))}
      </div>

      {openPlayerId != null && (
        <PlayerDetailModal
          playerId={openPlayerId}
          leagueId={activeLeagueId}
          onClose={() => setOpenPlayerId(null)}
          onChanged={() => dispatch(fetchCollection(activeLeagueId))}
        />
      )}
    </div>
  );
}
