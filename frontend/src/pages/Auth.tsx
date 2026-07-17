import { Player as RemotionPlayer } from "@remotion/player";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { IconCards, IconClock, IconCoin, IconExchange, IconPack, IconShield } from "../components/icons";
import DomeGallery from "../components/landing/DomeGallery";
import FeatureBlock from "../components/landing/FeatureBlock";
import HowItWorks from "../components/landing/HowItWorks";
import Marquee from "../components/landing/Marquee";
import StatsPinned from "../components/landing/StatsPinned";
import TrueFocus from "../components/landing/TrueFocus";
import PlayerCard from "../components/PlayerCard";
import SpotlightField from "../components/SpotlightField";
import StaggeredMenu from "../components/StaggeredMenu";
import PackTeaser, { PACK_TEASER_FPS, PACK_TEASER_HEIGHT, PACK_TEASER_WIDTH, PACK_TEASER_DURATION } from "../remotion/PackTeaser";
import { login, register } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Player } from "../types";
import styles from "./Auth.module.css";

gsap.registerPlugin(ScrollTrigger);

// Elenco de demo para las secciones de marketing: cada uno en un rango
// distinto (legendario/oro/plata/bronce) para mostrar el sistema de cartas.
// fotmobId de cada foto verificado a mano contra images.fotmob.com (algunos
// IDs viejos ya no resuelven ahí y devuelven 403 en vez de la foto real).
const DEMO_SQUAD: Player[] = [
  {
    id: 0,
    name: "Kylian Mbappé",
    position: "DEL",
    rating: 91,
    basePrice: 10920,
    photoUrl: "https://images.fotmob.com/image_resources/playerimages/701154.png",
    teamId: 0,
    team: { id: 0, name: "Francia", logoUrl: null, flag: "FR" },
  },
  {
    id: 1,
    name: "Pedri González",
    position: "MED",
    rating: 87,
    basePrice: 8200,
    photoUrl: "https://images.fotmob.com/image_resources/playerimages/1083323.png",
    teamId: 1,
    team: { id: 1, name: "España", logoUrl: null, flag: "ES" },
  },
  {
    id: 2,
    name: "Alphonso Davies",
    position: "DEF",
    rating: 81,
    basePrice: 5100,
    photoUrl: "https://images.fotmob.com/image_resources/playerimages/751202.png",
    teamId: 2,
    team: { id: 2, name: "Canadá", logoUrl: null, flag: "CA" },
  },
  {
    id: 3,
    name: "Carlos Acevedo",
    position: "POR",
    rating: 74,
    basePrice: 2300,
    photoUrl: "https://images.fotmob.com/image_resources/playerimages/751164.png",
    teamId: 3,
    team: { id: 3, name: "México", logoUrl: null, flag: "MX" },
  },
];

// Catálogo real (mismos fotmobId que backend/src/lib/catalog.ts) para mostrar
// escudos y nombres reales de competencias sin necesitar sesión iniciada.
const LEAGUES = [
  { id: 77, name: "Mundial" },
  { id: 230, name: "Liga MX" },
  { id: 47, name: "Premier League" },
  { id: 87, name: "LaLiga" },
  { id: 55, name: "Serie A" },
  { id: 54, name: "Bundesliga" },
  { id: 53, name: "Ligue 1" },
  { id: 42, name: "Champions League" },
  { id: 130, name: "MLS" },
  { id: 61, name: "Liga Portugal" },
  { id: 57, name: "Eredivisie" },
  { id: 268, name: "Brasileirão" },
];
const leagueLogo = (id: number) => `https://images.fotmob.com/image_resources/logo/leaguelogo/${id}.png`;

const MENU_ITEMS = [
  { label: "Inicio", ariaLabel: "Ir al inicio", link: "#top" },
  { label: "Sobres", ariaLabel: "Ver cómo funcionan los sobres", link: "#sobres" },
  { label: "Ligas", ariaLabel: "Ver ligas privadas", link: "#ligas" },
  { label: "Mercado", ariaLabel: "Ver el mercado de fichajes", link: "#mercado" },
  { label: "Cómo funciona", ariaLabel: "Ver cómo funciona todo el sistema", link: "#como-funciona" },
];

const PRODUCT_CARDS = [
  {
    Icon: IconExchange,
    title: "Mercado en vivo",
    description: "Pon una carta a la venta, manda ofertas y busca el fichaje que puede cambiar tu liga.",
  },
  {
    Icon: IconClock,
    title: "El fútbol real manda",
    description: "Sigue el calendario, los resultados y la tabla de tu competencia con datos de FotMob.",
  },
  {
    Icon: IconCards,
    title: "Tu historia, jugada a jugada",
    description: "Jornadas y tratos: cada fichaje y cada punto quedan en tu historial.",
  },
];

type Mode = "login" | "register" | "forgot";

const COPY: Record<Mode, { title: string; description: string }> = {
  login: { title: "Vuelve al juego", description: "Tu club te espera. Sigue fichando, negociando y compitiendo." },
  register: { title: "Crea tu club", description: "Regístrate, entra a una liga y recibe tus primeras 11 cartas." },
  forgot: { title: "Recuperar acceso", description: "Te mandamos instrucciones para poner una contraseña nueva." },
};

function FadeUp({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 80%", toggleActions: "play none none reverse" },
          }
        );
      });
      return () => mm.revert();
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export default function Auth() {
  const dispatch = useAppDispatch();
  const { user, status, error } = useAppSelector((s) => s.auth);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "login") dispatch(login({ email, password }));
    else if (mode === "register") dispatch(register({ name, email, password }));
  }

  function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    // Aún no hay backend de recuperación por correo: por ahora solo confirmamos
    // en la UI para no dejar el flujo cortado a medias.
    setForgotSent(true);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setForgotSent(false);
  }

  return (
    <div id="top" className={styles.page}>
      {/* ===== Navegación (StaggeredMenu) ===== */}
      <StaggeredMenu
        position="left"
        isFixed
        items={MENU_ITEMS}
        displaySocials={false}
        displayItemNumbering
        colors={["var(--noche)", "var(--wc-rojo)"]}
        accentColor="var(--wc-rojo)"
        menuButtonColor="rgba(255,255,255,0.85)"
        openMenuButtonColor="rgba(255,255,255,0.85)"
        changeMenuColorOnOpen={false}
        logo={
          <span className={styles.logo}>
            FM<span className={styles.logoYear}>26</span>
          </span>
        }
        cta={{ label: "Entrar a mi club", href: "#acceso" }}
      />

      {/* ===== Hero ===== */}
      <section className={styles.hero}>
        <div className={styles.veil}>
          <video className={styles.heroVideo} autoPlay loop muted playsInline>
            <source src="/video/hero-training.mp4" type="video/mp4" />
          </video>
        </div>
        <div className={styles.heroInner}>
          <div className={styles.heroCard}>
            <PlayerCard player={DEMO_SQUAD[0]} />
          </div>
          <h1 className={styles.title}>
            <TrueFocus
              sentence="Ficha Negocia Domina"
              borderColor="#e61d25"
              glowColor="rgba(230, 29, 37, 0.6)"
              animationDuration={0.5}
              pauseBetweenAnimations={1.2}
            />
          </h1>
          <p className={styles.subtitle}>
            Los cracks no se repiten: cada carta tiene un solo dueño por liga. ¿Quieres a Mbappé?
            Toca negociar… o paga su cláusula.
          </p>
          <div className={styles.heroActions}>
            <a href="#acceso" className={styles.ctaPrimary}>
              Crear mi club gratis
              <span className={styles.arrow} aria-hidden="true">
                ↘
              </span>
            </a>
            <a href="#como-funciona" className={styles.ctaGhost}>
              Ver cómo se juega
            </a>
          </div>
          <div className={styles.heroLeagues} aria-label="Competencias reales disponibles">
            {LEAGUES.map((l) => (
              <img key={l.id} src={leagueLogo(l.id)} alt={l.name} title={l.name} loading="lazy" />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Stats con scroll pinned ===== */}
      <StatsPinned />

      {/* ===== Marquee ===== */}
      <Marquee items={LEAGUES.map((l) => l.name)} />

      {/* ===== Dome de competencias ===== */}
      <section className={styles.domeSection}>
        <span className={styles.eyebrow}>Elige tu reto</span>
        <h2 className={styles.domeHeading}>12 competencias para hacer historia</h2>
        <p className={styles.domeSubtitle}>Arrastra para explorar y toca un escudo para verlo de cerca.</p>
        <div className={styles.domeWrap}>
          <DomeGallery
            images={LEAGUES.map((l) => ({ src: leagueLogo(l.id), alt: l.name }))}
            grayscale={false}
            overlayBlurColor="#0b1220"
            minRadius={280}
            fit={0.6}
            segments={16}
            autoRotate
            autoRotateSpeed={5}
          />
        </div>
      </section>

      {/* ===== Frase destacada ===== */}
      <FadeUp className={styles.quoteSection}>
        <span className={styles.logoWatermark}>
          FM<span className={styles.logoYear}>26</span>
        </span>
        <p className={styles.quote}>
          Los cracks no se regalan. <span className={styles.gold}>Se fichan.</span>
        </p>
      </FadeUp>

      {/* ===== Features alternadas ===== */}
      <div id="sobres">
        <FeatureBlock
          eyebrow="Sobres"
          title="Tu próximo fichaje puede estar aquí"
          description="Abre un sobre Bronce, Plata u Oro y descubre qué jugadores se suman a tu club. Cada moneda puede cambiar tu once."
          visual={
            <div className={styles.packVisual}>
              <RemotionPlayer
                component={PackTeaser}
                inputProps={{ packArt: "/packs/oro.png", card: DEMO_SQUAD[0] }}
                durationInFrames={PACK_TEASER_DURATION}
                fps={PACK_TEASER_FPS}
                compositionWidth={PACK_TEASER_WIDTH}
                compositionHeight={PACK_TEASER_HEIGHT}
                style={{ width: "100%" }}
                controls={false}
                clickToPlay={false}
                initiallyMuted
                loop
                autoPlay
              />
            </div>
          }
        />
      </div>

      <div id="ligas">
        <FeatureBlock
          eyebrow="Ligas privadas"
          title="En tu liga, cada crack tiene un solo dueño"
          description="Crea una liga con tus amigos y elige la competencia. Si alguien ya fichó a tu favorito, negocia… o prepara el clausulazo."
          reverse
          visual={
            <div className={styles.singleCard}>
              <PlayerCard player={DEMO_SQUAD[0]} ownerName="Daniel" size="sm" />
            </div>
          }
        />
      </div>

      <div id="mercado">
        <FeatureBlock
          eyebrow="Mercado"
          title="El mercado no espera"
          description="Pon precio, escucha ofertas o ve directo al clausulazo. Cada movimiento pone en juego tus monedas y tu estrategia."
          visual={
            <div className={styles.tradeVisual}>
              <PlayerCard player={DEMO_SQUAD[1]} size="sm" />
              <IconExchange size={28} className={styles.tradeIcon} />
              <PlayerCard player={DEMO_SQUAD[2]} size="sm" />
            </div>
          }
        />
      </div>

      <FeatureBlock
        eyebrow="Cláusulas"
        title="Blinda a tus cracks"
        description="Después de fichar o clausular a un jugador, queda protegido 7 días. Sube su cláusula antes de que un rival venga por él."
        reverse
        visual={
          <div className={styles.clauseVisual}>
            <PlayerCard player={DEMO_SQUAD[0]} size="sm" />
            <span className={styles.clauseChip}>
              <IconShield size={14} /> Protegida 7 días
            </span>
          </div>
        }
      />

      <FeatureBlock
        eyebrow="Mi Once"
        title="Tu once. Tu estrategia. Tus puntos."
        description="Elige titulares y nombra a tu capitán para puntuar x2. Lo que hagan en los partidos reales suma para ti."
        visual={
          <div className={styles.squadCollage}>
            {DEMO_SQUAD.map((p, i) => (
              <div key={p.id} className={styles.squadCard} style={{ "--i": i } as React.CSSProperties}>
                <PlayerCard player={p} size="sm" />
              </div>
            ))}
          </div>
        }
      />

      {/* ===== Cómo funciona ===== */}
      <div id="como-funciona">
        <HowItWorks />
      </div>

      {/* ===== Tarjetas de producto ===== */}
      <section className={styles.productSection}>
        <div className={styles.productInner}>
          {PRODUCT_CARDS.map(({ Icon, title, description }) => (
            <div key={title} className={styles.productCard}>
              <span className={styles.productIcon}>
                <Icon size={24} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA final + formulario de acceso ===== */}
      <section id="acceso" className={styles.finalSection}>
        <div className={styles.finalInner}>
          <div className={styles.finalPitch}>
            <span className={styles.eyebrow}>Tu turno</span>
            <h2 className={styles.finalTitle}>
              Arma tu club <span className={styles.finalHighlight}>antes</span> que tus amigos
            </h2>
            <p className={styles.finalSubtitle}>
              Recibe 15,000 monedas y 11 cartas gratis al unirte a tu primera liga. Elige entre 12
              competencias y ficha antes que el resto.
            </p>
            <div className={styles.finalStats}>
              <span className={styles.chip}>
                <IconCoin size={16} /> 15,000 monedas
              </span>
              <span className={styles.chip}>
                <IconPack size={16} /> 11 cartas gratis
              </span>
            </div>
          </div>

          <section className={styles.panel}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{COPY[mode].title}</h2>
              <p className={styles.cardDescription}>{COPY[mode].description}</p>
            </div>

            <div className={styles.cardContent}>
              {mode === "forgot" ? (
                forgotSent ? (
                  <div className={styles.forgotSent}>
                    <p>
                      Si <strong>{forgotEmail}</strong> tiene una cuenta con nosotros, le llegarán las
                      instrucciones en unos minutos.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit} className={styles.form}>
                    <SpotlightField label="Email">
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="tu@email.com"
                        required
                      />
                    </SpotlightField>
                    <button className={`primary ${styles.submitBtn}`} type="submit">
                      Enviar instrucciones
                      <span className={styles.btnGlow} aria-hidden="true" />
                    </button>
                  </form>
                )
              ) : (
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

                  {mode === "login" && (
                    <button
                      type="button"
                      className={`${styles.linkBtn} ${styles.forgotLink}`}
                      onClick={() => switchMode("forgot")}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}

                  {error && <p className="error-text">{error}</p>}

                  <button className={`primary ${styles.submitBtn}`} type="submit" disabled={status === "loading"}>
                    {status === "loading" ? (
                      "Un momento…"
                    ) : mode === "login" ? (
                      "Entrar a mi club"
                    ) : (
                      "Crear mi club"
                    )}
                    <span className={styles.btnGlow} aria-hidden="true" />
                  </button>
                </form>
              )}
            </div>

            <div className={styles.cardFooter}>
              {mode === "forgot" ? (
                <p className={styles.switch}>
                  <button type="button" className={styles.linkBtn} onClick={() => switchMode("login")}>
                    ← Volver a iniciar sesión
                  </button>
                </p>
              ) : (
                <p className={styles.switch}>
                  {mode === "login" ? (
                    <>
                      ¿No tienes cuenta?{" "}
                      <button type="button" className={styles.linkBtn} onClick={() => switchMode("register")}>
                        Crear cuenta
                      </button>
                    </>
                  ) : (
                    <>
                      ¿Ya tienes cuenta?{" "}
                      <button type="button" className={styles.linkBtn} onClick={() => switchMode("login")}>
                        Inicia sesión
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          </section>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerCol}>
            <span className={styles.logo}>
              FM<span className={styles.logoYear}>26</span>
            </span>
            <p className={styles.footerTagline}>El fantasy donde cada crack tiene un solo dueño.</p>
          </div>
          <div className={styles.footerCol}>
            <h4>Producto</h4>
            <a href="#sobres">Sobres</a>
            <a href="#ligas">Ligas privadas</a>
            <a href="#mercado">Mercado</a>
          </div>
          <div className={styles.footerCol}>
            <h4>Proyecto</h4>
            <span>Diseño de Interfaces 8C</span>
            <a href="https://github.com/Dany2-dev/fantasy-mundial-2026" target="_blank" rel="noreferrer">
              Repositorio en GitHub
            </a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Fantasy Mundial 2026. Proyecto escolar, no afiliado a la FIFA.</span>
        </div>
      </footer>
    </div>
  );
}
