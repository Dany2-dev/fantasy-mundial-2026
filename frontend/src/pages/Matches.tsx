import styles from "./Matches.module.css";

// Página asignada a Juan. Estructura mínima: la lógica real (partidos
// jugados, tabla general, goleadores) se conecta después; por ahora es
// el archivo donde se trabaja el diseño visual.
export default function Matches() {
  return (
    <div>
      <h1>Partidos</h1>
      <div className={styles.placeholder}>
        <p className="muted">Aquí irán los partidos jugados, la tabla general y los goleadores.</p>
      </div>
    </div>
  );
}
