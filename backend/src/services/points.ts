// Motor de puntos fantasy a partir de datos reales de FotMob.
// Reglas (estilo FPL simplificado, defendibles en la presentación):
//   - Jugar el partido: +2
//   - Gol: POR/DEF +6, MED +5, DEL +4
//   - Asistencia: +3
//   - Bono por rendimiento (rating FotMob 6–10): round((rating-6)*2), acotado a [-2, +8]
export interface PointsInput {
  position: string; // POR | DEF | MED | DEL
  rating: number | null;
  goals: number;
  assists: number;
  minutes: number;
}

const GOAL_POINTS: Record<string, number> = { POR: 6, DEF: 6, MED: 5, DEL: 4 };

export function computePoints({ position, rating, goals, assists, minutes }: PointsInput): number {
  let pts = 0;
  if (minutes > 0) pts += 2;
  pts += goals * (GOAL_POINTS[position] ?? 4);
  pts += assists * 3;
  if (rating != null && rating > 0) {
    const bonus = Math.round((rating - 6) * 2);
    pts += Math.max(-2, Math.min(8, bonus));
  }
  return pts;
}
