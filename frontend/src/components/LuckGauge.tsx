// Ruleta de la suerte: cuando una decisión tenía porcentaje (competir por el
// puesto, doble turno…), este medidor muestra cómo cayó el dado. La aguja gira
// unas vueltas y se frena en el número que salió, dentro de la zona verde
// (éxito) o la roja (fracaso). Es SVG puro + motion — sin librerías de charts,
// para no cargar el bundle por un adorno.
import { motion, useReducedMotion } from "motion/react";
import { LuckRoll } from "../lib/careerEngine";
import styles from "./LuckGauge.module.css";

const START = -120; // grados: extremo izquierdo del arco
const END = 120; // grados: extremo derecho
const SWEEP = END - START;
const R = 52; // radio del arco
const CX = 60;
const CY = 62;

/** Punto del arco para un valor 0-100. */
function polar(value: number, radius: number) {
  const angle = ((START + (value / 100) * SWEEP) - 90) * (Math.PI / 180);
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

/** Path de un sector del arco entre dos valores 0-100. */
function arcPath(from: number, to: number, radius: number) {
  const a = polar(from, radius);
  const b = polar(to, radius);
  const large = ((to - from) / 100) * SWEEP > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${large} 1 ${b.x} ${b.y}`;
}

export default function LuckGauge({ roll }: { roll: LuckRoll }) {
  const reduceMotion = useReducedMotion();
  const needleAngle = START + (roll.rolled / 100) * SWEEP;

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 120 84" className={styles.svg} role="img" aria-label={`Suerte: salió ${roll.rolled} de 100, necesitabas menos de ${roll.chance}`}>
        {/* Zona de éxito (verde) y de fracaso (roja) */}
        <path d={arcPath(0, roll.chance, R)} className={styles.zoneWin} />
        <path d={arcPath(roll.chance, 100, R)} className={styles.zoneLose} />

        {/* Aguja: gira un par de vueltas antes de frenarse en el resultado. */}
        <motion.g
          initial={reduceMotion ? { rotate: needleAngle } : { rotate: START - 360 * 2 }}
          animate={{ rotate: needleAngle }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ originX: `${CX}px`, originY: `${CY}px` }}
        >
          <line x1={CX} y1={CY} x2={CX} y2={CY - R + 6} className={styles.needle} />
        </motion.g>
        <circle cx={CX} cy={CY} r="5" className={styles.pivot} />
      </svg>

      {/* Sin fundido: el resultado es la información clave de la ruleta y no
          puede quedar invisible si el navegador congela los frames. */}
      <motion.div
        className={styles.result}
        initial={reduceMotion ? undefined : { y: 4 }}
        animate={{ y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 1.5, duration: 0.4 }}
      >
        <span className={roll.success ? styles.win : styles.lose}>
          {roll.success ? roll.successLabel : roll.failLabel}
        </span>
        <span className={styles.detail}>
          Salió {roll.rolled} · necesitabas menos de {roll.chance}
        </span>
      </motion.div>
    </div>
  );
}
