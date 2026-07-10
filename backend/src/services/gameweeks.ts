import { prisma } from "../lib/prisma";
import { gwLabel } from "../lib/rounds";

export interface CurrentGameweek {
  number: number;
  label: string;
  deadline: Date;
  status: string;
}

// La próxima jornada sin jugar (por deadline); si la temporada ya terminó,
// devuelve la última jugada. null si la competencia aún no tiene calendario.
export async function currentGameweek(competitionId: number): Promise<CurrentGameweek | null> {
  const upcoming = await prisma.gameweek.findFirst({
    where: { competitionId, status: "upcoming" },
    orderBy: { number: "asc" },
  });
  const gw = upcoming ?? (await prisma.gameweek.findFirst({ where: { competitionId }, orderBy: { number: "desc" } }));
  if (!gw) return null;
  return { number: gw.number, label: gwLabel(gw.number), deadline: gw.deadline, status: gw.status };
}
