import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useState } from "react";

// Oculta un elemento fijo/sticky (header, tab bar) al bajar y lo revela al
// subir, para liberar pantalla en móvil. Se desactiva con prefers-reduced-motion.
export function useScrollHidden(threshold = 80): boolean {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const reduceMotion = useReducedMotion();

  useMotionValueEvent(scrollY, "change", (current) => {
    const previous = scrollY.getPrevious() ?? 0;
    setHidden(current > previous && current > threshold);
  });

  return reduceMotion ? false : hidden;
}
