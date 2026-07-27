// Catálogo fijo de retos para el "castigo" semanal del último lugar. Vive en
// código (no en la base de datos) porque no cambia con frecuencia y así el
// dueño de la liga solo tiene que ELEGIR uno, no escribirlo. El id es lo que
// se guarda en WeeklyChallenge.challengeId; el texto se copia aparte para que
// un reto ya asignado no cambie de redacción si este catálogo se actualiza.
export interface WeeklyChallengeOption {
  id: string;
  text: string;
}

export const WEEKLY_CHALLENGES: WeeklyChallengeOption[] = [
  { id: "nombre-ridiculo", text: "Cambiar el nombre de su equipo por algo ridículo toda la semana" },
  { id: "foto-graciosa", text: "Poner de foto de perfil la selfie más chistosa que tenga" },
  { id: "invita-algo", text: "Invitar algo (pizza, refresco, lo que sea) en la próxima juntada del grupo" },
  { id: "once-del-grupo", text: "Jugar la próxima jornada con el once que arme el resto del grupo" },
  { id: "avatar-elegido", text: "Dejar que el resto del grupo le elija el avatar por una semana" },
  { id: "narrador", text: "Narrar en audio los goles de la próxima jornada como comentarista deportivo" },
  { id: "chiste-diario", text: "Contar un chiste malo en el chat del grupo cada día de la semana" },
  { id: "fichaje-obligado", text: "El ganador de la semana le elige su próximo fichaje obligatorio" },
  { id: "mayusculas", text: "Escribir todos sus mensajes en el chat del grupo en MAYÚSCULAS por 3 días" },
  { id: "defensa-publica", text: "Defender en el chat, con humor, por qué su equipo es el peor de la liga" },
  { id: "baile", text: "Grabar 10 segundos bailando y mandarlo al chat del grupo" },
  { id: "sin-emojis", text: "No poder usar ningún emoji en el chat del grupo por una semana" },
  { id: "firma-random", text: "Firmar cada mensaje del chat con un emoji random distinto" },
  { id: "cuenta-derrota", text: "Publicar una historia contando su peor jugada del once de esta jornada" },
];

export function findWeeklyChallenge(id: string): WeeklyChallengeOption | undefined {
  return WEEKLY_CHALLENGES.find((c) => c.id === id);
}

// Id reservado: cuando el dueño manda esto, el texto no sale del catálogo,
// lo escribió él mismo (ver POST /leagues/:id/challenge). Ningún id del
// catálogo puede valer "custom" — si algún día se agrega uno así, chocaría.
export const CUSTOM_CHALLENGE_ID = "custom";
