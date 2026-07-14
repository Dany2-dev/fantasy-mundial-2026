import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ReactNode, useLayoutEffect, useRef } from "react";
import styles from "./FeatureBlock.module.css";

gsap.registerPlugin(ScrollTrigger);

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  reverse?: boolean;
  visual: ReactNode;
}

// Bloque de dos columnas (texto + visual) reutilizado para las 5 features.
// El visual flota con un parallax leve atado al scroll de la sección.
export default function FeatureBlock({ eyebrow, title, description, reverse, visual }: Props) {
  const visualRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = visualRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          el,
          { y: 36 },
          {
            y: -36,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
      });
      return () => mm.revert();
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className={`${styles.block} ${reverse ? styles.reverse : ""}`}>
      <div className={styles.text}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>
      <div ref={visualRef} className={styles.visual}>
        {visual}
      </div>
    </section>
  );
}
