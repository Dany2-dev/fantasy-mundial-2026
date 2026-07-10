import styles from "./History.module.css";

// Página asignada a Naoki. Mostrará tus jornadas (puntos por fecha) y tus
// movimientos (cláusulas, ventas, intercambios) — la lógica real se
// conecta después; por ahora es el archivo donde se trabaja el diseño visual.
export default function History() {
  return (
    <div>
      <h1>Historial</h1>
      <div className={styles.placeholder}>
        <p className="muted">Aquí verás tus puntos jornada a jornada y tus movimientos (cláusulas, ventas, cambios).</p>
      </div>
    </div>
  );
}
