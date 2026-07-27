import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import styles from "./CardSelect.module.css";

export interface CardSelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: CardSelectOption[];
  ariaLabel: string;
  ease?: string;
}

// Select reemplazado por un desplegable animado con GSAP (misma técnica que
// CardNav de React Bits: el panel anima su alto de 0 a "auto" mientras cada
// opción entra con un stagger de y+opacity), adaptado a un dropdown chico en
// vez del navbar horizontal original — con hasta 11 jugadores en "Capitán",
// las tarjetas lado a lado de CardNav no entraban en un control de
// formulario, así que quedaron apiladas en una lista vertical.
//
// El timeline se arma de cero en cada apertura (no uno solo reutilizado
// construido en un efecto): la lista de "Capitán" puede cambiar de tamaño
// justo después de montar (llega de una API), y reconstruir un timeline
// persistente cada vez que eso pasa mataba la animación a mitad de camino
// si coincidía con el click de abrir. Armarlo al vuelo con las opciones que
// existen en ESE momento evita depender de que nada más cambie mientras
// está abierto.
export default function CardSelect({ value, onChange, options, ariaLabel, ease = "power3.out" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<HTMLButtonElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    return () => {
      tlRef.current?.kill();
    };
  }, []);

  function close() {
    const tl = tlRef.current;
    if (!tl) {
      setOpen(false);
      return;
    }
    tl.eventCallback("onReverseComplete", () => setOpen(false));
    tl.reverse();
  }

  function toggle() {
    if (open) {
      close();
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    tlRef.current?.kill();

    const items = itemsRef.current.filter(Boolean);
    gsap.set(panel, { height: 0, overflow: "hidden" });
    gsap.set(items, { y: 10, opacity: 0 });

    const tl = gsap.timeline();
    tl.to(panel, { height: "auto", duration: 0.18, ease });
    tl.to(items, { y: 0, opacity: 1, duration: 0.15, ease, stagger: 0.025 }, "-=0.08");
    tlRef.current = tl;

    setOpen(true);
  }

  // Un <select> nativo cierra solo al hacer click afuera o con Escape; este
  // reemplazo lo tiene que resolver a mano.
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function selectOption(v: string) {
    onChange(v);
    close();
  }

  itemsRef.current = [];

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={styles.triggerLabel}>{selected?.label ?? "—"}</span>
        <svg className={styles.chevron} viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        ref={panelRef}
        role="listbox"
        aria-label={ariaLabel}
      >
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            ref={(el) => {
              if (el) itemsRef.current[i] = el;
            }}
            role="option"
            aria-selected={o.value === value}
            className={`${styles.item} ${o.value === value ? styles.itemActive : ""}`}
            onClick={() => selectOption(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
