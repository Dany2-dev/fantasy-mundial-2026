import { AnimatePresence, motion, useReducedMotion, Variants } from "motion/react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { IconArrowRight, IconCards, IconCheck, IconClose, IconStar } from "./icons";
import PlayerCard from "./PlayerCard";
import PlayerDetailModal from "./PlayerDetailModal";
import { RARITY_COLOR } from "../lib/rarityColors";
import { Player, rarityOf } from "../types";
import styles from "./PackOpeningModal.module.css";

type PackPhase = "sealed" | "open";

interface PackOpeningModalProps {
  card: Player;
  packArt: string;
  leagueId: string;
  index: number;
  total: number;
  onOpen?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

const T = {
  tear: 0.3, // Fase A
  riseDelay: 0.15, // Fase B empieza
  riseDuration: 0.4,
  bounceDuration: 0.35, // Fase C
  auraStart: 0.5, // Fase D
  auraDuration: 0.6,
  ringGap: 0.1,
  controlsStart: 0.9, // Fase E
  controlsStagger: 0.09,
};

// Fase B + C fusionadas en una sola secuencia de keyframes sobre el mismo
// eje Y: sube desde 60vh (Fase B, easeOut) y encadena el rebote elástico
// 0% -> -20% -> 10% -> 0% (Fase C, easeInOut) sin que se pisen dos animate().
const cardYVariants: Variants = {
  hidden: { y: "60vh", opacity: 0 },
  visible: {
    y: ["60vh", "0%", "-20%", "10%", "0%"],
    opacity: [0, 1, 1, 1, 1],
    transition: {
      delay: T.riseDelay,
      duration: T.riseDuration + T.bounceDuration,
      times: [0, T.riseDuration / (T.riseDuration + T.bounceDuration), 0.75, 0.9, 1],
      ease: ["easeOut", "easeInOut", "easeInOut", "easeInOut"],
    },
  },
};

const cardYVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delay: T.riseDelay, duration: 0.2 } },
};

const auraVariants: Variants = {
  hidden: { scale: 1, opacity: 0 },
  visible: {
    scale: [1, 1.5, 1],
    opacity: [0, 0.9, 0.9],
    transition: { delay: T.auraStart, duration: T.auraDuration, ease: "easeInOut" },
  },
};

const ringVariants: Variants = {
  hidden: { scale: 0.8, opacity: 1 },
  visible: (i: number) => ({
    scale: [0.8, 1.25, 1.25],
    opacity: [1, 0.2, 0],
    transition: { delay: T.auraStart + i * T.ringGap, duration: 0.6, ease: "easeOut" },
  }),
};

const controlsContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: T.controlsStart, staggerChildren: T.controlsStagger } },
};

const controlItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
};

export default function PackOpeningModal({
  card,
  packArt,
  leagueId,
  index,
  total,
  onOpen,
  onNext,
  onClose,
}: PackOpeningModalProps) {
  const [phase, setPhase] = useState<PackPhase>("sealed");
  const [showDetail, setShowDetail] = useState(false);
  const firstControlRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const rarity = rarityOf(card.rating);
  const isLast = index >= total - 1;

  // Cada carta nueva del mismo sobre vuelve a arrancar sellada.
  useEffect(() => {
    setPhase("sealed");
  }, [card.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (showDetail) setShowDetail(false);
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showDetail]);

  // Mueve el foco al primer botón de acción cuando termina la Fase E.
  // onAnimationComplete no dispara de forma confiable cuando el valor animado
  // llega por propagación de variants desde un ancestro con stagger (no es
  // una animación "propia" del nodo), así que se calcula el tiempo total en
  // vez de depender de ese callback.
  useEffect(() => {
    if (phase !== "open") return;
    const totalMs = (T.controlsStart + 2 * T.controlsStagger + 0.25) * 1000;
    const id = window.setTimeout(() => firstControlRef.current?.focus(), totalMs);
    return () => window.clearTimeout(id);
  }, [phase]);

  function handleOpen() {
    setPhase("open");
    onOpen?.();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Apertura de sobre"
      >
        <span className={styles.headerIcon} aria-hidden="true">
          <IconCards size={20} />
        </span>
        <h2 className={styles.title}>
          {phase === "sealed" ? "¡Tu pack está listo!" : `Tus cartas: ${index + 1}/${total}`}
        </h2>

        <div className={styles.stage}>
          <AnimatePresence mode="wait">
            {phase === "sealed" ? (
              <motion.img
                key="sealed"
                src={packArt}
                alt=""
                className={styles.sealedImg}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            ) : (
              <motion.div key="reveal" className={styles.revealStage}>
                {/* Fase A + B: mitad izquierda solo se desvanece; la derecha
                    además rota/se desplaza (el "rasgado"). */}
                <motion.img
                  src={packArt}
                  alt=""
                  className={`${styles.packHalf} ${styles.packHalfLeft}`}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: 24 }}
                  transition={{ delay: T.riseDelay, duration: 0.25, ease: "easeOut" }}
                />
                <motion.img
                  src={packArt}
                  alt=""
                  className={`${styles.packHalf} ${styles.packHalfRight}`}
                  initial={{ rotate: 0, x: 0, y: 0, opacity: 1 }}
                  animate={{ rotate: -15, x: 40, y: -30, opacity: 0 }}
                  transition={{
                    rotate: { duration: T.tear, ease: "easeIn" },
                    x: { duration: T.tear, ease: "easeIn" },
                    y: { duration: T.tear, ease: "easeIn" },
                    opacity: { delay: T.riseDelay, duration: 0.25, ease: "easeOut" },
                  }}
                />

                {/* Fase D: aura + 2 anillos de energía, color según rareza */}
                <motion.span
                  className={styles.aura}
                  style={{ "--rarity-color": RARITY_COLOR[rarity] } as CSSProperties}
                  variants={auraVariants}
                  initial="hidden"
                  animate={reduceMotion ? "hidden" : "visible"}
                  aria-hidden="true"
                />
                {!reduceMotion &&
                  [0, 1].map((i) => (
                    <motion.span
                      key={i}
                      className={styles.ring}
                      style={{ borderColor: RARITY_COLOR[rarity] } as CSSProperties}
                      variants={ringVariants}
                      custom={i}
                      initial="hidden"
                      animate="visible"
                      aria-hidden="true"
                    />
                  ))}

                {/* Fase B + C: la carta emerge y rebota al asentarse */}
                <motion.div
                  className={styles.cardWrap}
                  variants={reduceMotion ? cardYVariantsReduced : cardYVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <PlayerCard player={card} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {phase === "sealed" && (
          <button type="button" className={`primary ${styles.openBtn}`} onClick={handleOpen}>
            Abrir
          </button>
        )}

        {phase === "open" && (
          <motion.div className={styles.footer} initial="hidden" animate="visible" variants={controlsContainerVariants}>
            <motion.span className={styles.progressBadge} variants={controlItemVariants}>
              Tus cartas: {index + 1}/{total}
            </motion.span>

            <motion.span className={styles.ratingPill} variants={controlItemVariants}>
              <IconStar size={14} /> {card.rating}
            </motion.span>

            <motion.div className={styles.controlsRow} variants={controlItemVariants}>
              <button ref={firstControlRef} type="button" className={styles.controlBtn} onClick={() => setShowDetail(true)}>
                <IconCards size={18} />
                <span className={styles.controlLabel}>Ver detalle</span>
              </button>

              <button type="button" className={styles.controlBtn} onClick={isLast ? onClose : onNext}>
                {isLast ? <IconCheck size={18} /> : <IconArrowRight size={18} />}
                <span className={styles.controlLabel}>{isLast ? "Listo" : "Siguiente"}</span>
              </button>

              <button type="button" className={styles.controlBtn} onClick={onClose}>
                <IconClose size={18} />
                <span className={styles.controlLabel}>Cerrar</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>

      {showDetail && <PlayerDetailModal playerId={card.id} leagueId={leagueId} onClose={() => setShowDetail(false)} />}
    </div>
  );
}
