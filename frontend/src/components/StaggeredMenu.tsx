import { gsap } from "gsap";
import { CSSProperties, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./StaggeredMenu.module.css";

export interface StaggeredMenuItem {
  label: string;
  ariaLabel?: string;
  link: string;
}

export interface StaggeredMenuSocialItem {
  label: string;
  link: string;
}

interface CtaAction {
  label: string;
  href: string;
}

interface Props {
  position?: "left" | "right";
  colors?: string[];
  items?: StaggeredMenuItem[];
  socialItems?: StaggeredMenuSocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  className?: string;
  logo?: ReactNode;
  cta?: CtaAction;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  accentColor?: string;
  changeMenuColorOnOpen?: boolean;
  isFixed?: boolean;
  closeOnClickAway?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

// Selectores usados por GSAP para animar nodos internos — se arman con los
// nombres hasheados de CSS Modules para no depender de clases globales.
const SEL = {
  prelayer: `.${styles.smPrelayer}`,
  itemLabel: `.${styles.smPanelItemLabel}`,
  numberedItem: `.${styles.smPanelList}[data-numbering] .${styles.smPanelItem}`,
  socialsTitle: `.${styles.smSocialsTitle}`,
  socialsLink: `.${styles.smSocialsLink}`,
};

export default function StaggeredMenu({
  position = "right",
  colors = ["#B497CF", "#5227FF"],
  items = [],
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = true,
  className,
  logo,
  cta,
  menuButtonColor = "#fff",
  openMenuButtonColor = "#fff",
  accentColor = "#5227FF",
  changeMenuColorOnOpen = true,
  isFixed = false,
  closeOnClickAway = true,
  onMenuOpen,
  onMenuClose,
}: Props) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const preLayersRef = useRef<HTMLDivElement | null>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);
  const plusHRef = useRef<HTMLSpanElement | null>(null);
  const plusVRef = useRef<HTMLSpanElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const textInnerRef = useRef<HTMLSpanElement | null>(null);
  const [textLines, setTextLines] = useState(["Menú", "Cerrar"]);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
  const colorTweenRef = useRef<gsap.core.Tween | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;
      if (!panel || !plusH || !plusV || !icon || !textInner) return;

      const preLayers = preContainer ? Array.from(preContainer.querySelectorAll<HTMLElement>(SEL.prelayer)) : [];
      preLayerElsRef.current = preLayers;

      const offscreen = position === "left" ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen, opacity: 1 });
      if (preContainer) gsap.set(preContainer, { xPercent: 0, opacity: 1 });
      gsap.set(plusH, { transformOrigin: "50% 50%", rotate: 0 });
      gsap.set(plusV, { transformOrigin: "50% 50%", rotate: 90 });
      gsap.set(icon, { rotate: 0, transformOrigin: "50% 50%" });
      gsap.set(textInner, { yPercent: 0 });
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { color: menuButtonColor });
    });
    return () => ctx.revert();
  }, [menuButtonColor, position]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    closeTweenRef.current?.kill();
    closeTweenRef.current = null;

    const itemEls = Array.from(panel.querySelectorAll<HTMLElement>(SEL.itemLabel));
    const numberEls = Array.from(panel.querySelectorAll<HTMLElement>(SEL.numberedItem));
    const socialTitle = panel.querySelector<HTMLElement>(SEL.socialsTitle);
    const socialLinks = Array.from(panel.querySelectorAll<HTMLElement>(SEL.socialsLink));

    const offscreen = position === "left" ? -100 : 100;

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length) gsap.set(numberEls, { "--sm-num-opacity": 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    layers.forEach((el, i) => {
      tl.fromTo(el, { xPercent: offscreen }, { xPercent: 0, duration: 0.5, ease: "power4.out" }, i * 0.07);
    });
    const lastTime = layers.length ? (layers.length - 1) * 0.07 : 0;
    const panelInsertTime = lastTime + (layers.length ? 0.08 : 0);
    const panelDuration = 0.65;
    tl.fromTo(panel, { xPercent: offscreen }, { xPercent: 0, duration: panelDuration, ease: "power4.out" }, panelInsertTime);

    if (itemEls.length) {
      const itemsStart = panelInsertTime + panelDuration * 0.15;
      tl.to(
        itemEls,
        { yPercent: 0, rotate: 0, duration: 1, ease: "power4.out", stagger: { each: 0.1, from: "start" } },
        itemsStart
      );
      if (numberEls.length) {
        tl.to(
          numberEls,
          { duration: 0.6, ease: "power2.out", "--sm-num-opacity": 1, stagger: { each: 0.08, from: "start" } },
          itemsStart + 0.1
        );
      }
    }

    if (socialTitle || socialLinks.length) {
      const socialsStart = panelInsertTime + panelDuration * 0.4;
      if (socialTitle) tl.to(socialTitle, { opacity: 1, duration: 0.5, ease: "power2.out" }, socialsStart);
      if (socialLinks.length) {
        tl.to(
          socialLinks,
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            ease: "power3.out",
            stagger: { each: 0.08, from: "start" },
            onComplete: () => gsap.set(socialLinks, { clearProps: "opacity" }),
          },
          socialsStart + 0.04
        );
      }
    }

    openTlRef.current = tl;
    return tl;
  }, [position]);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback("onComplete", () => {
        busyRef.current = false;
      });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;

    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;

    closeTweenRef.current?.kill();
    const offscreen = position === "left" ? -100 : 100;
    closeTweenRef.current = gsap.to([...layers, panel], {
      xPercent: offscreen,
      duration: 0.32,
      ease: "power3.in",
      overwrite: "auto",
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll<HTMLElement>(SEL.itemLabel));
        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
        const numberEls = Array.from(panel.querySelectorAll<HTMLElement>(SEL.numberedItem));
        if (numberEls.length) gsap.set(numberEls, { "--sm-num-opacity": 0 });
        const socialTitle = panel.querySelector<HTMLElement>(SEL.socialsTitle);
        const socialLinks = Array.from(panel.querySelectorAll<HTMLElement>(SEL.socialsLink));
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
        busyRef.current = false;
      },
    });
  }, [position]);

  const animateIcon = useCallback((opening: boolean) => {
    const icon = iconRef.current;
    if (!icon) return;
    spinTweenRef.current?.kill();
    spinTweenRef.current = opening
      ? gsap.to(icon, { rotate: 225, duration: 0.8, ease: "power4.out", overwrite: "auto" })
      : gsap.to(icon, { rotate: 0, duration: 0.35, ease: "power3.inOut", overwrite: "auto" });
  }, []);

  const animateColor = useCallback(
    (opening: boolean) => {
      const btn = toggleBtnRef.current;
      if (!btn) return;
      colorTweenRef.current?.kill();
      if (changeMenuColorOnOpen) {
        const targetColor = opening ? openMenuButtonColor : menuButtonColor;
        colorTweenRef.current = gsap.to(btn, { color: targetColor, delay: 0.18, duration: 0.3, ease: "power2.out" });
      } else {
        gsap.set(btn, { color: menuButtonColor });
      }
    },
    [openMenuButtonColor, menuButtonColor, changeMenuColorOnOpen]
  );

  useEffect(() => {
    if (!toggleBtnRef.current) return;
    const targetColor = changeMenuColorOnOpen && openRef.current ? openMenuButtonColor : menuButtonColor;
    gsap.set(toggleBtnRef.current, { color: targetColor });
  }, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor]);

  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current;
    if (!inner) return;
    textCycleAnimRef.current?.kill();

    const currentLabel = opening ? "Menú" : "Cerrar";
    const targetLabel = opening ? "Cerrar" : "Menú";
    const seq = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < 3; i++) {
      last = last === "Menú" ? "Cerrar" : "Menú";
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);
    setTextLines(seq);

    gsap.set(inner, { yPercent: 0 });
    const finalShift = ((seq.length - 1) / seq.length) * 100;
    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.5 + seq.length * 0.07,
      ease: "power4.out",
    });
  }, []);

  const toggleMenu = useCallback(() => {
    const target = !openRef.current;
    openRef.current = target;
    setOpen(target);
    if (target) {
      onMenuOpen?.();
      playOpen();
    } else {
      onMenuClose?.();
      playClose();
    }
    animateIcon(target);
    animateColor(target);
    animateText(target);
  }, [playOpen, playClose, animateIcon, animateColor, animateText, onMenuOpen, onMenuClose]);

  const closeMenu = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    onMenuClose?.();
    playClose();
    animateIcon(false);
    animateColor(false);
    animateText(false);
  }, [playClose, animateIcon, animateColor, animateText, onMenuClose]);

  useEffect(() => {
    if (!closeOnClickAway || !open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeOnClickAway, open, closeMenu]);

  return (
    <div
      className={[styles.staggeredMenuWrapper, isFixed ? styles.fixedWrapper : "", className].filter(Boolean).join(" ")}
      style={accentColor ? ({ "--sm-accent": accentColor } as CSSProperties) : undefined}
      data-position={position}
      data-open={open || undefined}
    >
      <div ref={preLayersRef} className={styles.smPrelayers} aria-hidden="true">
        {(() => {
          const raw = colors.length ? colors.slice(0, 4) : ["#1e1e22", "#35353c"];
          const arr = [...raw];
          if (arr.length >= 3) arr.splice(Math.floor(arr.length / 2), 1);
          return arr.map((c, i) => <div key={i} className={styles.smPrelayer} style={{ background: c }} />);
        })()}
      </div>

      <header className={styles.staggeredMenuHeader} aria-label="Encabezado de navegación">
        <div className={styles.smLogo} aria-label="Logo">
          {logo}
        </div>
        <div className={styles.smHeaderEnd}>
          {cta && (
            <a href={cta.href} className={styles.smCta} onClick={() => closeMenu()}>
              {cta.label}
            </a>
          )}
          <button
            ref={toggleBtnRef}
            className={styles.smToggle}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="staggered-menu-panel"
            onClick={toggleMenu}
            type="button"
          >
            <span className={styles.smToggleTextWrap} aria-hidden="true">
              <span ref={textInnerRef} className={styles.smToggleTextInner}>
                {textLines.map((l, i) => (
                  <span className={styles.smToggleLine} key={i}>
                    {l}
                  </span>
                ))}
              </span>
            </span>
            <span ref={iconRef} className={styles.smIcon} aria-hidden="true">
              <span ref={plusHRef} className={styles.smIconLine} />
              <span ref={plusVRef} className={`${styles.smIconLine} ${styles.smIconLineV}`} />
            </span>
          </button>
        </div>
      </header>

      <aside id="staggered-menu-panel" ref={panelRef} className={styles.staggeredMenuPanel} aria-hidden={!open}>
        <div className={styles.smPanelInner}>
          <ul className={styles.smPanelList} role="list" data-numbering={displayItemNumbering || undefined}>
            {items.map((it, idx) => (
              <li className={styles.smPanelItemWrap} key={it.label + idx}>
                <a
                  className={styles.smPanelItem}
                  href={it.link}
                  aria-label={it.ariaLabel}
                  data-index={idx + 1}
                  onClick={() => closeMenu()}
                >
                  <span className={styles.smPanelItemLabel}>{it.label}</span>
                </a>
              </li>
            ))}
          </ul>
          {displaySocials && socialItems.length > 0 && (
            <div className={styles.smSocials} aria-label="Enlaces">
              <h3 className={styles.smSocialsTitle}>Enlaces</h3>
              <ul className={styles.smSocialsList} role="list">
                {socialItems.map((s, i) => (
                  <li key={s.label + i} className={styles.smSocialsItem}>
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className={styles.smSocialsLink}>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
