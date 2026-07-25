// Ruleta de la suerte: cuando una decisión tenía porcentaje (competir por el
// puesto, doble turno…), este medidor muestra cómo cayó el dado. El giro y el
// estallido corren en Remotion (LuckWheel) — mismo lenguaje visual que el
// teaser de apertura de sobres. El veredicto en texto vive FUERA del player,
// siempre visible desde el frame 0: si el navegador congela la animación
// (pestaña en segundo plano), el resultado sigue siendo legible igual.
import { Player } from "@remotion/player";
import { LuckRoll } from "../lib/careerEngine";
import LuckWheel, { LUCK_WHEEL_DURATION, LUCK_WHEEL_FPS, LUCK_WHEEL_SIZE } from "../remotion/LuckWheel";
import styles from "./LuckGauge.module.css";

export default function LuckGauge({ roll, reduceMotion }: { roll: LuckRoll; reduceMotion?: boolean }) {
  return (
    <div className={styles.wrap}>
      <Player
        component={LuckWheel}
        inputProps={{ chance: roll.chance, rolled: roll.rolled, success: roll.success }}
        durationInFrames={LUCK_WHEEL_DURATION}
        fps={LUCK_WHEEL_FPS}
        compositionWidth={LUCK_WHEEL_SIZE}
        compositionHeight={Math.round(LUCK_WHEEL_SIZE * 0.75)}
        style={{ width: "100%", maxWidth: 190 }}
        controls={false}
        clickToPlay={false}
        initiallyMuted
        autoPlay={!reduceMotion}
        initialFrame={reduceMotion ? LUCK_WHEEL_DURATION - 1 : 0}
      />

      <div className={styles.result}>
        <span className={roll.success ? styles.win : styles.lose}>
          {roll.success ? roll.successLabel : roll.failLabel}
        </span>
        <span className={styles.detail}>
          Salió {roll.rolled} · necesitabas menos de {roll.chance}
        </span>
      </div>
    </div>
  );
}
