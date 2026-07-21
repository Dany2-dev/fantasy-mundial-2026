import { useEffect, useState } from "react";
import { IconCoin, IconPack, IconTrophy } from "../icons";
import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    Icon: IconCoin,
    step: "01",
    title: "Funda tu club",
    description: "Crea tu cuenta y recibe €50M de presupuesto en cada liga para empezar a fichar.",
  },
  {
    Icon: IconPack,
    step: "02",
    title: "Descubre tus cartas",
    description: "Entra a una liga, recibe 11 cartas gratis y abre sobres para reforzar tu once.",
  },
  {
    Icon: IconTrophy,
    step: "03",
    title: "Reta a tus amigos",
    description: "Comparte el código con el grupo, arma tu once y pelea por la cima.",
  },
];

const AUTOPLAY_MS = 3500;

// Carrusel propio y liviano (sin Swiper): con solo 3 tarjetas fijas no vale
// la pena la dependencia extra, y así evitamos su bug de React 19 + StrictMode.
export default function HowItWorks() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((i) => (i + 1) % STEPS.length), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className={styles.section}>
      <span className={styles.eyebrow}>Del sobre a la cancha</span>
      <h2 className={styles.heading}>Tu liga arranca en tres jugadas</h2>

      <div className={styles.desktopGrid}>
        {STEPS.map(({ Icon, step, title, description }) => (
          <div key={step} className={styles.card}>
            <span className={styles.stepNum}>{step}</span>
            <span className={styles.icon}>
              <Icon size={26} />
            </span>
            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardDesc}>{description}</p>
          </div>
        ))}
      </div>

      <div className={styles.mobileCarousel}>
        <div className={styles.mobileTrack} style={{ transform: `translateX(-${active * 100}%)` }}>
          {STEPS.map(({ Icon, step, title, description }) => (
            <div key={step} className={styles.mobileSlide}>
              <div className={styles.card}>
                <span className={styles.stepNum}>{step}</span>
                <span className={styles.icon}>
                  <Icon size={26} />
                </span>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDesc}>{description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.dots}>
          {STEPS.map((s, i) => (
            <button
              key={s.step}
              type="button"
              className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Ver paso ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
