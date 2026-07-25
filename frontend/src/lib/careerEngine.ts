// Motor de Tu Leyenda. Todo el juego vive acá; las pantallas solo leen estado.
//
// ARQUITECTURA — cinco sistemas que se alimentan entre sí:
//
//  1. POTENCIAL (oculto)   Cada jugador nace con un techo (`potential`). El OVR
//                          se acerca de forma asintótica: crecés rápido de joven
//                          y cada vez menos. Nadie llega a 90 si no le tocó.
//
//  2. RENDIMIENTO          Goles/asistencias (o vallas invictas, si sos portero)
//                          se comparan contra lo esperado para tu puesto, tu
//                          nivel y el de tu club. Superarlo acelera el
//                          crecimiento, da premios y sube tu reputación.
//
//  3. REPUTACIÓN           Decide QUIÉN te ficha: con poca fama solo clubes de
//                          tu país; al cruzar el umbral, ofertas de Europa; con
//                          reputación de élite, los gigantes.
//
//  4. TURNO DOBLE          Cada temporada presenta DOS cartas: una de FUTURO
//                          (traspaso, préstamo, venta, renovación) y otra de
//                          ENFOQUE (en qué trabajás ese año). Se resuelven
//                          juntas — así cada año tiene dos decisiones con peso
//                          en vez de una sola.
//
//  5. NARRATIVA            Cada temporada devuelve un `StageOutcome` con relato,
//                          hitos y premios (ver careerNarrative.ts).
//
// El calendario avanza AÑO A AÑO (16 → 39). A partir de los 33 el cuerpo pasa
// factura: el OVR baja y crece el riesgo de lesión.
//
// RNG: no se usa `Math.random()` plano para lo importante. `bell()` promedia
// tres uniformes → campana, donde lo normal es común y lo extremo raro.
import {
  CareerClub,
  EUROPEAN_LEAGUES,
  PEXELS,
  PitchPosition,
  canteraClubs,
  clubPool,
  expectedOvrForTier,
  findClub,
  shuffle,
} from "./careerData";
import {
  AwardContext,
  MilestoneContext,
  StageOutcome,
  detectAwards,
  detectMilestones,
} from "./careerNarrative";
import { MUNDIAL, continentalCupsFor, domesticCupTrophy, leagueTrophy } from "./careerTrophies";
import {
  AGENT_NAMES,
  COACH_NAMES,
  FRIEND_NAMES,
  RIVAL_NAMES,
  STORIES,
  StoryContext,
  StoryOutcome,
  pickStory,
} from "./careerStories";

export interface CareerTrophy {
  label: string;
  age: number;
  club: string;
}

export interface CareerAward {
  label: string;
  age: number;
  club: string;
}

export interface CareerStage {
  age: number;
  club: CareerClub;
  ovr: number;
  pj: number;
  gls: number;
  ast: number;
  /** Vallas invictas — la métrica que de verdad mide a un portero. */
  cleanSheets: number;
  trophies: string[];
}

export interface CareerOption {
  id: string;
  label: string;
  sublabel?: string;
  clubId?: string;
  effect: string;
  risk?: string;
  image?: string;
}

export interface CareerEvent {
  kind: EventKind;
  title: string;
  description: string;
  options: CareerOption[];
}

/** Una temporada: dos decisiones (futuro + enfoque) y su contexto narrativo. */
export interface CareerTurn {
  seasonLabel: string;
  intro: string;
  transfer: CareerEvent;
  development: CareerEvent;
}

export type EventKind =
  | "cantera"
  | "futuro"
  | "enfoque";

/** Penal de una final: el minijuego que decide un título. */
export interface PendingPenalty {
  competition: string;
  club: string;
  /** Zonas que cubre el portero (0-4). Ocultas hasta que tirás. */
  keeperZones: number[];
}

export interface PenaltyResult {
  competition: string;
  club: string;
  pickedZone: number;
  keeperZones: number[];
  scored: boolean;
}

/** Resultado de una decisión con porcentaje — alimenta la ruleta. */
export interface LuckRoll {
  chance: number;
  rolled: number;
  success: boolean;
  successLabel: string;
  failLabel: string;
}

export interface CareerState {
  surname: string;
  number: number;
  foot: "Izquierda" | "Derecha";
  countryName: string;
  countryCode: string;
  position: PitchPosition;
  age: number;
  ovr: number;
  potential: number;
  peakOvr: number;
  marketValue: number;
  peakValue: number;
  club: CareerClub;
  parentClubId: string | null;
  /** Temporadas seguidas cedido — para que el préstamo no sea eterno. */
  loanYears: number;
  totalPj: number;
  totalGls: number;
  totalAst: number;
  totalCleanSheets: number;
  trophies: CareerTrophy[];
  awards: CareerAward[];
  caps: number;
  reputation: number;
  form: number;
  penaltyOvr: number;
  /** Años seguidos lesionado de gravedad — empeora el declive. */
  injuries: number;
  history: CareerStage[];
  lastStage: StageOutcome | null;
  lastRoll: LuckRoll | null;
  lastPenalty: PenaltyResult | null;
  retired: boolean;

  // --- Guion --------------------------------------------------------------
  /** Decisiones y momentos ya vividos. Permite callbacks entre historias. */
  flags: string[];
  /** Personajes recurrentes: dan continuidad al relato a lo largo de los años. */
  rivalName: string;
  agentName: string;
  friendName: string;
  coachName: string;

  // --- Turno en curso -----------------------------------------------------
  pendingTurn: CareerTurn | null;
  pickedTransfer: string | null;
  pickedDevelopment: string | null;
  pendingPenalty: PendingPenalty | null;
  /** Id de la historia que se está jugando este turno (para aplicar efectos). */
  activeStoryId: string | null;
}

// ---------------------------------------------------------------------------
// Azar

const bell = () => (Math.random() + Math.random() + Math.random()) / 3;
const around = (center: number, spread: number) => center + (bell() * 2 - 1) * spread;
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const RETIREMENT_AGE = 39;
const DECLINE_AGE = 33;

// ---------------------------------------------------------------------------
// Perfiles por posición: producción esperada por temporada (34 partidos) a 70 OVR.

const POSITION_PROFILE: Record<PitchPosition, { goals: number; assists: number }> = {
  DC: { goals: 16, assists: 5 },
  EI: { goals: 9, assists: 9 },
  ED: { goals: 9, assists: 9 },
  MCO: { goals: 7, assists: 11 },
  MI: { goals: 4, assists: 8 },
  MD: { goals: 4, assists: 8 },
  MC: { goals: 3, assists: 7 },
  MCD: { goals: 1, assists: 3 },
  LI: { goals: 1, assists: 6 },
  LD: { goals: 1, assists: 6 },
  DFC: { goals: 2, assists: 1 },
  POR: { goals: 0, assists: 0 },
};

const GOALKEEPER: PitchPosition = "POR";
const DEFENDERS: PitchPosition[] = ["DFC", "LI", "LD", "MCD"];

export function isGoalkeeper(p: PitchPosition) {
  return p === GOALKEEPER;
}

export function clubFit(ovr: number, club: CareerClub): number {
  return ovr - expectedOvrForTier(club.tier);
}

/**
 * Valor de mercado. Curva logarítmica calibrada contra FotMob + prima por fama.
 * Un crack en un gigante tiene además un SUELO: los grandes clubes no dejan
 * salir a su estrella por menos de eso, por mucho que diga una fórmula.
 */
export function marketValueFromOvr(ovr: number, age: number, reputation = 0, clubTier = 1): number {
  const base = Math.pow(10, (ovr - 7.4) / 10.4);
  const ageFactor = age <= 24 ? 1.15 : age <= 29 ? 1 : age <= 32 ? 0.6 : age <= 35 ? 0.3 : 0.12;
  const fameFactor = 1 + reputation / 250;
  let value = base * ageFactor * fameFactor;

  // Suelo por jerarquía: si sos titular de un grande y estás en edad, valés
  // lo que valen esos jugadores en el mercado real.
  if (age <= 31) {
    if (clubTier === 5 && ovr >= 80) value = Math.max(value, 80_000_000);
    else if (clubTier === 5 && ovr >= 75) value = Math.max(value, 45_000_000);
    else if (clubTier === 4 && ovr >= 78) value = Math.max(value, 35_000_000);
    else if (clubTier === 4 && ovr >= 73) value = Math.max(value, 18_000_000);
  }
  return Math.max(50_000, Math.round(value / 10_000) * 10_000);
}

/**
 * Techo de carrera. Alto a propósito: todo jugador debe poder soñar con llegar
 * a 99 antes de los 32 si rinde y elige bien. Lo que separa una carrera buena
 * de una legendaria no es el techo sino cuánto de ese techo alcanzás.
 */
function rollPotential(): number {
  // 1 de cada ~12 nace siendo un talento generacional: solo esos pueden
  // aspirar de verdad al 99. El resto tiene un techo alto pero humano.
  if (Math.random() < 0.08) return rand(93, 99);
  return Math.round(clamp(70 + bell() * 26, 68, 94));
}

export function newCareer(input: {
  surname: string;
  number: number;
  foot: "Izquierda" | "Derecha";
  countryName: string;
  countryCode: string;
  position: PitchPosition;
}): CareerState {
  const ovr = 48 + rand(0, 5);
  const potential = Math.max(ovr + 8, rollPotential());
  const club = pick(canteraClubs(input.countryName));
  const base: CareerState = {
    ...input,
    age: 16,
    ovr,
    potential,
    peakOvr: ovr,
    marketValue: marketValueFromOvr(ovr, 16),
    peakValue: marketValueFromOvr(ovr, 16),
    club,
    parentClubId: null,
    loanYears: 0,
    totalPj: 0,
    totalGls: 0,
    totalAst: 0,
    totalCleanSheets: 0,
    trophies: [],
    awards: [],
    caps: 0,
    reputation: 2,
    form: 0,
    penaltyOvr: 0,
    injuries: 0,
    history: [],
    lastStage: null,
    lastRoll: null,
    lastPenalty: null,
    retired: false,
    // Personajes de tu carrera: se sortean una vez y te acompañan siempre.
    flags: [],
    rivalName: pick(RIVAL_NAMES),
    agentName: pick(AGENT_NAMES),
    friendName: pick(FRIEND_NAMES),
    coachName: pick(COACH_NAMES),
    pendingTurn: null,
    pickedTransfer: null,
    pickedDevelopment: null,
    pendingPenalty: null,
    activeStoryId: null,
  };
  return withNewTurn(base, true);
}

// ---------------------------------------------------------------------------
// Simulación de temporada

function minutesFromFit(fit: number): number {
  if (fit <= -18) return 0.3;
  if (fit <= -10) return 0.5;
  if (fit <= -4) return 0.72;
  if (fit <= 4) return 0.9;
  if (fit <= 12) return 1;
  return 1.05;
}

interface SeasonResult {
  pj: number;
  gls: number;
  ast: number;
  cleanSheets: number;
  performance: number;
  ovrDelta: number;
  starter: boolean;
  injured: boolean;
}

function simulateSeason(s: CareerState, minutesShare: number): SeasonResult {
  const fit = clubFit(s.ovr, s.club);
  let share = clamp(minutesShare * minutesFromFit(fit), 0.1, 1.1);

  // Riesgo de lesión: bajo de joven, alto pasados los 33. Una lesión te come
  // media temporada.
  const injuryRisk = s.age >= DECLINE_AGE ? 0.1 + (s.age - DECLINE_AGE) * 0.05 : 0.05;
  const injured = Math.random() < clamp(injuryRisk, 0.03, 0.42);
  if (injured) share *= 0.45;

  const pj = Math.round(clamp(34 * share * around(1, 0.1), 1, 38));
  const starter = share >= 0.62;
  const minutesScale = pj / 34;
  const teamScale = 0.8 + s.club.tier * 0.09;
  const levelScale = Math.pow(s.ovr / 70, 1.8);

  let gls = 0;
  let ast = 0;
  let cleanSheets = 0;
  let performance: number;

  if (isGoalkeeper(s.position)) {
    // Un portero se mide por vallas invictas, no por goles. Depende de su
    // nivel Y de lo sólido que sea el equipo delante suyo.
    const expectedCS = pj * (0.16 + s.club.tier * 0.045) * Math.pow(s.ovr / 70, 1.1);
    cleanSheets = Math.max(0, Math.round(expectedCS * around(1, 0.28)));
    performance = clamp(expectedCS > 0.5 ? cleanSheets / expectedCS : 1, 0.35, 1.85);
  } else {
    const profile = POSITION_PROFILE[s.position];
    const expectedGls = profile.goals * levelScale * teamScale * minutesScale;
    const expectedAst = profile.assists * levelScale * teamScale * minutesScale;
    const luck = around(1, 0.3) + s.form * 0.12;
    gls = Math.max(0, Math.round(expectedGls * luck));
    ast = Math.max(0, Math.round(expectedAst * around(1, 0.28)));

    if (DEFENDERS.includes(s.position)) {
      // A un defensor se le pide solidez: cuenta también dejar la puerta a 0.
      const expectedCS = pj * (0.14 + s.club.tier * 0.04);
      cleanSheets = Math.max(0, Math.round(expectedCS * around(1, 0.3)));
      const solidity = expectedCS > 0.5 ? cleanSheets / expectedCS : 1;
      const output = expectedGls + expectedAst > 1 ? (gls + ast) / (expectedGls + expectedAst) : 1;
      performance = clamp(solidity * 0.65 + output * 0.35, 0.35, 1.8);
    } else {
      const expectedTotal = Math.max(1, expectedGls + expectedAst);
      performance = clamp((gls + ast) / expectedTotal, 0.3, 1.9);
    }
  }

  // Crecimiento = BASE + APROXIMACIÓN AL TECHO.
  //
  // La base es el progreso garantizado por entrenar y competir un año entero:
  // mientras juegues y estés en edad de crecer, siempre subís algo. Antes todo
  // dependía del hueco contra el potencial, así que un jugador con techo bajo
  // se estancaba a los 22 y la carrera se sentía muerta.
  const gap = s.potential - s.ovr;
  const baseGrowth =
    s.age <= 21 ? 1.5 : s.age <= 25 ? 1.1 : s.age <= 28 ? 0.6 : s.age < DECLINE_AGE ? 0.25 : 0;
  const ageRate =
    s.age <= 19 ? 0.2 : s.age <= 22 ? 0.16 : s.age <= 25 ? 0.11 : s.age <= 28 ? 0.06 : 0.025;
  const perfMult = clamp(0.45 + performance * 0.75, 0.4, 1.7);

  // El crecimiento base se apaga al acercarte a tu techo: si no, el potencial
  // dejaría de significar algo y todos terminarían en el mismo número.
  const roomFactor = clamp(gap / 10, 0, 1);
  let ovrDelta = baseGrowth * share * clamp(perfMult, 0.55, 1.5) * roomFactor;
  if (gap > 0) ovrDelta += gap * ageRate * share * perfMult;

  // Declive: empieza a los 33 y se acelera; cada lesión grave deja secuela.
  if (s.age >= DECLINE_AGE) {
    const severity = (s.age - DECLINE_AGE + 1) * 0.55 + s.injuries * 0.25;
    ovrDelta -= severity * (starter ? 0.8 : 1.2) * around(1, 0.2);
  }
  if (injured) ovrDelta -= 0.8;

  return { pj, gls, ast, cleanSheets, performance, ovrDelta: Math.round(ovrDelta), starter, injured };
}

function rollTrophies(s: CareerState, performance: number): { won: string[]; finalOf: string | null } {
  const won: string[] = [];
  const league = s.club.league;
  const perf = 0.75 + performance * 0.35;

  // Probabilidades POR TEMPORADA (antes cada tirada cubría dos años, por eso
  // están a la mitad): un gigante gana su liga ~1 de cada 4 años, un club
  // chico prácticamente nunca.
  const ligaChance = clamp(([0, 0.01, 0.025, 0.06, 0.13, 0.24][s.club.tier] ?? 0.01) * perf, 0.003, 0.35);
  if (Math.random() < ligaChance) won.push(leagueTrophy(league).name);

  const copaChance = clamp(([0, 0.025, 0.045, 0.075, 0.12, 0.17][s.club.tier] ?? 0.025) * perf, 0.005, 0.28);
  if (Math.random() < copaChance) won.push(domesticCupTrophy(league).name);

  // Continental: en vez de resolverse sola, si llegás a la FINAL la define un
  // penal que tirás vos (ver PendingPenalty).
  let finalOf: string | null = null;
  const cups = continentalCupsFor(league, s.club.tier);
  if (cups.length) {
    const finalChance = clamp(([0, 0, 0.02, 0.05, 0.09, 0.15][s.club.tier] ?? 0) * perf, 0, 0.2);
    if (Math.random() < finalChance) {
      finalOf = (cups.length > 1 && Math.random() < 0.3 ? cups[1] : cups[0]).name;
    }
  }
  return { won, finalOf };
}

function rollCaps(s: CareerState, performance: number): number {
  const threshold = 71;
  if (s.ovr < threshold) return 0;
  const chance = clamp((s.ovr - threshold) / 22 + (performance - 1) * 0.3, 0.05, 0.92);
  return Math.random() < chance ? rand(2, 8) : 0;
}

function updateReputation(s: CareerState, r: SeasonResult, trophies: string[], awards: string[], caps: number): number {
  // Ganancias POR TEMPORADA (a la mitad de cuando cada etapa valía dos años),
  // con olvido proporcional para que la fama no sature en 100 a mitad de
  // carrera y siga siendo una señal útil.
  let rep = s.reputation;
  if (isGoalkeeper(s.position)) {
    rep += r.cleanSheets * 0.26 * (0.7 + s.club.tier * 0.16);
  } else {
    rep += (r.gls * 0.22 + r.ast * 0.11) * (0.7 + s.club.tier * 0.16);
  }
  rep += clamp((r.performance - 1) * 7, -4, 6);
  if (r.starter && r.pj >= 22) rep += 0.4 + s.club.tier * 0.4;
  rep += trophies.length * 4 + (trophies.some((t) => t.includes("Champions")) ? 4 : 0);
  rep += awards.length * 6;
  rep += caps * 0.25;
  rep += Math.max(0, s.club.tier - 2) * 1.1;
  rep -= 0.8 + rep * 0.1;
  return clamp(rep, 0, 100);
}

const REP_ABROAD = 26;
const REP_ELITE = 55;

function canGoAbroad(s: CareerState): boolean {
  return s.reputation >= REP_ABROAD || s.ovr >= 73;
}

function interestTier(s: CareerState): number {
  // Umbrales recalibrados a la escala de OVR actual: llegar a un gigante
  // (tier 5) tiene que seguir siendo cosa de unos pocos.
  let tier = 1;
  if (s.ovr >= 89) tier = 5;
  else if (s.ovr >= 83) tier = 4;
  else if (s.ovr >= 75) tier = 3;
  else if (s.ovr >= 66) tier = 2;
  if (s.reputation >= REP_ELITE) tier = Math.min(5, tier + 1);
  if (s.age >= 34) tier = Math.max(1, tier - 1);
  return tier;
}

// ---------------------------------------------------------------------------
// Construcción del turno: carta de FUTURO + carta de ENFOQUE

function seasonLabel(age: number): string {
  const start = 2026 + (age - 16);
  return `Temporada ${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Texto de contexto que abre la temporada: te sitúa en tu momento real. */
function seasonIntro(s: CareerState): string {
  const fit = clubFit(s.ovr, s.club);
  const abroad = s.club.country !== s.countryName;

  if (s.age === 16) return `Tenés 16 años y un contrato juvenil por firmar. Todo está por escribirse.`;
  if (s.parentClubId) {
    const parent = findClub(s.parentClubId);
    return `Seguís cedido en el ${s.club.name}${parent ? `, con el ${parent.name} mirando de reojo` : ""}. Cada partido es una audición.`;
  }
  if (s.age >= 36) return `A los ${s.age}, cada temporada puede ser la última. El cuerpo avisa, pero la cabeza todavía quiere.`;
  if (s.age >= DECLINE_AGE) return `Con ${s.age} años ya no sos el que corría toda la banda, pero la lectura de juego la ganaste a pulso.`;
  if (fit <= -12) return `En el ${s.club.name} te queda todo grande todavía. Hay que ganarse cada minuto.`;
  if (fit >= 12) return `Sos lo mejor del ${s.club.name} y en el vestuario todos lo saben. La pregunta es hasta cuándo te retienen.`;
  if (abroad) return `Tu vida está en ${s.club.country}, lejos de casa, defendiendo al ${s.club.name}.`;
  if (s.reputation >= REP_ELITE) return `Tu nombre ya pesa. Cada movimiento tuyo es noticia de portada.`;
  return `Arranca una temporada más en el ${s.club.name}. Toca demostrar de nuevo.`;
}

/** Carta 1: qué hacés con tu futuro (renovar, salir, cesión, venta). */
function buildTransferCard(s: CareerState): CareerEvent {
  const tier = interestTier(s);
  const abroad = canGoAbroad(s);
  const fit = clubFit(s.ovr, s.club);

  // Cantera: el primer contrato.
  if (s.age === 16) {
    const clubs = shuffle(canteraClubs(s.countryName)).slice(0, 3);
    return {
      kind: "cantera",
      title: "Oferta de cantera",
      description: "Tres clubes quieren sumarte a su proyecto juvenil. Elegí dónde empieza tu carrera.",
      options: clubs.map((c) => ({ id: c.id, label: `Fichar por ${c.name}`, clubId: c.id, effect: c.league })),
    };
  }

  // Volver de una cesión larga.
  if (s.parentClubId && s.loanYears >= 2) {
    const parent = findClub(s.parentClubId)!;
    const alt = pick(shuffle(clubPool({ tier, country: s.countryName, abroad, excludeIds: [s.club.id, parent.id] })));
    return {
      kind: "futuro",
      title: "Termina tu cesión",
      description: `El préstamo llegó a su fin. El ${parent.name} decide si te reintegra… o si te vende de una vez.`,
      options: [
        { id: parent.id, label: `Volver al ${parent.name}`, clubId: parent.id, effect: "Pelear un lugar en tu club" },
        { id: alt.id, label: `Fichar por ${alt.name}`, clubId: alt.id, effect: alt.league, risk: "Cambio definitivo" },
      ],
    };
  }

  // Si el club te queda grande y sos joven: cesión para sumar minutos.
  if (fit <= -10 && s.age <= 24 && !s.parentClubId) {
    const targets = shuffle(clubPool({ tier: Math.max(1, s.club.tier - 1), country: s.countryName, abroad: false, excludeIds: [s.club.id] })).slice(0, 2);
    return {
      kind: "futuro",
      title: "Mercado de pases",
      description: `En el ${s.club.name} no entrás en los planes. Podés salir cedido a jugar o quedarte a pelearla desde abajo.`,
      options: [
        ...targets.map((c) => ({ id: `loan:${c.id}`, label: `Cesión al ${c.name}`, clubId: c.id, effect: `${c.league} · minutos asegurados` })),
        { id: "stay", label: `Quedarte en ${s.club.name}`, clubId: s.club.id, effect: "Pelear el puesto", risk: "Podés no jugar" },
      ],
    };
  }

  // ¿Hay ofertas reales este año? En una carrera de verdad no te cambiás de
  // club cada temporada: el mercado se mueve por vos cuando rendís, cuando se
  // te acaba el contrato o cuando sobrás en tu equipo. El resto de los años la
  // decisión es sobre tu ROL en el club, no sobre irte.
  // El mercado se mueve por vos cada ~2 años (fin de contrato), y antes si
  // rendís o si te quedó chico el club. Los años sin ofertas la decisión pasa
  // a ser sobre tu ROL, no sobre irte.
  const contractYear = (s.age - 16) % 2 === 0;
  let offerChance = 0.08;
  if (fit >= 8) offerChance += 0.28; // te quedó chico el club
  if (s.reputation >= REP_ELITE) offerChance += 0.18;
  if (contractYear) offerChance += 0.45; // el año que se te vence el contrato
  if (s.age >= 34) offerChance -= 0.15;
  const hasOffers = Math.random() < clamp(offerChance, 0.05, 0.85);

  if (!hasOffers) {
    // Año sin mercado: se decide el rol dentro del club.
    const titular = Math.round(clamp(58 + fit * 1.8 + s.form * 6, 20, 90));
    return {
      kind: "futuro",
      title: "Tu lugar en el equipo",
      description: `No hay ofertas sobre la mesa. En el ${s.club.name} toca definir qué papel vas a tener esta temporada.`,
      options: [
        { id: "titular", label: "Exigir ser titular", effect: `Lo conseguís ${titular}%`, risk: `Si no, al banco ${100 - titular}%`, image: PEXELS.bench },
        { id: "stay", label: "Aceptar tu rol y trabajar", effect: "Minutos estables, sin conflicto" },
      ],
    };
  }

  const offerTier = fit >= 8 ? Math.min(5, tier + 1) : tier;
  const offers = shuffle(clubPool({ tier: offerTier, country: s.countryName, abroad, excludeIds: [s.club.id] })).slice(0, 2);
  const isEuroJump = s.club.country === s.countryName && offers.some((c) => EUROPEAN_LEAGUES.has(c.league));

  const options: CareerOption[] = offers.map((c) => {
    const stepUp = c.tier > s.club.tier;
    return {
      id: c.id,
      label: `Fichar por ${c.name}`,
      clubId: c.id,
      effect: stepUp ? `${c.league} · subís de categoría` : c.league,
      risk: stepUp ? "Vas a pelear el puesto" : undefined,
    };
  });
  options.push({
    id: "stay",
    label: `Renovar con ${s.club.name}`,
    clubId: s.club.id,
    effect: "Continuidad y confianza",
  });

  return {
    kind: "futuro",
    title: isEuroJump ? "Te llaman de Europa" : "Mercado de pases",
    description: isEuroJump
      ? `Llegaron ofertas del fútbol europeo. Es el salto que soñaste… y también donde la competencia es otra.`
      : `Tu representante trae ofertas sobre la mesa. Decidí dónde seguís esta temporada.`,
    options,
  };
}

/** Carta 2: en qué te enfocás esta temporada (sube tu nivel, con riesgo). */
/** Contexto que leen las historias del guion para decidir si aplican. */
function storyContext(s: CareerState): StoryContext {
  return {
    surname: s.surname,
    age: s.age,
    ovr: s.ovr,
    potential: s.potential,
    reputation: s.reputation,
    club: s.club,
    countryName: s.countryName,
    position: s.position,
    fit: clubFit(s.ovr, s.club),
    form: s.form,
    caps: s.caps,
    trophies: s.trophies.length,
    totalGls: s.totalGls,
    totalPj: s.totalPj,
    injuries: s.injuries,
    flags: s.flags,
    rivalName: s.rivalName,
    agentName: s.agentName,
    friendName: s.friendName,
    coachName: s.coachName,
    isGK: isGoalkeeper(s.position),
    clubAbroad: s.club.country !== s.countryName,
  };
}

/**
 * Carta 2: la historia de la temporada. Se sortea del guion (careerStories.ts)
 * entre las que aplican a tu momento de carrera. Si no hubiera ninguna
 * elegible, cae a un entrenamiento genérico para que el turno nunca quede vacío.
 */
function buildDevelopmentCard(s: CareerState): { event: CareerEvent; storyId: string | null } {
  const ctx = storyContext(s);
  const story = pickStory(ctx, s.activeStoryId);

  if (story) {
    return {
      storyId: story.id,
      event: {
        kind: "enfoque",
        title: story.title,
        description: story.text(ctx),
        options: story.options(ctx).map((o) => ({
          id: o.id,
          label: o.label,
          effect: o.effect,
          risk: o.risk,
          image: o.image,
        })),
      },
    };
  }

  const fit = clubFit(s.ovr, s.club);
  const exito = Math.round(clamp(62 + fit * 1.2 - Math.max(0, s.age - 26) * 2.2, 25, 88));
  return {
    storyId: null,
    event: {
      kind: "enfoque",
      title: "Doble turno",
      description: "El preparador físico te ofrece un plan de dos entrenamientos diarios. Podés dar un salto… o romperte.",
      options: [
        { id: "fondo", label: "Entrenar a fondo", effect: `Salto de nivel ${exito}%`, risk: `Lesión ${100 - exito}%`, image: PEXELS.training },
        { id: "carga", label: "Cuidar el cuerpo", effect: "Llegás sano todo el año", risk: "Crecés más lento" },
      ],
    },
  };
}

function buildTurn(s: CareerState, isFirst = false): { turn: CareerTurn; storyId: string | null } {
  const dev = isFirst
    ? {
        storyId: null,
        event: {
          kind: "enfoque" as const,
          title: "Tus primeros pasos",
          description: "Antes de debutar, el club quiere saber en qué querés poner el foco este año.",
          options: isGoalkeeper(s.position)
            ? [
                { id: "arco", label: "Vivir bajo los tres palos", effect: "Más vallas invictas" },
                { id: "pies", label: "Aprender a jugar con los pies", effect: "Encajás mejor en equipos grandes" },
              ]
            : [
                { id: "definicion", label: "Trabajar la definición", effect: "Más goles" },
                { id: "colectivo", label: "Entender el juego", effect: "Más asistencias" },
              ],
        },
      }
    : buildDevelopmentCard(s);

  return {
    storyId: dev.storyId,
    turn: {
      seasonLabel: seasonLabel(s.age),
      intro: seasonIntro(s),
      transfer: buildTransferCard(s),
      development: dev.event,
    },
  };
}

/** Arma el próximo turno y deja registrado qué historia toca (para sus efectos). */
function withNewTurn(s: CareerState, isFirst = false): CareerState {
  const { turn, storyId } = buildTurn(s, isFirst);
  return { ...s, pendingTurn: turn, activeStoryId: storyId };
}

/**
 * Aplica un efecto declarativo del guion. Si la opción es una apuesta, se
 * resuelve acá y se devuelve el tiro para que la UI lo muestre en la ruleta.
 */
function applyStoryOutcome(
  s: CareerState,
  outcome: StoryOutcome
): { state: CareerState; minutes: number; luck: LuckRoll | null; bonus: string[] } {
  let next = { ...s };
  let minutes = outcome.minutes ?? 1;
  let luck: LuckRoll | null = null;
  const bonus: string[] = [];

  const applyFlat = (o: StoryOutcome) => {
    if (o.ovr) next.ovr = clamp(next.ovr + o.ovr, 40, 99);
    if (o.potential) next.potential = clamp(next.potential + o.potential, 40, 99);
    if (o.reputation) next.reputation = clamp(next.reputation + o.reputation, 0, 100);
    if (o.form) next.form = clamp(next.form + o.form, -1, 1);
    if (o.caps) next.caps = next.caps + o.caps;
    if (o.penaltyOvr) next.penaltyOvr = Math.max(0, next.penaltyOvr + o.penaltyOvr);
    if (o.injuries) next.injuries = Math.max(0, next.injuries + o.injuries);
    if (o.addFlag && !next.flags.includes(o.addFlag)) next.flags = [...next.flags, o.addFlag];
    if (o.bonusTrophy) bonus.push(o.bonusTrophy);
    if (o.minutes !== undefined) minutes *= o.minutes;
  };

  // El efecto base se aplica siempre (menos `minutes`, ya tomado arriba).
  applyFlat({ ...outcome, minutes: undefined });

  if (outcome.luck) {
    const rolled = Math.random() * 100;
    const success = rolled < outcome.luck.chance;
    luck = {
      chance: outcome.luck.chance,
      rolled: Math.round(rolled),
      success,
      successLabel: outcome.luck.successLabel,
      failLabel: outcome.luck.failLabel,
    };
    applyFlat(success ? outcome.luck.onSuccess : outcome.luck.onFail);
  }

  return { state: next, minutes, luck, bonus };
}

// ---------------------------------------------------------------------------
// Resolución del turno

export function chooseTransfer(s: CareerState, optionId: string): CareerState {
  if (!s.pendingTurn || s.pickedTransfer) return s;
  return { ...s, pickedTransfer: optionId };
}

export function chooseDevelopment(s: CareerState, optionId: string): CareerState {
  if (!s.pendingTurn || !s.pickedTransfer || s.pickedDevelopment) return s;
  return advanceSeason({ ...s, pickedDevelopment: optionId });
}

/** Aplica la carta de futuro: cambio de club, cesión o continuidad. */
function applyTransfer(s: CareerState): CareerState {
  const turn = s.pendingTurn!;
  const id = s.pickedTransfer!;
  const opt = turn.transfer.options.find((o) => o.id === id);
  if (!opt) return s;

  // "Exigir ser titular" se resuelve en el propio evento (no cambia de club),
  // pero su resultado lo aplica applyDevelopment vía el tiro de suerte.
  if (id === "stay" || id === "titular") {
    return { ...s, loanYears: s.parentClubId ? s.loanYears + 1 : 0 };
  }
  if (id.startsWith("loan:")) {
    const target = findClub(id.slice(5));
    if (!target) return s;
    return { ...s, parentClubId: s.club.id, club: target, loanYears: 1 };
  }
  const target = opt.clubId ? findClub(opt.clubId) : null;
  if (!target) return s;
  return { ...s, club: target, parentClubId: null, loanYears: 0 };
}

/** Aplica la carta de enfoque. Devuelve minutos y, si hubo, el tiro de suerte. */
/**
 * Aplica la carta de enfoque. Si el turno venía de una historia del guion, se
 * usan sus efectos declarativos; si fue el entrenamiento genérico de respaldo,
 * se resuelve acá mismo.
 */
function applyDevelopment(s: CareerState): { state: CareerState; minutes: number; luck: LuckRoll | null; bonus: string[] } {
  const turn = s.pendingTurn!;
  const id = s.pickedDevelopment!;

  // Camino normal: la carta era una historia del guion.
  if (s.activeStoryId) {
    const story = STORIES.find((st) => st.id === s.activeStoryId);
    if (story) {
      const opt = story.options(storyContext(s)).find((o) => o.id === id);
      if (opt) {
        const res = applyStoryOutcome(s, opt.outcome);
        // Las historias `once` se marcan para no repetirse en esta carrera.
        if (story.once) {
          const flag = `story:${story.id}`;
          if (!res.state.flags.includes(flag)) res.state.flags = [...res.state.flags, flag];
        }
        return res;
      }
    }
  }

  // Respaldo: entrenamiento genérico y opciones del primer año.
  let next = { ...s };
  let minutes = 1;
  let luck: LuckRoll | null = null;
  const bonus: string[] = [];

  switch (id) {
    case "fondo": {
      const exito = Number(turn.development.options[0].effect.replace(/\D/g, ""));
      const rolled = Math.random() * 100;
      const success = rolled < exito;
      luck = {
        chance: exito,
        rolled: Math.round(rolled),
        success,
        successLabel: "El trabajo extra dio resultado",
        failLabel: "Te rompiste: lesión por sobrecarga",
      };
      if (success) {
        minutes = 1.1;
        next.potential = Math.min(99, s.potential + rand(1, 2));
      } else {
        minutes = 0.45;
        next.penaltyOvr = s.penaltyOvr + 3;
        next.injuries = s.injuries + 1;
      }
      break;
    }
    case "carga":
      minutes = 0.9;
      break;
    case "definicion":
    case "arco":
      next.form = clamp(s.form + 0.35, -1, 1);
      break;
    case "colectivo":
    case "pies":
      minutes = 1.04;
      break;
  }
  return { state: next, minutes, luck, bonus };
}

function advanceSeason(s: CareerState): CareerState {
  let next = applyTransfer(s);
  const dev = applyDevelopment(next);
  next = dev.state;

  let minutes = dev.minutes;
  let luck = dev.luck;

  // "Exigir ser titular": es una apuesta con porcentaje, igual que el doble
  // turno. Se resuelve acá porque necesita el estado ya con el club aplicado.
  if (s.pickedTransfer === "titular") {
    const card = s.pendingTurn!.transfer;
    const chance = Number(card.options[0].effect.replace(/\D/g, ""));
    const rolled = Math.random() * 100;
    const success = rolled < chance;
    luck = {
      chance,
      rolled: Math.round(rolled),
      success,
      successLabel: "Te ganaste el puesto de titular",
      failLabel: "El técnico te mandó al banco",
    };
    minutes *= success ? 1.12 : 0.5;
  }

  const result = simulateSeason(next, minutes);
  // `ovrBefore` es el nivel con el que ARRANCÓ la temporada, antes de que la
  // decisión sumara nada: así el informe puede mostrar por separado lo que te
  // dio el año de competencia y lo que te dio tu elección.
  const ovrBefore = s.ovr;
  const ovrBonus = next.ovr - s.ovr; // aporte directo de la historia elegida
  const ovrBase = result.ovrDelta;
  const ovrAfter = clamp(Math.min(next.potential + 2, next.ovr + result.ovrDelta) - next.penaltyOvr, 40, 99);

  const caps = rollCaps(next, result.performance);
  const totalCaps = next.caps + caps;
  const { won, finalOf } = rollTrophies(next, result.performance);
  const trophies = [...dev.bonus, ...won];

  // Mundial: cada 4 años, si sos internacional y estás en tu pico.
  const worldCupYear = (next.age - 16) % 4 === 2;
  if (worldCupYear && totalCaps > 0 && next.ovr >= 78 && Math.random() < 0.16) {
    trophies.push(MUNDIAL.name);
  }

  const awardCtx: AwardContext = {
    position: next.position,
    age: next.age,
    ovr: ovrAfter,
    gls: result.gls,
    pj: result.pj,
    cleanSheets: result.cleanSheets,
    performance: result.performance,
    clubTier: next.club.tier,
    reputation: next.reputation,
    trophies,
  };
  const awards = detectAwards(awardCtx, Math.random);

  const totalPj = next.totalPj + result.pj;
  const totalGls = next.totalGls + result.gls;
  const totalAst = next.totalAst + result.ast;
  const totalCS = next.totalCleanSheets + result.cleanSheets;

  const milestones = detectMilestones({
    prevTotalGls: next.totalGls,
    totalGls,
    prevTotalPj: next.totalPj,
    totalPj,
    prevTrophies: next.trophies.length,
    trophies: next.trophies.length + trophies.length,
    prevCaps: next.caps,
    caps: totalCaps,
    age: next.age,
    ovr: ovrAfter,
    prevOvr: ovrBefore,
    clubTier: next.club.tier,
    prevClubTier: s.club.tier,
    clubName: next.club.name,
    wentAbroad: s.club.country === s.countryName && next.club.country !== s.countryName,
    isGoalkeeper: isGoalkeeper(next.position),
    prevCleanSheets: next.totalCleanSheets,
    cleanSheets: totalCS,
  });

  const outcome: StageOutcome = {
    ageFrom: next.age,
    ageTo: next.age + 1,
    seasonLabel: seasonLabel(next.age),
    clubName: next.club.name,
    position: next.position,
    pj: result.pj,
    gls: result.gls,
    ast: result.ast,
    cleanSheets: result.cleanSheets,
    ovrBefore,
    ovrAfter,
    ovrBase,
    ovrBonus,
    performance: result.performance,
    starter: result.starter,
    trophies,
    awards,
    milestones,
    injured: result.injured,
  };

  const reputation = updateReputation(next, result, trophies, awards, caps);
  const newAge = next.age + 1;

  const advanced: CareerState = {
    ...next,
    age: newAge,
    ovr: ovrAfter,
    peakOvr: Math.max(next.peakOvr, ovrAfter),
    marketValue: marketValueFromOvr(ovrAfter, newAge, reputation, next.club.tier),
    peakValue: Math.max(next.peakValue, marketValueFromOvr(ovrAfter, newAge, reputation, next.club.tier)),
    totalPj,
    totalGls,
    totalAst,
    totalCleanSheets: totalCS,
    caps: totalCaps,
    reputation,
    form: clamp(next.form * 0.55 + (result.performance - 1) * 0.7, -1, 1),
    penaltyOvr: Math.max(0, next.penaltyOvr - 2),
    injuries: result.injured ? next.injuries + 1 : next.injuries,
    trophies: [...next.trophies, ...trophies.map((label) => ({ label, age: next.age, club: next.club.name }))],
    awards: [...next.awards, ...awards.map((label) => ({ label, age: next.age, club: next.club.name }))],
    history: [
      ...next.history,
      {
        age: next.age,
        club: next.club,
        ovr: ovrAfter,
        pj: result.pj,
        gls: result.gls,
        ast: result.ast,
        cleanSheets: result.cleanSheets,
        trophies,
      },
    ],
    lastStage: outcome,
    lastRoll: luck,
    lastPenalty: null,
    pickedTransfer: null,
    pickedDevelopment: null,
    pendingTurn: null,
    pendingPenalty: null,
  };

  // ¿Se retira? Por edad tope, o por nivel demasiado bajo ya entrado en años.
  const retiring = newAge >= RETIREMENT_AGE || (newAge >= 35 && ovrAfter < 58);

  // Final continental: el penal se tira ANTES de cerrar la temporada.
  if (finalOf) {
    // Un portero cubre menos zonas contra un crack.
    const zonesCovered = advanced.ovr >= 85 ? 1 : 2;
    const keeperZones = shuffle([0, 1, 2, 3, 4]).slice(0, zonesCovered);
    return {
      ...advanced,
      pendingPenalty: { competition: finalOf, club: advanced.club.name, keeperZones },
      retired: retiring,
    };
  }

  if (retiring) return { ...advanced, retired: true };
  return withNewTurn(advanced);
}

/** Resuelve el penal de la final: si metés, levantás el título. */
export function shootPenalty(s: CareerState, zone: number): CareerState {
  const pen = s.pendingPenalty;
  if (!pen) return s;
  const scored = !pen.keeperZones.includes(zone);

  const next: CareerState = {
    ...s,
    pendingPenalty: null,
    lastPenalty: { competition: pen.competition, club: pen.club, pickedZone: zone, keeperZones: pen.keeperZones, scored },
  };

  if (scored) {
    next.trophies = [...s.trophies, { label: pen.competition, age: s.age - 1, club: pen.club }];
    next.reputation = clamp(s.reputation + 8, 0, 100);
    if (next.lastStage) {
      next.lastStage = { ...next.lastStage, trophies: [...next.lastStage.trophies, pen.competition] };
    }
    if (next.history.length) {
      const last = next.history[next.history.length - 1];
      next.history = [...next.history.slice(0, -1), { ...last, trophies: [...last.trophies, pen.competition] }];
    }
  }

  if (s.retired) return next;
  return withNewTurn(next);
}
