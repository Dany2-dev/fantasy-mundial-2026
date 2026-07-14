import styles from "./Marquee.module.css";

interface Props {
  items: string[];
}

// Cinta infinita 100% CSS (sin JS/GSAP): dos copias del mismo contenido una
// junto a la otra, animando -50% para que el loop no se note la costura.
export default function Marquee({ items }: Props) {
  const strip = (
    <>
      {items.map((item, i) => (
        <span key={i} className={styles.item}>
          {item}
          <span className={styles.dot} aria-hidden="true">
            •
          </span>
        </span>
      ))}
    </>
  );

  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.track}>
        {strip}
        {strip}
      </div>
    </div>
  );
}
