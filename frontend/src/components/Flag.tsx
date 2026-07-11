import { useEffect, useRef, useState } from "react";
import { Team } from "../types";
import { IconShield } from "./icons";

// Si el escudo/bandera no carga en este tiempo (CDN lenta o bloqueada),
// se cae al icono de escudo en vez de dejar el hueco en blanco indefinidamente.
const IMG_TIMEOUT_MS = 6000;

// Selecciones internacionales sin logoUrl: usamos la bandera vía flagcdn.
const ISO: Record<string, string> = {
  "México": "mx",
  Argentina: "ar",
  Brasil: "br",
  Francia: "fr",
  "España": "es",
  Inglaterra: "gb-eng",
  Portugal: "pt",
  Alemania: "de",
};

export default function Flag({ team, size = 40 }: { team: Team | null | undefined; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const src = team?.logoUrl || (team?.flag && ISO[team.name] ? `https://flagcdn.com/w80/${ISO[team.name]}.png` : null);

  useEffect(() => {
    setImgFailed(false);
    if (!src) return;
    timeoutRef.current = setTimeout(() => setImgFailed(true), IMG_TIMEOUT_MS);
    return () => clearTimeout(timeoutRef.current);
  }, [src]);

  if (!team || !src || imgFailed) {
    return <IconShield size={size} aria-hidden="true" style={{ opacity: 0.6 }} />;
  }

  const isLogo = !!team.logoUrl;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={isLogo ? size : Math.round(size * 0.75)}
      style={{ borderRadius: 4, objectFit: isLogo ? "contain" : "cover", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}
      loading="lazy"
      decoding="async"
      onLoad={() => clearTimeout(timeoutRef.current)}
      onError={() => setImgFailed(true)}
    />
  );
}
