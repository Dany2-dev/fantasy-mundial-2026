import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V19a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function IconPack(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 8.5V16l9 4.5 9-4.5V8.5" />
      <path d="M12 13v7.5" />
    </svg>
  );
}

export function IconCards(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="7" width="12" height="15" rx="2" />
      <path d="M9 4.5 19 4.5a1 1 0 0 1 1 1v13" />
    </svg>
  );
}

export function IconBall(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.2 15.4 10.6 14.1 14.5H9.9L8.6 10.6Z" />
      <path d="M12 8.2V4.5M15.4 10.6l3.4-1.4M14.1 14.5l2 3.4M9.9 14.5l-2 3.4M8.6 10.6 5.2 9.2" />
    </svg>
  );
}

export function IconExchange(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h13.5M17.5 8 14 4.5M14 11.5 17.5 8" />
      <path d="M20 16H6.5M6.5 16 10 19.5M10 12.5 6.5 16" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4h10v5.5a5 5 0 0 1-10 0Z" />
      <path d="M7 5.5H4.5A2.5 2.5 0 0 0 4 9c.35 1.4 1.5 2.3 3 2.4M17 5.5h2.5A2.5 2.5 0 0 1 20 9c-.35 1.4-1.5 2.3-3 2.4" />
      <path d="M12 14.5V17M9 20h6" />
      <path d="M9.5 17h5l.6 3H8.9Z" />
    </svg>
  );
}

export function IconCoin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 9.7c0-1.2 1.1-2.2 2.5-2.2s2.5.8 2.5 1.9c0 2.6-5 1.5-5 4 0 1.2 1.1 2 2.5 2s2.5-.9 2.5-2" />
    </svg>
  );
}

export function IconStore(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12V22a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V12" />
      <path d="M2 7h20" />
      <path d="M10 12v4a2 2 0 0 0 4 0v-4" />
    </svg>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3" />
      <path d="M14.5 8 19 12l-4.5 4M19 12H9.5" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12.5 9.5 17 19 6.5" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6Z" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12h14.5M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3.5v3.5M16 3.5v3.5" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <path d="M15.5 6.2A3 3 0 1 1 16.8 12" />
      <path d="M17.5 14.7c2.4.5 3.9 2.4 4 5.3" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

export function IconGamepad(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 8.5h10a4.5 4.5 0 0 1 4.5 4.5v2a3 3 0 0 1-3 3c-1 0-1.6-.5-2.3-1.3l-1-1.2a2 2 0 0 0-1.5-.7h-3.4a2 2 0 0 0-1.5.7l-1 1.2C7.1 17.5 6.5 18 5.5 18a3 3 0 0 1-3-3v-2A4.5 4.5 0 0 1 7 8.5Z" />
      <path d="M9 12h-3M7.5 10.5v3" />
      <circle cx="16" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMore(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
