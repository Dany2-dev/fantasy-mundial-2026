import styles from "./Play.module.css";

// Página asignada a Alejandro. Hub de minijuegos para ganar monedas y
// abrir sobres (estilo futbol-11.com) — la lógica real se conecta
// después; por ahora es el archivo donde se trabaja el diseño visual.
export default function Play() {
  return (
    <div>
      <h1>Jugar</h1>
      <div className={styles.placeholder}>
        <p className="muted">Aquí irán los minijuegos para ganar monedas y abrir sobres.</p>
      </div>
    </div>
  );
}
