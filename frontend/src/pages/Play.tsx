import { useState } from "react";
import { IconCoin } from "../components/icons";
import RouletteModal from "../components/RouletteModal";
import PenaltyModal from "../components/PenaltyModal";
import BlackjackModal from "../components/BlackjackModal";
import styles from "./Play.module.css";

interface Game {
  slug: string;
  title: string;
  desc: string;
  reward: string;
  emoji: string;
  active?: boolean;
}

const GAMES: Game[] = [
  {
    slug: "ruleta",
    title: "Ruleta de la Suerte",
    emoji: "🎰",
    desc: "10 segmentos con suspenso de 6.5s. Apuesta tus monedas globales o entra en modo ALL-IN con multiplicadores de hasta 50x (SUPER JACKPOT).",
    reward: "Hasta 50x Jackpot",
    active: true,
  },
  {
    slug: "penaltis",
    title: "Tanda de Penaltis Multiplicadora",
    emoji: "⚽",
    desc: "Patea penales, esquiva las atajadas del portero y retira tus ganancias (Cash Out) o arriésgate a multiplicar hasta por 1 Millón de monedas.",
    reward: "Hasta 5,000x (Cash Out)",
    active: true,
  },
  {
    slug: "blackjack",
    title: "Blackjack 21 Futbolero",
    emoji: "🃏",
    desc: "Mesa de Blackjack clásica contra la casa. Pide carta o plántate para duplicar tus monedas con pagado 3:2 en Blackjack.",
    reward: "Pago 3:2 / 2x",
    active: true,
  },
  {
    slug: "quiz",
    title: "¿Quién es?",
    emoji: "⚡",
    desc: "Reconoce al jugador por su foto. Mientras más rápido respondas, más monedas te llevas.",
    reward: "Hasta €500K",
    active: false,
  },
  {
    slug: "predicciones",
    title: "Predicciones del día",
    emoji: "📅",
    desc: "Pronostica los partidos de hoy y gana monedas por cada acierto.",
    reward: "€100K / acierto",
    active: false,
  },
  {
    slug: "adivina-rating",
    title: "Adivina el rating",
    emoji: "⭐",
    desc: "Calcula el rating de cada carta. Mientras más te acerques, mayor será el premio.",
    reward: "Hasta 1,600",
    active: false,
  },
  {
    slug: "bandera",
    title: "¿De qué selección?",
    emoji: "🌍",
    desc: "Une a cada jugador con su selección o club.",
    reward: "Hasta 400",
    active: false,
  },
  {
    slug: "cara-o-cruz",
    title: "¿Quién tiene más rating?",
    emoji: "🆚",
    desc: "Dos jugadores, un duelo: elige quién tiene mejor rating.",
    reward: "Hasta 1,200",
    active: false,
  },
];

export default function Play() {
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [isPenaltyOpen, setIsPenaltyOpen] = useState(false);
  const [isBlackjackOpen, setIsBlackjackOpen] = useState(false);

  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <h1>Jugar & Minijuegos Casino</h1>
          <p className="muted">Pon a prueba tu suerte y estrategia: juega a la Ruleta, Tanda de Penaltis o Blackjack en modo ALL-IN.</p>
        </div>
      </div>

      <div className={styles.grid}>
        {GAMES.map((g) => (
          <div key={g.slug} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.emoji} aria-hidden="true">
                {g.emoji}
              </span>
              {g.active ? (
                <span
                  className={styles.activeTag}
                  style={{
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#10b981",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    borderRadius: 12,
                    padding: "2px 8px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  ¡DISPONIBLE!
                </span>
              ) : (
                <span className={styles.soonTag}>Próximamente</span>
              )}
            </div>
            <h2 className={styles.cardTitle}>{g.title}</h2>
            <p className={styles.cardDesc}>{g.desc}</p>
            <div className={styles.cardFoot}>
              <span className={styles.reward}>
                <IconCoin size={15} /> {g.reward}
              </span>
              {g.slug === "ruleta" ? (
                <button className="primary" onClick={() => setIsRouletteOpen(true)}>
                  ¡JUGAR RULETA!
                </button>
              ) : g.slug === "penaltis" ? (
                <button className="primary" onClick={() => setIsPenaltyOpen(true)}>
                  ¡PATEAR PENALES!
                </button>
              ) : g.slug === "blackjack" ? (
                <button className="primary" onClick={() => setIsBlackjackOpen(true)}>
                  ¡JUGAR 21!
                </button>
              ) : (
                <button className="ghost" disabled>
                  Jugar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <RouletteModal isOpen={isRouletteOpen} onClose={() => setIsRouletteOpen(false)} />
      <PenaltyModal isOpen={isPenaltyOpen} onClose={() => setIsPenaltyOpen(false)} />
      <BlackjackModal isOpen={isBlackjackOpen} onClose={() => setIsBlackjackOpen(false)} />
    </div>
  );
}
