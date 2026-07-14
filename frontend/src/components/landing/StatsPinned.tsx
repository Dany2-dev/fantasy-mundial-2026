import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef } from "react";
import styles from "./StatsPinned.module.css";

gsap.registerPlugin(ScrollTrigger);

interface Stat {
  value: number;
  label: string;
}

// Todos estos números son reales: salen del último seed de FotMob corrido
// contra la base de datos, no son cifras inventadas para la demo.
const STATS: Stat[] = [
  { value: 12, label: "competencias reales" },
  { value: 284, label: "equipos" },
  { value: 8894, label: "jugadores reales" },
  { value: 3700, label: "partidos" },
  { value: 94, label: "rating máximo" },
  { value: 15000, label: "monedas de bienvenida" },
  { value: 4, label: "rangos de carta" },
  { value: 7, label: "días de protección tras clausular" },
];

export default function StatsPinned() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 860px) and (prefers-reduced-motion: no-preference)",
          isMobile: "(max-width: 859px) and (prefers-reduced-motion: no-preference)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const conditions = context.conditions as {
            isDesktop: boolean;
            isMobile: boolean;
            reduceMotion: boolean;
          };
          const cards = cardRefs.current.filter((c): c is HTMLDivElement => c !== null);

          const setFinal = (card: HTMLDivElement, stat: Stat) => {
            gsap.set(card, { opacity: 1, y: 0, scale: 1 });
            const numEl = card.querySelector<HTMLElement>("[data-num]");
            if (numEl) numEl.textContent = stat.value.toLocaleString("es-MX");
          };

          if (conditions.reduceMotion) {
            cards.forEach((card, i) => setFinal(card, STATS[i]));
            return;
          }

          if (conditions.isDesktop) {
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: "top top",
                end: () => `+=${cards.length * 360}`,
                pin: true,
                scrub: 1,
              },
            });

            cards.forEach((card, i) => {
              const counter = { val: 0 };
              const numEl = card.querySelector<HTMLElement>("[data-num]");
              const stat = STATS[i];
              const at = i * 0.9;

              tl.fromTo(
                card,
                { opacity: 0, y: 50, scale: 0.92 },
                { opacity: 1, y: 0, scale: 1, ease: "power2.out", duration: 0.55 },
                at
              ).to(
                counter,
                {
                  val: stat.value,
                  duration: 0.55,
                  ease: "power1.out",
                  onUpdate: () => {
                    if (numEl) numEl.textContent = Math.round(counter.val).toLocaleString("es-MX");
                  },
                },
                at + 0.05
              );

              if (i < cards.length - 1) {
                tl.to(card, { opacity: 0.28, scale: 0.95, ease: "power1.inOut", duration: 0.35 }, at + 0.75);
              }
            });

            return;
          }

          if (conditions.isMobile) {
            cards.forEach((card, i) => {
              const stat = STATS[i];
              const counter = { val: 0 };
              const numEl = card.querySelector<HTMLElement>("[data-num]");

              gsap.fromTo(
                card,
                { opacity: 0, y: 30 },
                {
                  opacity: 1,
                  y: 0,
                  ease: "power2.out",
                  duration: 0.5,
                  scrollTrigger: { trigger: card, start: "top 88%", toggleActions: "play none none reverse" },
                }
              );
              gsap.to(counter, {
                val: stat.value,
                duration: 0.9,
                ease: "power1.out",
                scrollTrigger: { trigger: card, start: "top 88%" },
                onUpdate: () => {
                  if (numEl) numEl.textContent = Math.round(counter.val).toLocaleString("es-MX");
                },
              });
            });
          }
        }
      );

      return () => mm.revert();
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className={styles.section}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Con datos reales</span>
        <h2 className={styles.heading}>No son cartas inventadas.</h2>
        <div className={styles.grid}>
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={styles.card}
            >
              <span className={styles.num} data-num>
                0
              </span>
              <span className={styles.label}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
