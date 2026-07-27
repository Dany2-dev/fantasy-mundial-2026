import { prisma } from "../lib/prisma";
import { gwLabel } from "../lib/rounds";

export interface CurrentGameweek {
  number: number;
  label: string;
  deadline: Date;
  status: string;
}

// Misma jornada que currentGameweek, pero como fila cruda de Prisma (con su
// `id` interno). currentGameweek no lo expone porque es un detalle de
// implementación que el resto del código no necesita — salvo el reto semanal,
// que sí necesita el id real para la relación WeeklyChallenge -> Gameweek.
async function currentGameweekRow(competitionId: number) {
  const upcoming = await prisma.gameweek.findFirst({
    where: { competitionId, status: "upcoming" },
    orderBy: { number: "asc" },
  });
  return upcoming ?? (await prisma.gameweek.findFirst({ where: { competitionId }, orderBy: { number: "desc" } }));
}

// La próxima jornada sin jugar (por deadline); si la temporada ya terminó,
// devuelve la última jugada. null si la competencia aún no tiene calendario.
export async function currentGameweek(competitionId: number): Promise<CurrentGameweek | null> {
  const gw = await currentGameweekRow(competitionId);
  if (!gw) return null;
  return { number: gw.number, label: gwLabel(gw.number), deadline: gw.deadline, status: gw.status };
}

export async function currentGameweekId(competitionId: number): Promise<number | null> {
  const gw = await currentGameweekRow(competitionId);
  return gw?.id ?? null;
}
