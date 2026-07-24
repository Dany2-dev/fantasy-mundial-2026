// Capa narrativa de Tu Leyenda: convierte los números que produce el motor
// (goles, OVR, títulos) en la historia que lee el jugador. Está separada del
// motor a propósito — el motor decide QUÉ pasó, esto decide CÓMO se cuenta.

import { PitchPosition } from "./careerData";

export interface StageOutcome {
  ageFrom: number;
  ageTo: number;
  clubName: string;
  pj: number;
  gls: number;
  ast: number;
  ovrBefore: number;
  ovrAfter: number;
  /** Rendimiento vs. lo esperado para tu posición y nivel: <0.8 flojo, >1.25 crack. */
  performance: number;
  starter: boolean;
  trophies: string[];
  awards: string[];
  milestones: string[];
  injured: boolean;
}

const ATTACKERS: PitchPosition[] = ["DC", "EI", "ED", "MCO"];
const DEFENSIVE: PitchPosition[] = ["POR", "DFC", "LI", "LD", "MCD"];

// Titular en Vietnam: la frase de rendimiento cambia según qué tan por encima
// (o debajo) quedaste de lo que se esperaba de vos en ese puesto.
function performancePhrase(o: StageOutcome, position: PitchPosition): string {
  const isAttacker = ATTACKERS.includes(position);
  if (o.pj < 8) return "Apenas tuviste minutos: el año se te fue mirando desde la banca.";
  if (o.performance >= 1.35) {
    return isAttacker
      ? `Temporadas así se recuerdan: ${o.gls} goles y ${o.ast} asistencias te pusieron en boca de todos.`
      : `Fuiste de lo más regular del equipo y la prensa te señaló como uno de los mejores en tu puesto.`;
  }
  if (o.performance >= 1.1) {
    return isAttacker
      ? `Cumpliste con creces: ${o.gls} goles en ${o.pj} partidos y el puesto nunca estuvo en duda.`
      : `Rendiste por encima de lo esperado y te ganaste la confianza del cuerpo técnico.`;
  }
  if (o.performance >= 0.85) return "Un ciclo correcto, sin estridencias: hiciste tu trabajo y sumaste minutos.";
  if (o.performance >= 0.6) return "Te costó entrar en ritmo y los números se quedaron cortos para lo que se esperaba.";
  return "Ciclo para el olvido: nunca terminaste de arrancar y las críticas se hicieron sentir.";
}

function growthPhrase(o: StageOutcome): string {
  const delta = o.ovrAfter - o.ovrBefore;
  if (delta >= 7) return "Diste un salto enorme de nivel.";
  if (delta >= 3) return "Seguiste creciendo.";
  if (delta >= 1) return "Mejoraste poco a poco.";
  if (delta === 0) return "Te estancaste en tu nivel.";
  if (delta >= -3) return "Empezaste a perder algo de chispa.";
  return "El desgaste físico te pasó factura.";
}

export function stageNarrative(o: StageOutcome, position: PitchPosition): string {
  const parts = [performancePhrase(o, position)];
  if (o.injured) parts.push("Una lesión te robó semanas clave.");
  if (o.trophies.length > 0) {
    parts.push(
      o.trophies.length === 1
        ? `Levantaste ${o.trophies[0]} con el ${o.clubName}.`
        : `Fue un ciclo histórico: ${o.trophies.join(" y ")} con el ${o.clubName}.`
    );
  }
  parts.push(growthPhrase(o));
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Hitos: se detectan comparando el acumulado antes/después de cada etapa.

export interface MilestoneContext {
  prevTotalGls: number;
  totalGls: number;
  prevTotalPj: number;
  totalPj: number;
  prevTrophies: number;
  trophies: number;
  prevCaps: number;
  caps: number;
  age: number;
  ovr: number;
  prevOvr: number;
  clubTier: number;
  prevClubTier: number;
  clubName: string;
  wentAbroad: boolean;
}

const GOAL_MARKS = [1, 25, 50, 100, 200, 300];
const MATCH_MARKS = [100, 250, 500];

export function detectMilestones(c: MilestoneContext): string[] {
  const out: string[] = [];

  for (const mark of GOAL_MARKS) {
    if (c.prevTotalGls < mark && c.totalGls >= mark) {
      out.push(mark === 1 ? "Primer gol como profesional" : `${mark} goles en tu carrera`);
    }
  }
  for (const mark of MATCH_MARKS) {
    if (c.prevTotalPj < mark && c.totalPj >= mark) out.push(`${mark} partidos disputados`);
  }
  if (c.prevTrophies === 0 && c.trophies > 0) out.push("Primer título de tu carrera");
  if (c.prevCaps === 0 && c.caps > 0) out.push("Debut con tu selección");
  if (c.prevOvr < 80 && c.ovr >= 80) out.push("Entraste al selecto grupo de los 80+");
  if (c.prevOvr < 90 && c.ovr >= 90) out.push("Nivel de crack mundial: 90 OVR");
  if (c.prevClubTier < 5 && c.clubTier === 5) out.push(`Fichaste por un gigante: ${c.clubName}`);
  if (c.wentAbroad) out.push("Diste el salto al fútbol europeo");

  return out;
}

// ---------------------------------------------------------------------------
// Premios individuales del ciclo. Dependen del rendimiento REAL, no del azar
// puro: si metés goles y jugás en un club grande, los premios llegan.

export interface AwardContext {
  position: PitchPosition;
  age: number;
  ovr: number;
  gls: number;
  pj: number;
  performance: number;
  clubTier: number;
  reputation: number;
  trophies: string[];
}

// Los umbrales están calibrados contra la distribución real de `performance`
// que produce el motor (centrada en 1.0, rango útil ~0.7–1.3): 1.10 ya es
// cuarto superior y 1.18 es una temporada sobresaliente.
export function detectAwards(c: AwardContext, roll: () => number): string[] {
  const out: string[] = [];
  const isAttacker = ATTACKERS.includes(c.position);
  const isDefensive = DEFENSIVE.includes(c.position);

  // Bota de oro: goles muy por encima de lo esperado en su puesto.
  if (isAttacker && c.gls >= 15 && c.performance >= 1.12 && roll() < 0.65) {
    out.push("Bota de Oro");
  }
  // Guante de oro: el equivalente para porteros.
  if (c.position === "POR" && c.performance >= 1.12 && c.pj >= 24 && roll() < 0.5) {
    out.push("Guante de Oro");
  }
  // Once ideal: rendir por encima de lo esperado en un club competitivo.
  if (c.performance >= 1.1 && c.clubTier >= 3 && c.pj >= 20 && roll() < 0.5) {
    out.push("Once ideal de la liga");
  }
  // Mejor defensa: el reconocimiento propio de los puestos que no puntúan.
  if (isDefensive && c.position !== "POR" && c.performance >= 1.12 && c.pj >= 24 && c.clubTier >= 2 && roll() < 0.45) {
    out.push("Mejor defensa de la liga");
  }
  // Mejor joven: sub-23 con temporada notable.
  if (c.age <= 22 && c.performance >= 1.08 && c.pj >= 18 && roll() < 0.45) {
    out.push("Mejor jugador joven");
  }
  // Balón de Oro: la cima — élite mundial + títulos + reputación.
  if (c.ovr >= 85 && c.reputation >= 65 && c.trophies.length > 0 && c.performance >= 1.08 && roll() < 0.5) {
    out.push("Balón de Oro");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Informe de ojeadores: pista (imprecisa a propósito) sobre tu techo.

export function scoutingHint(potential: number, ovr: number): string {
  const gap = potential - ovr;
  if (gap <= 2) return "Los ojeadores creen que ya diste todo lo que tenías.";
  if (gap <= 6) return "Te queda poco margen de mejora, pero aún podés pulir detalles.";
  if (gap <= 14) return "En el club creen que todavía tenés bastante por crecer.";
  return "Los ojeadores están convencidos de que tu techo es altísimo.";
}

// Cierre de carrera: un párrafo que resume qué clase de futbolista fuiste.
export function careerEpitaph(s: {
  peakOvr: number;
  totalGls: number;
  trophies: number;
  caps: number;
  awards: string[];
  clubsPlayed: number;
}): string {
  if (s.awards.includes("Balón de Oro")) {
    return "Te retirás como uno de los grandes de tu generación: tu nombre ya es parte de la historia del fútbol.";
  }
  if (s.peakOvr >= 85 && s.trophies >= 4) {
    return "Fuiste un futbolista de élite, campeón repetido y referente en cada vestuario que pisaste.";
  }
  if (s.peakOvr >= 78) {
    return "Tuviste una carrera sólida en la primera línea del fútbol, con títulos y respeto ganado a pulso.";
  }
  if (s.trophies > 0) {
    return "Sin ser una estrella mediática, te ganaste tu lugar y te vas con títulos en la vitrina.";
  }
  if (s.clubsPlayed >= 5) {
    return "Fue una carrera de trotamundos: muchas camisetas, mucho oficio y una vida entera dentro de una cancha.";
  }
  return "Una carrera honesta de principio a fin: te vas con la satisfacción de haber vivido del fútbol.";
}
