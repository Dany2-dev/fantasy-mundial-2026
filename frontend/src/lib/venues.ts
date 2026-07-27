import { Match, MatchVenue } from "../types";

// Estadio de cada club por su nombre de local. Sirve de respaldo mientras el
// back no exponga `venue` en GET /matches: en las ligas de clubes el local
// siempre juega en su casa, así que deducirlo es fiable. Los nombres cubren las
// variantes con las que llegan los equipos (FotMob y ESPN no los escriben igual).
const HOME_VENUES: Record<string, MatchVenue> = {
  // Liga MX
  "América": { name: "Estadio Banorte", city: "Ciudad de México" },
  "CF America": { name: "Estadio Banorte", city: "Ciudad de México" },
  "Club América": { name: "Estadio Banorte", city: "Ciudad de México" },
  Atlante: { name: "Estadio Banorte", city: "Ciudad de México" },
  Atlas: { name: "Estadio Jalisco", city: "Guadalajara" },
  "Atlético de San Luis": { name: "Estadio Alfonso Lastras", city: "San Luis Potosí" },
  "Atletico de San Luis": { name: "Estadio Alfonso Lastras", city: "San Luis Potosí" },
  "Cruz Azul": { name: "Estadio Olímpico Universitario", city: "Ciudad de México" },
  "FC Juárez": { name: "Estadio Olímpico Benito Juárez", city: "Ciudad Juárez" },
  "FC Juarez": { name: "Estadio Olímpico Benito Juárez", city: "Ciudad Juárez" },
  Guadalajara: { name: "Estadio Akron", city: "Guadalajara" },
  Chivas: { name: "Estadio Akron", city: "Guadalajara" },
  León: { name: "Estadio León", city: "León" },
  Leon: { name: "Estadio León", city: "León" },
  Mazatlán: { name: "Estadio El Encanto", city: "Mazatlán" },
  Monterrey: { name: "Estadio BBVA", city: "Monterrey" },
  Necaxa: { name: "Estadio Victoria", city: "Aguascalientes" },
  Pachuca: { name: "Estadio Hidalgo", city: "Pachuca" },
  Puebla: { name: "Estadio Cuauhtémoc", city: "Puebla" },
  "Pumas UNAM": { name: "Estadio Olímpico Universitario", city: "Ciudad de México" },
  Pumas: { name: "Estadio Olímpico Universitario", city: "Ciudad de México" },
  Querétaro: { name: "Estadio Corregidora", city: "Querétaro" },
  "Queretaro FC": { name: "Estadio Corregidora", city: "Querétaro" },
  Santos: { name: "Estadio Corona", city: "Torreón" },
  "Santos Laguna": { name: "Estadio Corona", city: "Torreón" },
  "Tigres UANL": { name: "Estadio Universitario", city: "San Nicolás de los Garza" },
  Tigres: { name: "Estadio Universitario", city: "San Nicolás de los Garza" },
  Tijuana: { name: "Estadio Caliente", city: "Tijuana" },
  Toluca: { name: "Estadio Nemesio Díez", city: "Toluca" },
};

/** Estadio del partido: el que mande el back y, si no llega, el del local. */
export function venueOf(m: Match): MatchVenue | null {
  return m.venue ?? HOME_VENUES[m.home.name] ?? null;
}
