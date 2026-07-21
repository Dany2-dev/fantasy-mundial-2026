// Foto de fondo del estadio según el equipo local del partido.
// La DB aún no expone el venue real (GET /matches no trae estadio), así que
// se aproxima con las fotos reales que ya viven en /public/stadium/; cuando
// el back agregue `venue` al shape, este mapa se cambia por nombre de estadio.
const BY_HOME_TEAM: Record<string, string> = {
  // Liga MX
  Guadalajara: "/stadium/stadium-akron.jpg",
  Chivas: "/stadium/stadium-akron.jpg",
  // Clubes europeos con foto real disponible
  Milan: "/stadium/stadium-sansiro.jpg",
  Inter: "/stadium/stadium-sansiro.jpg",
  Benfica: "/stadium/stadium-benfica.jpg",
};

const DEFAULT_STADIUM = "/brand/estadio-bn.avif";
const NIGHT_STADIUM = "/stadium/stadium-night.jpg";

export function stadiumPhotoFor(homeTeamName: string, utcTime?: string | null): string {
  const exact = BY_HOME_TEAM[homeTeamName];
  if (exact) return exact;
  // Partidos nocturnos (hora local 19+) usan la toma de noche para variar el hero.
  if (utcTime) {
    const hour = new Date(utcTime).getHours();
    if (hour >= 19 || hour < 5) return NIGHT_STADIUM;
  }
  return DEFAULT_STADIUM;
}
