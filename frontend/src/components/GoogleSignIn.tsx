// Botón oficial de "Iniciar sesión con Google" (Google Identity Services).
//
// El script se carga bajo demanda y solo si el backend tiene configurado un
// GOOGLE_CLIENT_ID: sin él no hay nada que dibujar, y pintar un botón que
// siempre falla es peor que no ofrecerlo. Google renderiza el botón dentro del
// div que le pasamos, así que el estilo viene de ellos (es requisito de su
// política de marca; no se puede maquetar uno propio con su logo).

import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { loginWithGoogle } from "../store/authSlice";
import { useAppDispatch } from "../store/store";
import styles from "./GoogleSignIn.module.css";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleAccounts {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, o: Record<string, string | number>): void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

/** Carga el SDK de Google una sola vez, aunque el componente se remonte. */
function loadScript(): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return existing.dataset.loaded === "1"
      ? Promise.resolve()
      : new Promise((ok, fail) => {
          existing.addEventListener("load", () => ok());
          existing.addEventListener("error", () => fail(new Error("No se pudo cargar Google")));
        });
  }
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", () => {
      s.dataset.loaded = "1";
      ok();
    });
    s.addEventListener("error", () => fail(new Error("No se pudo cargar Google")));
    document.head.appendChild(s);
  });
}

export default function GoogleSignIn({ label = "signin_with" }: { label?: "signin_with" | "signup_with" }) {
  const dispatch = useAppDispatch();
  const holder = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ clientId: string | null }>("/auth/google/config")
      .then((d) => alive && setClientId(d.clientId))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !holder.current) return;
    let alive = true;

    loadScript()
      .then(() => {
        if (!alive || !holder.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => {
            dispatch(loginWithGoogle(r.credential));
          },
        });
        window.google.accounts.id.renderButton(holder.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: label,
          shape: "pill",
          logo_alignment: "center",
          width: 320,
        });
      })
      .catch(() => alive && setFailed(true));

    return () => {
      alive = false;
    };
  }, [clientId, dispatch, label]);

  // Sin client id configurado no se muestra nada: el acceso por email sigue ahí.
  if (!clientId && !failed) return null;
  if (failed) {
    return <p className={`caption ${styles.failed}`}>El acceso con Google no está disponible ahora mismo.</p>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.divider}>
        <span>o</span>
      </div>
      <div ref={holder} className={styles.button} />
    </div>
  );
}
