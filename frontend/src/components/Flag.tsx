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

export default function Flag({ team, size = 40 }: { team: Team; size?: number }) {
  if (team.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 4, objectFit: "contain", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}
        loading="lazy"
      />
    );
  }

  const iso = team.flag ? ISO[team.name] : undefined;
  if (!iso) {
    return <IconShield size={size} aria-hidden="true" style={{ opacity: 0.6 }} />;
  }
  return (
    <img
      src={`https://flagcdn.com/w80/${iso}.png`}
      alt=""
      width={size}
      height={Math.round(size * 0.75)}
      style={{ borderRadius: 4, objectFit: "cover", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}
      loading="lazy"
    />
  );
}
