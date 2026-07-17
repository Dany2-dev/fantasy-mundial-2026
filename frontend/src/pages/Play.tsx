import { IconCoin } from "../components/icons";
import styles from "./Play.module.css";

interface Game {
  slug: string;
  title: string;
  desc: string;
  reward: string;
  emoji: string;
}

// Alejandro trabaja el diseño de esta página. Hub de minijuegos estilo
// futbol-11.com para ganar monedas y abrir sobres — la lógica de cada
// juego se conecta después; por ahora las tarjetas ya tienen contenido real.
const GAMES: Game[] = [
  { slug: "quiz", title: "¿Quién es?", emoji: "⚡", desc: "Reconoce al jugador por su foto. Mientras más rápido respondas, más monedas te llevas.", reward: "Hasta 500" },
  { slug: "predicciones", title: "Predicciones del día", emoji: "📅", desc: "Pronostica los partidos de hoy y gana monedas por cada acierto.", reward: "100 / acierto" },
  { slug: "adivina-rating", title: "Adivina el rating", emoji: "⭐", desc: "Calcula el rating de cada carta. Mientras más te acerques, mayor será el premio.", reward: "Hasta 1,600" },
  { slug: "bandera", title: "¿De qué selección?", emoji: "🌍", desc: "Une a cada jugador con su selección o club.", reward: "Hasta 400" },
  { slug: "cara-o-cruz", title: "¿Quién tiene más rating?", emoji: "🆚", desc: "Dos jugadores, un duelo: elige quién tiene mejor rating.", reward: "Hasta 1,200" },
  { slug: "posicion", title: "¿Cuál es su posición?", emoji: "🎯", desc: "Mira la foto y decide: ¿portero, defensa, medio o delantero?", reward: "Hasta 1,000" },
  { slug: "precio-justo", title: "¿Cuánto vale en el mercado?", emoji: "🪙", desc: "Tienes su rating y posición. ¿Puedes clavar su valor exacto?", reward: "Hasta 1,400" },
];

export default function Play() {
  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <h1>Jugar</h1>
          <p className="muted">Pon a prueba tu fútbol, gana monedas y vuelve más fuerte al mercado.</p>
        </div>
      </div>

      <div className={styles.grid}>
        {GAMES.map((g) => (
          <div key={g.slug} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.emoji} aria-hidden="true">
                {g.emoji}
              </span>
              <span className={styles.soonTag}>Próximamente</span>
            </div>
            <h2 className={styles.cardTitle}>{g.title}</h2>
            <p className={styles.cardDesc}>{g.desc}</p>
            <div className={styles.cardFoot}>
              <span className={styles.reward}>
                <IconCoin size={15} /> {g.reward}
              </span>
              <button className="ghost" disabled>
                Jugar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
