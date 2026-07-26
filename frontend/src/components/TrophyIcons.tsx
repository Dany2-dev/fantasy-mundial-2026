// Iconos SVG de los premios individuales de Tu Leyenda. Las competiciones
// (ligas, copas, Champions…) usan su logo real de FotMob; estos dibujos son
// para lo que no tiene logo oficial: bota de oro, balón de oro, guante y
// menciones. Trazo dorado, coherentes entre sí y con el set de `icons.tsx`.
import { SVGProps } from "react";
import { TrophyIcon } from "../lib/careerTrophies";

type Props = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 22, ...props }: Props) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

/** Copa clásica de dos asas. */
export function IconTrophyCup(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5H4.5a2.5 2.5 0 0 0 2.5 4.5" />
      <path d="M17 5h2.5a2.5 2.5 0 0 1-2.5 4.5" />
      <path d="M12 14v3" />
      <path d="M9 20h6l-.6-3H9.6z" />
    </svg>
  );
}

/** Bota de oro: máximo goleador. */
export function IconGoldenBoot(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h4l2.5 3.5H15a5 5 0 0 1 5 5V17H4z" />
      <path d="M4 17h16v2H4z" />
      <path d="M8 7v3.5" />
      <path d="M12.5 11.5v2" />
      <path d="M16 12.5v1.5" />
    </svg>
  );
}

/** Balón de oro: el premio mayor. */
export function IconGoldenBall(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="9.5" r="5.5" />
      <path d="M12 6.2l2.2 1.6-.85 2.6h-2.7l-.85-2.6z" />
      <path d="M9 20h6l-.6-3H9.6z" />
      <path d="M12 15v2" />
    </svg>
  );
}

/** Guante de oro: mejor portero. */
export function IconGoldenGlove(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M6 10V6.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M9 9.5V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M12 9.5V6a1.5 1.5 0 0 1 3 0v4" />
      <path d="M15 10V8a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6H10a4 4 0 0 1-4-4v-3" />
    </svg>
  );
}

/** Estrella: menciones y once ideal. */
export function IconAwardStar(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z" />
    </svg>
  );
}

export function TrophyGlyph({ icon, size = 22, ...rest }: Props & { icon: TrophyIcon }) {
  switch (icon) {
    case "boot":
      return <IconGoldenBoot size={size} {...rest} />;
    case "ball":
      return <IconGoldenBall size={size} {...rest} />;
    case "glove":
      return <IconGoldenGlove size={size} {...rest} />;
    case "star":
      return <IconAwardStar size={size} {...rest} />;
    default:
      return <IconTrophyCup size={size} {...rest} />;
  }
}
