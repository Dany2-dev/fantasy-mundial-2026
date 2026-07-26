// Minijuego del penal: define la final de una copa continental. Elegís un
// palo, el portero vuela a las zonas que cubría (decididas ANTES por el motor,
// para que no haya trampa) y si la metés levantás el título.
//
// Todo el texto de estado es visible sin depender de la animación: si el
// navegador congela los frames, igual se entiende si fue gol o si te la atajaron.
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { PendingPenalty } from "../lib/careerEngine";
import { trophyByName } from "../lib/careerTrophies";
import styles from "./PenaltyShootout.module.css";

// Las 5 zonas de la portería, en coordenadas del viewBox 0 0 300 170.
const ZONES = [
  { id: 0, label: "Ángulo izquierdo", x: 58, y: 52 },
  { id: 1, label: "Ángulo derecho", x: 242, y: 52 },
  { id: 2, label: "Centro", x: 150, y: 78 },
  { id: 3, label: "Bajo, izquierda", x: 66, y: 112 },
  { id: 4, label: "Bajo, derecha", x: 234, y: 112 },
];

export default function PenaltyShootout({
  penalty,
  onShoot,
}: {
  penalty: PendingPenalty;
  onShoot: (zone: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const def = trophyByName(penalty.competition);

  const scored = picked !== null && !penalty.keeperZones.includes(picked);
  const target = picked !== null ? ZONES[picked] : null;
  // El portero vuela a la primera zona que cubría (visualmente basta con una).
  const keeperTarget = ZONES[penalty.keeperZones[0]];

  function shoot(zone: number) {
    if (picked !== null) return;
    setPicked(zone);
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <div className={styles.head}>
          {def.logoUrl && <img src={def.logoUrl} alt="" className={styles.cupLogo} />}
          <div>
            <p className={styles.eyebrow}>Final · {penalty.competition}</p>
            <h2 className={styles.title}>El penal decisivo</h2>
          </div>
        </div>
        <p className={styles.desc}>
          Último minuto, la final empatada y la pelota en el punto. El {penalty.club} entero te está mirando.
          <strong> Elegí dónde la ponés.</strong>
        </p>

        <div className={styles.pitchWrap}>
          <svg viewBox="0 0 300 170" className={styles.goalSvg}>
            {/* Césped y portería */}
            <rect x="0" y="130" width="300" height="40" fill="#0f3d22" />
            <rect x="30" y="30" width="240" height="105" fill="rgba(255,255,255,0.04)" stroke="#f4f6fb" strokeWidth="4" />
            <path d="M30 30 L52 14 L278 14 L270 30" fill="none" stroke="#f4f6fb" strokeWidth="2" opacity="0.5" />
            {/* Red */}
            <g stroke="rgba(255,255,255,0.14)" strokeWidth="1">
              {Array.from({ length: 11 }).map((_, i) => (
                <line key={`v${i}`} x1={30 + i * 24} y1={30} x2={30 + i * 24} y2={135} />
              ))}
              {Array.from({ length: 5 }).map((_, i) => (
                <line key={`h${i}`} x1={30} y1={30 + i * 26} x2={270} y2={30 + i * 26} />
              ))}
            </g>

            {/* Portero */}
            <motion.g
              animate={
                picked === null
                  ? { x: 0, y: 0 }
                  : reduceMotion
                    ? { x: keeperTarget.x - 150, y: keeperTarget.y - 95 }
                    : { x: keeperTarget.x - 150, y: keeperTarget.y - 95 }
              }
              transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : 0.25 }}
            >
              <circle cx="150" cy="86" r="9" fill="#f0c24b" />
              <rect x="141" y="95" width="18" height="26" rx="6" fill="#f0c24b" />
            </motion.g>

            {/* Balón */}
            {target && (
              <motion.circle
                r="7"
                fill="#ffffff"
                stroke="#0b1220"
                strokeWidth="1.5"
                initial={{ cx: 150, cy: 160 }}
                animate={{ cx: target.x, cy: target.y }}
                transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
              />
            )}

            {/* Zonas clickeables */}
            {picked === null &&
              ZONES.map((z) => (
                <g key={z.id} className={styles.zone} onClick={() => shoot(z.id)}>
                  <circle cx={z.x} cy={z.y} r="24" className={styles.zoneHit} />
                  <circle cx={z.x} cy={z.y} r="13" className={styles.zoneDot} />
                </g>
              ))}
          </svg>
        </div>

        {picked === null ? (
          <p className={styles.hint}>Tocá una zona del arco para definir</p>
        ) : (
          <div className={styles.result}>
            <p className={scored ? styles.goal : styles.miss}>
              {scored ? "¡GOOOL! Campeón." : "¡Atajado! Se escapó el título."}
            </p>
            <p className={styles.resultDetail}>
              Tiraste a {ZONES[picked].label.toLowerCase()} · el arquero voló a {ZONES[penalty.keeperZones[0]].label.toLowerCase()}
            </p>
            <button className="primary" onClick={() => onShoot(picked)}>
              Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
