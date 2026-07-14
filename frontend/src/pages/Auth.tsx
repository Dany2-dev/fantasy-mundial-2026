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
    description: "Pon precio a tus cartas o ficha las de otros mánagers de tu liga en tiempo real.",
  },
  {
    Icon: IconClock,
    title: "Partidos reales",
    description: "Calendario, resultados y tabla general de la competencia que elegiste, cortesía de FotMob.",
  },
  {
    Icon: IconCards,
    title: "Historial completo",
    description: "Cada cláusula, cada venta, cada jornada — todo tu recorrido queda registrado.",
  },
];

type Mode = "login" | "register" | "forgot";

const COPY: Record<Mode, { title: string; description: string }> = {
  login: { title: "Inicia sesión", description: "Entra a tu club y sigue compitiendo con tus amigos." },
  register: { title: "Crea tu cuenta", description: "Únete y arranca con tu primer sobre gratis." },
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
        cta={{ label: "Entrar", href: "#acceso" }}
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
              sentence="Colecciona Intercambia Gana"
              borderColor="#e61d25"
              glowColor="rgba(230, 29, 37, 0.6)"
              animationDuration={0.5}
              pauseBetweenAnimations={1.2}
            />
          </h1>
          <p className={styles.subtitle}>
            El fantasy del Mundial 2026 donde cada carta tiene UN solo dueño por liga. Si tu
            amigo ya tiene a Mbappé… te toca negociar.
          </p>
          <div className={styles.heroActions}>
            <a href="#acceso" className={styles.ctaPrimary}>
              Crear cuenta gratis
              <span className={styles.arrow} aria-hidden="true">
                ↘
              </span>
            </a>
            <a href="#como-funciona" className={styles.ctaGhost}>
              Cómo funciona
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
        <span className={styles.eyebrow}>Explora</span>
        <h2 className={styles.domeHeading}>12 competencias reales</h2>
        <p className={styles.domeSubtitle}>Arrastra para rotar. Toca un escudo para verlo más grande.</p>
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
          Un club de verdad no se construye solo — <span className={styles.gold}>se disputa.</span>
        </p>
      </FadeUp>

      {/* ===== Features alternadas ===== */}
      <div id="sobres">
        <FeatureBlock
          eyebrow="Sobres"
          title="Abre sobres, arma tu plantilla"
          description="Bronce, Plata u Oro: cada sobre trae cartas al azar con jugadores reales de la competencia que elegiste. Tú decides cuándo arriesgar tus monedas."
          visual={
            <div className={styles.packVisual}>
              <img src="/packs/oro.png" alt="" />
            </div>
          }
        />
      </div>

      <div id="ligas">
        <FeatureBlock
          eyebrow="Ligas privadas"
          title="Un solo dueño por carta, por liga"
          description="Crea una liga con tus amigos y elige la competencia real que van a jugar. Si alguien ya tiene a tu jugador favorito, te toca negociar o esperar tu turno en el mercado."
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
          title="Compra, vende, negocia"
          description="Pon una carta en venta o dispara un clausulazo directo. Cada movimiento pasa por tus monedas — nada se regala."
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
        title="Protege a tus cracks"
        description="Cuando fichas o clausulas a un jugador, tiene una semana de protección antes de que alguien más pueda clausularlo. Súbele la cláusula si sabes que te lo quieren quitar."
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
        title="Tu formación, tu estrategia"
        description="Acomoda tu once titular, elige a tu capitán (puntos x2) y súmale puntos reales según cómo rindan tus jugadores en la vida real."
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
            <span className={styles.eyebrow}>Empieza hoy</span>
            <h2 className={styles.finalTitle}>
              Tu club te está esperando <span className={styles.gold}>↘</span>
            </h2>
            <p className={styles.finalSubtitle}>
              15,000 monedas de bienvenida, datos reales de 12 competencias, y un primer sobre
              gratis en cuanto te unas a tu primera liga.
            </p>
            <div className={styles.finalStats}>
              <span className={styles.chip}>
                <IconCoin size={16} /> 15,000 monedas
              </span>
              <span className={styles.chip}>
                <IconPack size={16} /> Sobre gratis
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
                      "Entrar"
                    ) : (
                      <span className={styles.submitLabel}>
                        Crear cuenta y recibir 15,000 <IconCoin size={16} />
                      </span>
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
            <p className={styles.footerTagline}>El fantasy del Mundial 2026, con datos reales.</p>
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
          <span>© 2026 Fantasy Mundial 2026 — proyecto escolar, no afiliado a la FIFA.</span>
        </div>
      </footer>
    </div>
  );
}
