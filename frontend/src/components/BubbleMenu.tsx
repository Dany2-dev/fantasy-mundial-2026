import { ReactNode, useEffect, useRef } from "react";
import { gsap } from "gsap";
import styles from "./BubbleMenu.module.css";

// Grid de selección animado con la misma técnica que CardSelect (ver
// components/CardSelect.tsx, adaptado de "CardNav" de React Bits): el panel
// anima su alto de 0 a "auto" mientras cada ítem entra con un stagger de
// y+opacity, en vez del scale+rotation "bubble pop" de la versión anterior.
// Se monta/desmonta desde el padre (Packs.tsx) según el estado de selección
// de país, así que la animación de entrada corre en cada mount.

export interface BubbleMenuItem {
  id: string | number;
  label: ReactNode;
  ariaLabel?: string;
  selected?: boolean;
  disabled?: boolean;
}

interface BubbleMenuProps {
  items: BubbleMenuItem[];
  onSelect: (item: BubbleMenuItem) => void;
  animationEase?: string;
  animationDuration?: number;
  staggerDelay?: number;
  reducedMotion?: boolean;
}

export default function BubbleMenu({
  items,
  onSelect,
  animationEase = "power3.out",
  animationDuration = 0.18,
  staggerDelay = 0.02,
  reducedMotion = false,
}: BubbleMenuProps) {
  const panelRef = useRef<HTMLUListElement | null>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const panel = panelRef.current;
    const els = itemsRef.current.filter(Boolean) as HTMLButtonElement[];
    if (!panel || !els.length) return;

    if (reducedMotion) {
      gsap.set(panel, { clearProps: "height,overflow" });
      gsap.set(els, { clearProps: "transform,opacity" });
      return;
    }

    gsap.set(panel, { height: 0, overflow: "hidden" });
    gsap.set(els, { y: 10, opacity: 0 });

    const tl = gsap.timeline();
    tl.to(panel, {
      height: "auto",
      duration: animationDuration,
      ease: animationEase,
      onComplete: () => gsap.set(panel, { clearProps: "height,overflow" }),
    });
    tl.to(
      els,
      {
        y: 0,
        opacity: 1,
        duration: animationDuration,
        ease: animationEase,
        stagger: staggerDelay,
        onComplete: () => gsap.set(els, { clearProps: "transform,opacity" }),
      },
      `-=${animationDuration * 0.6}`
    );

    return () => {
      tl.kill();
    };
  }, [items.length, animationEase, animationDuration, staggerDelay, reducedMotion]);

  return (
    <ul className={styles.bubbleGrid} role="listbox" aria-label="Selecciones disponibles" ref={panelRef}>
      {items.map((item, idx) => (
        <li key={item.id} className={styles.bubbleCol}>
          <button
            type="button"
            role="option"
            aria-selected={item.selected}
            aria-label={item.ariaLabel}
            disabled={item.disabled}
            className={`${styles.bubbleLink} ${item.selected ? styles.bubbleSelected : ""}`}
            ref={(el) => {
              itemsRef.current[idx] = el;
            }}
            onClick={() => onSelect(item)}
          >
            <span className={styles.bubbleLabel}>{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
