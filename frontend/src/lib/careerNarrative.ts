// Capa narrativa de Tu Leyenda: convierte los números que produce el motor
// (goles, vallas invictas, OVR, títulos) en la historia que lee el jugador.
// Está separada del motor a propósito — el motor decide QUÉ pasó, esto decide
// CÓMO se cuenta. Todo el texto es sensible al puesto: a un portero no se le
// habla de goles.

import { PitchPosition } from "./careerData";

export interface StageOutcome {
  ageFrom: number;
  ageTo: number;
  seasonLabel: string;
  clubName: string;
  position: PitchPosition;
  pj: number;
  gls: number;
  ast: number;
  cleanSheets: number;
  ovrBefore: number;
  ovrAfter: number;
  /** Crecimiento que dio la temporada en sí (entrenar y competir). */
  ovrBase: number;
  /** Crecimiento extra que aportó la decisión que tomaste. */
  ovrBonus: number;
  /** Rendimiento vs. lo esperado: <0.8 flojo, >1.25 crack. */
  performance: number;
  starter: boolean;
  trophies: string[];
  awards: string[];
  milestones: string[];
  injured: boolean;
}

const ATTACKERS: PitchPosition[] = ["DC", "EI", "ED", "MCO"];
const DEFENSIVE: PitchPosition[] = ["POR", "DFC", "LI", "LD", "MCD"];
const isGK = (p: PitchPosition) => p === "POR";

// ---------------------------------------------------------------------------
// Relato de la temporada

function performancePhrase(o: StageOutcome): string {
  const attacker = ATTACKERS.includes(o.position);
  const gk = isGK(o.position);

  if (o.pj < 6) {
    return gk
      ? "Fue un año de suplente: viste casi todos los partidos desde el banquillo."
      : "Apenas tuviste minutos: el año se te fue mirando desde la banca.";
  }

  if (o.performance >= 1.35) {
    if (gk) return `Temporada monumental bajo los tres palos: ${o.cleanSheets} vallas invictas y varias manos decisivas que valieron puntos.`;
    if (attacker) return `Temporadas así se recuerdan: ${o.gls} goles y ${o.ast} asistencias te pusieron en boca de todos.`;
    return "Fuiste de lo más regular del equipo y la prensa te señaló como uno de los mejores en tu puesto.";
  }
  if (o.performance >= 1.1) {
    if (gk) return `Diste seguridad al equipo: ${o.cleanSheets} porterías a cero y una defensa que aprendió a confiar en vos.`;
    if (attacker) return `Cumpliste con creces: ${o.gls} goles en ${o.pj} partidos y el puesto nunca estuvo en duda.`;
    return "Rendiste por encima de lo esperado y te ganaste la confianza del cuerpo técnico.";
  }
  if (o.performance >= 0.85) {
    return gk
      ? "Un año correcto: ni milagros ni errores graves, que para un arquero ya es decir algo."
      : "Un año correcto, sin estridencias: hiciste tu trabajo y sumaste minutos.";
  }
  if (o.performance >= 0.6) {
    return gk
      ? "Te entraron goles que no deberían y el debate por la titularidad se instaló."
      : "Te costó entrar en ritmo y los números se quedaron cortos para lo que se esperaba.";
  }
  return gk
    ? "Año para el olvido: fallos puntuales que costaron caro y una portería que nunca se sintió segura."
    : "Ciclo para el olvido: nunca terminaste de arrancar y las críticas se hicieron sentir.";
}

function growthPhrase(o: StageOutcome): string {
  const delta = o.ovrAfter - o.ovrBefore;
  if (delta >= 5) return "Diste un salto enorme de nivel.";
  if (delta >= 2) return "Seguiste creciendo.";
  if (delta >= 1) return "Mejoraste poco a poco.";
  if (delta === 0) return "Te mantuviste en tu nivel.";
  if (delta >= -2) return "Empezaste a perder algo de chispa.";
  return "El desgaste físico te pasó factura.";
}

export function stageNarrative(o: StageOutcome, _position?: PitchPosition): string {
  const parts = [performancePhrase(o)];
  if (o.injured) parts.push("Una lesión te robó semanas clave de la temporada.");
  if (o.trophies.length > 0) {
    parts.push(
      o.trophies.length === 1
        ? `Levantaste ${o.trophies[0]} con el ${o.clubName}.`
        : `Fue un año histórico: ${o.trophies.join(" y ")} con el ${o.clubName}.`
    );
  }
  parts.push(growthPhrase(o));
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Hitos

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
  isGoalkeeper: boolean;
  prevCleanSheets: number;
  cleanSheets: number;
}

const GOAL_MARKS = [1, 25, 50, 100, 200, 300];
const MATCH_MARKS = [100, 250, 500];
const CS_MARKS = [1, 25, 50, 100];

export function detectMilestones(c: MilestoneContext): string[] {
  const out: string[] = [];

  if (c.isGoalkeeper) {
    for (const mark of CS_MARKS) {
      if (c.prevCleanSheets < mark && c.cleanSheets >= mark) {
        out.push(mark === 1 ? "Tu primera valla invicta" : `${mark} porterías a cero`);
      }
    }
  } else {
    for (const mark of GOAL_MARKS) {
      if (c.prevTotalGls < mark && c.totalGls >= mark) {
        out.push(mark === 1 ? "Primer gol como profesional" : `${mark} goles en tu carrera`);
      }
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
// Premios individuales

export interface AwardContext {
  position: PitchPosition;
  age: number;
  ovr: number;
  gls: number;
  pj: number;
  cleanSheets: number;
  performance: number;
  clubTier: number;
  reputation: number;
  trophies: string[];
}

// Umbrales calibrados contra la distribución real de `performance` (centrada
// en 1.0): 1.10 ya es cuarto superior, 1.18 una temporada sobresaliente.
export function detectAwards(c: AwardContext, roll: () => number): string[] {
  const out: string[] = [];
  const attacker = ATTACKERS.includes(c.position);
  const gk = isGK(c.position);
  const defensive = DEFENSIVE.includes(c.position) && !gk;

  if (attacker && c.gls >= 14 && c.performance >= 1.12 && roll() < 0.6) out.push("Bota de Oro");
  if (gk && c.cleanSheets >= 10 && c.performance >= 1.12 && roll() < 0.55) out.push("Guante de Oro");
  if (c.performance >= 1.1 && c.clubTier >= 3 && c.pj >= 18 && roll() < 0.45) out.push("Once ideal de la liga");
  if (defensive && c.performance >= 1.12 && c.pj >= 20 && c.clubTier >= 2 && roll() < 0.4) out.push("Mejor defensa de la liga");
  if (c.age <= 22 && c.performance >= 1.08 && c.pj >= 15 && roll() < 0.4) out.push("Mejor jugador joven");
  if (c.ovr >= 85 && c.reputation >= 65 && c.trophies.length > 0 && c.performance >= 1.08 && roll() < 0.45) {
    out.push("Balón de Oro");
  }
  return out;
}

// ---------------------------------------------------------------------------

export function scoutingHint(potential: number, ovr: number): string {
  const gap = potential - ovr;
  if (gap <= 2) return "Los ojeadores creen que ya diste todo lo que tenías.";
  if (gap <= 6) return "Te queda poco margen de mejora, pero aún podés pulir detalles.";
  if (gap <= 14) return "En el club creen que todavía tenés bastante por crecer.";
  return "Los ojeadores están convencidos de que tu techo es altísimo.";
}

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
