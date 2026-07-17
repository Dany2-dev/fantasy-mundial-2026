// Umbral de "crack" (élite) DINÁMICO por competencia: el top ~4% del pool por
// rating. Una constante fija (p.ej. 85+) no funciona en todas las competencias:
// Liga MX topa en 81 y MLS en 83, así que con un corte fijo nunca saldría un
// crack ahí. Con el top 4% relativo, cada competencia tiene sus propias
// estrellas, sin importar su techo absoluto de rating.
import { prisma } from "../lib/prisma";

const ELITE_FRACTION = 0.04;
const ELITE_MIN_COUNT = 3;

export async function eliteThreshold(competitionId: number, fraction: number = ELITE_FRACTION): Promise<number> {
  const total = await prisma.player.count({ where: { competitionId } });
  if (total === 0) return Infinity;
  const take = Math.max(ELITE_MIN_COUNT, Math.ceil(total * fraction));
  const rows = await prisma.player.findMany({
    where: { competitionId },
    orderBy: { rating: "desc" },
    take,
    select: { rating: true },
  });
  return rows.length ? rows[rows.length - 1].rating : Infinity;
}
