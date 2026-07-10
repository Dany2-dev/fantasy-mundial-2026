import { ReactNode, useEffect, useState } from "react";
import { IconClose } from "./icons";
import styles from "./StickyBanner.module.css";

interface Props {
  children: ReactNode;
  /** Oculta el banner al bajar más de 40px, lo vuelve a mostrar al subir. */
  hideOnScroll?: boolean;
  onDismiss?: () => void;
}

// Banner fijo arriba de todo, con entrada deslizante y cierre manual.
// Réplica del comportamiento de ui.aceternity.com/components/sticky-banner
// hecha con CSS puro (sin framer-motion) para no sumar dependencias.
export default function StickyBanner({ children, hideOnScroll = false, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [hiddenByScroll, setHiddenByScroll] = useState(false);

  useEffect(() => {
    if (!hideOnScroll) return;
    function onScroll() {
      setHiddenByScroll(window.scrollY > 40);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideOnScroll]);

  if (dismissed) return null;

  return (
    <div className={`${styles.wrap} ${hiddenByScroll ? styles.hidden : ""}`}>
      <div className={styles.banner} role="status">
        <div className={styles.content}>{children}</div>
        <button
          className={styles.close}
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          aria-label="Cerrar aviso"
        >
          <IconClose size={16} />
        </button>
      </div>
    </div>
  );
}
