import { useState } from "react";
import { Team } from "../types";
import { IconShield } from "./icons";

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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = team?.logoUrl || (team?.flag && ISO[team.name] ? `https://flagcdn.com/w80/${ISO[team.name]}.png` : null);

  if (!team || !src || failedSrc === src) {
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
      onError={() => setFailedSrc(src)}
    />
  );
}
