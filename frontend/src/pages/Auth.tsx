import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import DarkVeil from "../components/DarkVeil";
import PlayerCard from "../components/PlayerCard";
import { IconCoin } from "../components/icons";
import SpotlightField from "../components/SpotlightField";
import { login, register } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player } from "../types";
import styles from "./Auth.module.css";

const DEMO_CARD: Player = {
  id: 0,
  name: "Kylian Mbappé",
  position: "DEL",
  rating: 91,
  basePrice: 10920,
  photoUrl: "https://images.fotmob.com/image_resources/playerimages/787761.png",
  teamId: 0,
  team: { id: 0, name: "Francia", logoUrl: null, flag: "FR" },
};

export default function Auth() {
  const dispatch = useAppDispatch();
  const { user, status, error } = useAppSelector((s) => s.auth);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) return <Navigate to="/" replace />;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "login") dispatch(login({ email, password }));
    else dispatch(register({ name, email, password }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.veil}>
        <DarkVeil />
      </div>

      <section className={styles.hero}>
        <div className={styles.heroCard}>
          <PlayerCard player={DEMO_CARD} />
        </div>
        <h1 className={styles.title}>
          Colecciona. Intercambia. <span className={styles.gold}>Gana.</span>
        </h1>
        <p className={styles.subtitle}>
          El fantasy del Mundial 2026 donde cada carta tiene UN solo dueño por liga. Si tu
          amigo ya tiene a Mbappé… te toca negociar.
        </p>
      </section>

      <section className={styles.panel}>
        <h2>{mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === "register" && (
            <SpotlightField label="Nombre">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como te verán en tu liga"
                required
                minLength={2}
              />
            </SpotlightField>
          )}
          <SpotlightField label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </SpotlightField>
          <SpotlightField label="Contraseña">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </SpotlightField>

          {error && <p className="error-text">{error}</p>}

          <button className={`primary ${styles.submitBtn}`} type="submit" disabled={status === "loading"}>
            {status === "loading" ? (
              "Un momento…"
            ) : mode === "login" ? (
              "Entrar"
            ) : (
              <span className={styles.submitLabel}>
                Crear cuenta y recibir 15,000 <IconCoin size={16} />
              </span>
            )}
            <span className={styles.btnGlow} aria-hidden="true" />
          </button>
        </form>

        <p className={styles.switch}>
          {mode === "login" ? (
            <>
              ¿No tienes cuenta?{" "}
              <button type="button" className={styles.linkBtn} onClick={() => setMode("register")}>
                Crear cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <button type="button" className={styles.linkBtn} onClick={() => setMode("login")}>
                Inicia sesión
              </button>
            </>
          )}
        </p>
      </section>
    </div>
  );
}
