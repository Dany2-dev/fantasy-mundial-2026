import { Country } from "../types";

// Windows no renderiza emojis de banderas; usamos imágenes con el emoji de respaldo.
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

export default function Flag({ country, size = 40 }: { country: Country; size?: number }) {
  const iso = ISO[country.name];
  if (!iso) {
    return (
      <span style={{ fontSize: size * 0.8, lineHeight: 1 }} aria-hidden="true">
        {country.flag}
      </span>
    );
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
