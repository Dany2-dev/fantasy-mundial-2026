import { ReactNode, useRef } from "react";
import styles from "./SpotlightField.module.css";

interface Props {
  label: string;
  children: ReactNode;
}

// Envoltorio para inputs con un resplandor radial que sigue el cursor,
// vía una custom property CSS actualizada en cada mousemove (sin dependencias extra).
export default function SpotlightField({ label, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    ref.current!.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    ref.current!.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }

  return (
    <label className={styles.field}>
      <span className="caption">{label}</span>
      <div ref={ref} className={styles.spotlight} onMouseMove={handleMove}>
        {children}
      </div>
    </label>
  );
}
