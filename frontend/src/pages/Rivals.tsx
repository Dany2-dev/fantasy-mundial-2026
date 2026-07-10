import styles from "./Rivals.module.css";

// Página asignada a Naoki. Mostrará a los mánagers de tu liga (su
// plantilla, posición en la tabla) — la lógica real se conecta después;
// por ahora es el archivo donde se trabaja el diseño visual.
export default function Rivals() {
  return (
    <div>
      <h1>Rivales</h1>
      <div className={styles.placeholder}>
        <p className="muted">Aquí verás a los mánagers de tu liga: su plantilla y su posición en la tabla.</p>
      </div>
    </div>
  );
}
