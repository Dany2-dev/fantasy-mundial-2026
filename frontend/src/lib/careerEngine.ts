// Motor de Tu Leyenda. Todo el juego vive acá; las pantallas solo leen estado.
//
// ARQUITECTURA — cuatro sistemas que se alimentan entre sí:
//
//  1. POTENCIAL (oculto)   Cada jugador nace con un techo (`potential`). El OVR
//                          se acerca a ese techo de forma asintótica: crecés
//                          rápido de joven y cada vez menos al acercarte. Nadie
//                          llega a 90 si no le tocó el potencial para hacerlo.
//
//  2. RENDIMIENTO          Los goles/asistencias NO son decorativos. Se comparan
//                          contra lo esperado para tu puesto, tu OVR y el nivel
//                          de tu club (`performance`, 1.0 = justo lo esperado).
//                          Superar lo esperado acelera tu crecimiento, dispara
//                          premios y sube tu reputación. Rendir mal te estanca.
//
//  3. REPUTACIÓN           Acumulada por goles, títulos, premios, selección y
//                          jerarquía del club. Decide QUIÉN te ficha: con poca
//                          reputación solo te buscan clubes de tu país; al
//                          cruzar cierto umbral aparecen las ofertas de Europa,
//                          y con reputación de élite, los gigantes.
//
//  4. NARRATIVA            Cada etapa devuelve un `StageOutcome` con el relato,
//                          hitos y premios (ver careerNarrative.ts).
//
// RNG: no se usa `Math.random()` plano para los resultados importantes. `bell()`
// promedia tres uniformes → distribución de campana, donde lo normal es común y
// lo extremo (una temporada histórica, o un desastre) es raro. Eso hace que la
// carrera se sienta creíble en vez de una ruleta.
import {
  CareerClub,
  EUROPEAN_LEAGUES,
  PEXELS,
  PitchPosition,
  canteraClubs,
  clubPool,
  expectedOvrForTier,
  findClub,
} from "./careerData";
import {
  AwardContext,
  MilestoneContext,
  StageOutcome,
  detectAwards,
  detectMilestones,
  stageNarrative,
} from "./careerNarrative";

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
  trophies: string[];
}

export interface CareerOption {
  id: string;
  label: string;
  sublabel?: string;
  clubId?: string;
  effect: string; // texto visible: "Titular 65%", "+3 OVR", etc.
  risk?: string;
  image?: string; // foto de contexto (Pexels) para decisiones con riesgo
}

export interface CareerEvent {
  kind: EventKind;
  title: string;
  description: string;
  options: CareerOption[];
}

export type EventKind =
  | "cantera"
  | "prestamo"
  | "regreso"
  | "mercado"
  | "europa"
  | "competencia"
  | "mentor"
  | "narrativo"
  | "doble-turno"
  | "seleccion"
  | "capitan"
  | "declive"
  | "retiro-oferta";

export interface CareerState {
  surname: string;
  number: number;
  foot: "Izquierda" | "Derecha";
  countryName: string;
  countryCode: string;
  position: PitchPosition;
  age: number;
  ovr: number;
  /** Techo real del jugador. Oculto en la UI salvo por el informe de ojeadores. */
  potential: number;
  peakOvr: number;
  marketValue: number;
  peakValue: number;
  club: CareerClub;
  /** Club dueño del pase mientras estás cedido (para el evento "regreso"). */
  parentClubId: string | null;
  totalPj: number;
  totalGls: number;
  totalAst: number;
  trophies: CareerTrophy[];
  awards: CareerAward[];
  caps: number;
  /** 0-100. Determina qué clubes se fijan en vos. */
  reputation: number;
  /** Forma reciente, -1..+1. Sube tras buenas etapas, baja tras malas. */
  form: number;
  /** Penalización temporal de OVR (lesión, escándalo…). Se disuelve con el tiempo. */
  penaltyOvr: number;
  /** Multiplicador de minutos pactado por la decisión anterior. */
  pendingMinutes: number;
  history: CareerStage[];
  /** Relato de la última etapa simulada — alimenta el panel de historia. */
  lastStage: StageOutcome | null;
  retired: boolean;
  pendingEvent: CareerEvent | null;
}

// ---------------------------------------------------------------------------
// Utilidades de azar

/** Campana [0,1): promedio de 3 uniformes. Lo normal es común, lo extremo raro. */
const bell = () => (Math.random() + Math.random() + Math.random()) / 3;
/** Valor centrado en `center` con dispersión `spread`, con forma de campana. */
const around = (center: number, spread: number) => center + (bell() * 2 - 1) * spread;
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// Perfiles por posición: producción esperada por 30 partidos a 70 OVR.
// Es la vara con la que se mide tu rendimiento — a un DFC no se le exigen
// goles de killer, a un DC sí.

const POSITION_PROFILE: Record<PitchPosition, { goals: number; assists: number }> = {
  DC: { goals: 14, assists: 4 },
  EI: { goals: 8, assists: 8 },
  ED: { goals: 8, assists: 8 },
  MCO: { goals: 6, assists: 10 },
  MI: { goals: 4, assists: 7 },
  MD: { goals: 4, assists: 7 },
  MC: { goals: 3, assists: 6 },
  MCD: { goals: 1, assists: 3 },
  LI: { goals: 1, assists: 5 },
  LD: { goals: 1, assists: 5 },
  DFC: { goals: 2, assists: 1 },
  POR: { goals: 0, assists: 0 },
};

/** Cuánto mejor/peor sos que lo que ese club espera de un titular suyo. */
export function clubFit(ovr: number, club: CareerClub): number {
  return ovr - expectedOvrForTier(club.tier);
}

// Curva logarítmica (misma familia que el backend real, calibrada contra
// valores de FotMob). La reputación agrega prima: un crack mediático vale más
// que un jugador igual de bueno pero desconocido.
export function marketValueFromOvr(ovr: number, age: number, reputation = 0): number {
  const base = Math.pow(10, (ovr - 7.4) / 10.4);
  const ageFactor = age <= 24 ? 1.15 : age <= 29 ? 1 : age <= 32 ? 0.6 : age <= 35 ? 0.3 : 0.12;
  const fameFactor = 1 + reputation / 250; // hasta +40% siendo leyenda
  return Math.max(50_000, Math.round((base * ageFactor * fameFactor) / 10_000) * 10_000);
}

/** Techo de carrera. La mayoría se queda en 70-82; pasar de 90 es excepcional. */
function rollPotential(): number {
  return Math.round(clamp(55 + bell() * 44, 58, 97));
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
  return {
    ...input,
    age: 16,
    ovr,
    potential,
    peakOvr: ovr,
    marketValue: marketValueFromOvr(ovr, 16),
    peakValue: marketValueFromOvr(ovr, 16),
    club,
    parentClubId: null,
    totalPj: 0,
    totalGls: 0,
    totalAst: 0,
    trophies: [],
    awards: [],
    caps: 0,
    reputation: 2,
    form: 0,
    penaltyOvr: 0,
    pendingMinutes: 1,
    history: [],
    lastStage: null,
    retired: false,
    pendingEvent: buildCanteraEvent(club, input.countryName),
  };
}

function buildCanteraEvent(currentClub: CareerClub, country: string): CareerEvent {
  const others = canteraClubs(country).filter((c) => c.id !== currentClub.id);
  const options = [currentClub, ...others].slice(0, 3);
  return {
    kind: "cantera",
    title: "Oferta de cantera",
    description: "Tres clubes quieren sumarte a su proyecto juvenil. Elegí dónde empieza tu carrera.",
    options: options.map((c) => ({
      id: c.id,
      label: `Fichar por ${c.name}`,
      clubId: c.id,
      effect: c.league,
    })),
  };
}

// ---------------------------------------------------------------------------
// Simulación de una etapa (~2 temporadas)

/** Cuota de minutos según qué tan grande te queda el club. */
function minutesFromFit(fit: number): number {
  if (fit <= -18) return 0.3;
  if (fit <= -10) return 0.5;
  if (fit <= -4) return 0.72;
  if (fit <= 4) return 0.9;
  if (fit <= 12) return 1;
  return 1.05;
}

interface StageResult {
  pj: number;
  gls: number;
  ast: number;
  performance: number;
  ovrDelta: number;
  starter: boolean;
}

function simulateStage(s: CareerState, minutesShare: number): StageResult {
  const fit = clubFit(s.ovr, s.club);
  const share = clamp(minutesShare * minutesFromFit(fit), 0.12, 1.15);

  // Partidos: dos temporadas (~34 posibles) por la cuota de minutos.
  const pj = Math.round(clamp(34 * share * around(1, 0.12), 2, 38));
  const starter = share >= 0.7;

  // Producción esperada para tu puesto, escalada por nivel propio y calidad
  // del equipo (en un equipo grande te llegan más balones).
  const profile = POSITION_PROFILE[s.position];
  const levelScale = Math.pow(s.ovr / 70, 1.8);
  const teamScale = 0.8 + s.club.tier * 0.09;
  const minutesScale = pj / 30;

  const expectedGls = profile.goals * levelScale * teamScale * minutesScale;
  const expectedAst = profile.assists * levelScale * teamScale * minutesScale;

  // Varianza de campana + empujón por forma reciente.
  const luck = around(1, 0.3) + s.form * 0.12;
  const gls = Math.max(0, Math.round(expectedGls * luck));
  const ast = Math.max(0, Math.round(expectedAst * around(1, 0.28)));

  // Rendimiento = lo que hiciste vs. lo que se esperaba. Para porteros y
  // defensas, que casi no puntúan, pesa más haber sido titular constante.
  const outputWeight = profile.goals + profile.assists;
  let performance: number;
  if (outputWeight <= 3) {
    // Porteros y centrales casi no puntúan: su nota sale de ser titular fijo.
    // Centrada en 1.0 con share completo, para que no inflen los premios.
    performance = clamp(0.55 + share * 0.45 + around(0, 0.16), 0.4, 1.5);
  } else {
    const expectedTotal = Math.max(1, expectedGls + expectedAst);
    performance = clamp((gls + ast) / expectedTotal, 0.3, 1.9);
  }

  // Crecimiento asintótico hacia el potencial. Los minutos son requisito:
  // en la banca no se progresa, por muy alto que sea tu techo.
  const gap = s.potential - s.ovr;
  const ageRate =
    s.age <= 19 ? 0.34 : s.age <= 22 ? 0.28 : s.age <= 25 ? 0.19 : s.age <= 28 ? 0.1 : 0.04;
  const perfMult = clamp(0.45 + performance * 0.75, 0.4, 1.7);
  let ovrDelta = gap > 0 ? gap * ageRate * share * perfMult : 0;

  // Declive físico, suavizado si seguís siendo titular indiscutible.
  if (s.age >= 30) {
    const severity = (s.age - 28) * 0.75;
    ovrDelta -= severity * (starter ? 0.7 : 1.15) * around(1, 0.25);
  }

  return {
    pj,
    gls,
    ast,
    performance,
    ovrDelta: Math.round(ovrDelta),
    starter,
  };
}

/** Títulos: manda el nivel real del club; tu rendimiento solo lo matiza. */
function rollTrophies(s: CareerState, performance: number): string[] {
  const baseByTier = [0, 0.03, 0.08, 0.18, 0.36, 0.6][s.club.tier] ?? 0.03;
  const chance = clamp(baseByTier * (0.75 + performance * 0.35), 0.01, 0.78);
  const out: string[] = [];
  if (Math.random() < chance) out.push(s.club.tier >= 4 ? pick(["Liga", "Liga", "Copa Nacional"]) : pick(["Liga", "Copa Nacional"]));
  // Los gigantes pelean además la copa continental.
  if (s.club.tier >= 4 && Math.random() < (s.club.tier === 5 ? 0.22 : 0.1) * (0.7 + performance * 0.4)) {
    out.push("Copa Continental");
  }
  return out;
}

/** Convocatorias: hace falta nivel y, sobre todo, estar rindiendo. */
function rollCaps(s: CareerState, performance: number): number {
  const threshold = 71;
  if (s.ovr < threshold) return 0;
  const chance = clamp((s.ovr - threshold) / 22 + (performance - 1) * 0.3, 0.05, 0.92);
  return Math.random() < chance ? rand(4, 14) : 0;
}

/**
 * Reputación: lo que hace que "si tenés 80 de media, te busquen los mejores".
 * Crece con goles, títulos, premios, selección y jerarquía del club; decae
 * lentamente si desaparecés del mapa.
 */
function updateReputation(s: CareerState, r: StageResult, trophies: string[], awards: string[], caps: number): number {
  let rep = s.reputation;
  rep += (r.gls * 0.3 + r.ast * 0.16) * (0.7 + s.club.tier * 0.16);
  // Rendir por encima de lo esperado también da cartel, aunque no seas
  // goleador (así un central o un volante también pueden hacerse un nombre).
  rep += clamp((r.performance - 1) * 12, -6, 10);
  // Ser titular indiscutible en un club serio pesa por sí solo: es la vía por
  // la que un portero o un central construyen prestigio sin marcar goles.
  if (r.starter && r.pj >= 24) rep += 0.8 + s.club.tier * 0.7;
  rep += trophies.length * 5 + (trophies.includes("Copa Continental") ? 5 : 0);
  rep += awards.length * 8;
  rep += caps * 0.3;
  rep += (s.club.tier - 2) * 1.5;
  // Olvido proporcional: mantener un nombre grande cuesta más que hacerlo.
  // Esto crea un equilibrio natural en vez de dejar que todos saturen en 100.
  rep -= 1 + rep * 0.09;
  return clamp(rep, 0, 100);
}

// Umbrales calibrados contra la distribución real de reputación que produce
// el motor (mediana ~40, p90 ~75): con estos valores, salir al extranjero es
// alcanzable rindiendo bien, y el bono de los gigantes queda para la élite.
const REP_ABROAD = 26;
const REP_ELITE = 55;
export const REP_BALLON_DOR = 65;

/** ¿Ya te siguen desde el extranjero? Es el disparador del salto a Europa. */
function canGoAbroad(s: CareerState): boolean {
  return s.reputation >= REP_ABROAD || s.ovr >= 73;
}

/**
 * Nivel de club que hoy se fijaría en vos. Es la respuesta a "si tenés 80 de
 * media, que te busquen los mejores": el OVR manda, la fama puede subirte un
 * escalón extra, y solo la edad avanzada te lo baja.
 */
function interestTier(s: CareerState): number {
  let tier = 1;
  if (s.ovr >= 84) tier = 5;
  else if (s.ovr >= 77) tier = 4;
  else if (s.ovr >= 69) tier = 3;
  else if (s.ovr >= 60) tier = 2;

  // La fama abre puertas que el nivel puro todavía no: un goleador mediático
  // de 78 puede terminar en un gigante.
  if (s.reputation >= REP_ELITE) tier = Math.min(5, tier + 1);
  // Pasados los 33 los grandes dejan de invertir en vos.
  if (s.age >= 34) tier = Math.max(1, tier - 1);
  return tier;
}

// ---------------------------------------------------------------------------
// Eventos

function buildEvent(s: CareerState, kind: EventKind): CareerEvent {
  const fit = clubFit(s.ovr, s.club);
  const tier = interestTier(s);
  const abroad = canGoAbroad(s);

  switch (kind) {
    case "prestamo": {
      const targetTier = Math.max(1, s.club.tier - (fit <= -12 ? 2 : 1));
      const opts = clubPool({ tier: targetTier, country: s.countryName, abroad: false, excludeIds: [s.club.id] }).slice(0, 3);
      return {
        kind,
        title: "Salida a préstamo",
        description: `En el ${s.club.name} todavía no te ven listo para ser titular. Una cesión te daría los minutos que necesitás para crecer.`,
        options: opts.map((c) => ({ id: c.id, label: `Préstamo en ${c.name}`, clubId: c.id, effect: c.league })),
      };
    }

    case "regreso": {
      const parent = s.parentClubId ? findClub(s.parentClubId) : null;
      const alts = clubPool({ tier, country: s.countryName, abroad, excludeIds: [s.club.id, parent?.id ?? ""] }).slice(0, 2);
      const options: CareerOption[] = alts.map((c) => ({ id: c.id, label: `Fichar por ${c.name}`, clubId: c.id, effect: c.league }));
      if (parent) {
        options.push({ id: parent.id, label: `Volver al ${parent.name}`, clubId: parent.id, effect: "Tu club te espera" });
      } else {
        options.push({ id: "stay", label: `Seguir en ${s.club.name}`, clubId: s.club.id, effect: "Continuidad" });
      }
      return {
        kind,
        title: "Fin de la cesión",
        description: parent
          ? `Termina tu préstamo. El ${parent.name} quiere recuperarte, pero también hay clubes tocando la puerta.`
          : "Se abre el mercado y tenés que decidir tu próximo paso.",
        options,
      };
    }

    case "europa": {
      const dest = pick(CLUBS_ABROAD(s, tier));
      const isEurope = EUROPEAN_LEAGUES.has(dest.league);
      return {
        kind,
        title: isEurope ? "Te llaman de Europa" : "Oferta desde el extranjero",
        description: isEurope
          ? `El ${dest.name} (${dest.league}) mandó una oferta formal. Es el salto que todo futbolista de tu país sueña… y también un riesgo: allá la competencia es otra.`
          : `El ${dest.name} (${dest.league}) quiere llevarte. Salir de tu país es un cambio grande, con más exposición y más exigencia.`,
        options: [
          {
            id: dest.id,
            label: `Fichar por ${dest.name}`,
            clubId: dest.id,
            effect: isEurope ? "El salto a Europa" : "Salir al extranjero",
            risk: "Más competencia por el puesto",
            image: PEXELS.celebration,
          },
          { id: "stay", label: `Quedarte en ${s.club.name}`, clubId: s.club.id, effect: "Seguir siendo figura acá", risk: "Quizá no vuelvan a llamar" },
        ],
      };
    }

    case "mercado": {
      const offer = pick(clubPool({ tier, country: s.countryName, abroad, excludeIds: [s.club.id] }));
      const isStepUp = offer.tier > s.club.tier;
      return {
        kind,
        title: "Mercado de pases",
        description: `El ${offer.name} (${offer.league}) presentó una oferta por vos.`,
        options: [
          {
            id: offer.id,
            label: `Fichar por ${offer.name}`,
            clubId: offer.id,
            effect: isStepUp ? "Subís de categoría" : "Nuevo proyecto",
            risk: isStepUp ? "Vas a pelear el puesto" : undefined,
          },
          { id: "stay", label: `Quedarte en ${s.club.name}`, clubId: s.club.id, effect: "Continuidad y confianza" },
        ],
      };
    }

    case "competencia": {
      // El % sale del encaje real con el club, no de un número inventado.
      const titular = Math.round(clamp(55 + fit * 1.9 + s.form * 6, 15, 88));
      return {
        kind,
        title: "Competencia por el puesto",
        description: `El ${s.club.name} fichó a otro jugador para tu posición. El técnico dice que el puesto se gana en la cancha.`,
        options: [
          { id: "competir", label: "Quedarte a pelearlo", effect: `Titular ${titular}%`, risk: `Suplente ${100 - titular}%`, image: PEXELS.bench },
          { id: "salida", label: "Buscar salida", effect: "Minutos asegurados en otro club", risk: "Bajás un escalón", image: PEXELS.coach },
        ],
      };
    }

    case "mentor": {
      return {
        kind,
        title: "La joya de la cantera",
        description: "Un juvenil deslumbra en los entrenamientos y el club te pide que lo guíes. El vestuario lo notaría.",
        options: [
          { id: "mentor", label: "Apadrinarlo", effect: "El vestuario te respeta más", risk: "Le cedés algunos minutos", image: PEXELS.coach },
          { id: "no", label: "Enfocarte en lo tuyo", effect: "Todos los minutos para vos", risk: "Fama de egoísta" },
        ],
      };
    }

    case "seleccion": {
      return {
        kind,
        title: "Te llama la selección",
        description: `El seleccionador de ${s.countryName} te convocó. Es un orgullo, pero la gira internacional carga las piernas.`,
        options: [
          { id: "aceptar", label: "Aceptar la convocatoria", effect: "Reputación mundial", risk: "Más desgaste físico", image: PEXELS.celebration },
          { id: "rechazar", label: "Priorizar el club", effect: "Llegás entero a la temporada", risk: "Perdés el tren de la selección" },
        ],
      };
    }

    case "capitan": {
      return {
        kind,
        title: "El brazalete",
        description: `El ${s.club.name} busca capitán y tu nombre está sobre la mesa. Es responsabilidad, presión y también jerarquía.`,
        options: [
          { id: "aceptar", label: "Aceptar la capitanía", effect: "Referente del club", risk: "Toda la presión sobre vos", image: PEXELS.coach },
          { id: "rechazar", label: "Rechazarla", effect: "Jugar sin presión extra" },
        ],
      };
    }

    case "narrativo": {
      const events = [
        { title: "Problema fiscal", desc: "Una auditoría a tus finanzas se filtra a la prensa y te persigue todo el año.", penalty: 3 },
        { title: "Lesión muscular", desc: "Una rotura te deja fuera varios meses en el peor momento.", penalty: 5 },
        { title: "Cambio de entrenador", desc: "Llega un técnico nuevo que, de entrada, no cuenta con vos.", penalty: 2 },
        { title: "Estado de gracia", desc: "Todo lo que tocás termina en gol. Llegás al ciclo enchufadísimo.", penalty: -4 },
      ];
      const ev = pick(events);
      return {
        kind,
        title: ev.title,
        description: ev.desc,
        options: [
          {
            id: "aceptar",
            label: "Seguir adelante",
            effect: ev.penalty > 0 ? `${-ev.penalty} OVR temporal` : `+${-ev.penalty} OVR`,
            image: ev.penalty > 0 ? PEXELS.injury : PEXELS.celebration,
          },
        ],
      };
    }

    case "doble-turno": {
      const exito = Math.round(clamp(62 + fit * 1.2 - (s.age - 24) * 1.5, 25, 88));
      return {
        kind,
        title: "Doble turno",
        description: "El preparador físico te ofrece un plan de dos entrenamientos diarios. Podés dar un salto… o romperte.",
        options: [
          { id: "fondo", label: "Entrenar a fondo", effect: `Salto de nivel ${exito}%`, risk: `Lesión ${100 - exito}%`, image: PEXELS.training },
          { id: "carga", label: "Cuidar el cuerpo", effect: "Llegás sano todo el año", risk: "Crecés más lento" },
        ],
      };
    }

    case "declive": {
      const opts = clubPool({ tier: Math.max(1, tier - 1), country: s.countryName, abroad: false, excludeIds: [s.club.id] }).slice(0, 2);
      return {
        kind,
        title: "El cuerpo ya no responde igual",
        description: `En el ${s.club.name} empiezan a mirar hacia jugadores más jóvenes. Podés buscar un lugar donde sigas siendo importante.`,
        options: [
          ...opts.map((c) => ({ id: c.id, label: `Fichar por ${c.name}`, clubId: c.id, effect: c.league })),
          { id: "stay", label: `Resistir en ${s.club.name}`, clubId: s.club.id, effect: "Pelear un lugar", risk: "Cada vez menos minutos" },
        ],
      };
    }

    case "retiro-oferta": {
      return {
        kind,
        title: "¿Hasta cuándo?",
        description: "El cuerpo pesa más que antes y la prensa ya pregunta por tu retiro. Vos sabés cómo te sentís.",
        options: [
          { id: "seguir", label: "Seguir compitiendo", effect: "Una etapa más" },
          { id: "retirar", label: "Colgar los botines", effect: "Cerrar tu carrera" },
        ],
      };
    }

    default:
      return buildCanteraEvent(s.club, s.countryName);
  }
}

/**
 * Destinos del salto al extranjero. Prioriza las grandes ligas europeas —que
 * es lo que promete el evento— y solo cae a cualquier club de fuera si a tu
 * nivel todavía no hay opciones europeas.
 */
function CLUBS_ABROAD(s: CareerState, tier: number): CareerClub[] {
  const foreign = clubPool({ tier, country: s.countryName, abroad: true, excludeIds: [s.club.id] }).filter(
    (c) => c.country !== s.countryName
  );
  const european = foreign.filter((c) => EUROPEAN_LEAGUES.has(c.league));
  if (european.length) return european;
  if (foreign.length) return foreign;
  return clubPool({ tier, country: s.countryName, abroad: true, excludeIds: [s.club.id] });
}

/**
 * Qué evento toca ahora. No es una ruleta: la fase de carrera y tu situación
 * real en el club mandan.
 */
function pickEventKind(s: CareerState, prevKind: EventKind): EventKind {
  const fit = clubFit(s.ovr, s.club);
  const abroad = canGoAbroad(s);
  const playingAbroad = s.club.country !== s.countryName;

  // El salto a Europa es un momento único: se dispara la primera vez que
  // tenés cartel suficiente y todavía jugás en tu país.
  if (!playingAbroad && abroad && s.age <= 29 && s.reputation >= 34 && Math.random() < 0.65) {
    return "europa";
  }
  // Declive: a partir de cierta edad y con el nivel cayendo.
  if (s.age >= 31 && s.ovr < s.peakOvr - 4) {
    if (s.age >= 34 || Math.random() < 0.45) return Math.random() < 0.5 ? "declive" : "retiro-oferta";
  }
  // Selección: si tenés nivel y todavía no sos habitual.
  if (s.ovr >= 74 && s.caps === 0 && Math.random() < 0.6) return "seleccion";
  // Capitanía: veterano, con jerarquía y asentado.
  if (s.age >= 27 && s.reputation >= 45 && fit >= 0 && Math.random() < 0.3) return "capitan";

  // Cuando ya sos mejor que tu club, el mercado se mueve: es el mecanismo por
  // el que un jugador que rinde termina escalando a equipos grandes en vez de
  // quedarse toda la carrera en el mismo lugar.
  const pool: EventKind[] =
    fit <= -10
      ? ["competencia", "competencia", "prestamo", "narrativo", "doble-turno"]
      : fit >= 6
        ? ["mercado", "mercado", "mercado", "mentor", "narrativo", "doble-turno"]
        : ["mercado", "mercado", "competencia", "mentor", "narrativo", "doble-turno"];

  const filtered = pool.filter((k) => k !== prevKind);
  return pick(filtered.length ? filtered : pool);
}

// ---------------------------------------------------------------------------
// Resolución de la decisión → simulación → siguiente evento

export function resolveOption(s: CareerState, optionId: string): CareerState {
  const event = s.pendingEvent;
  if (!event) return s;

  if (event.kind === "retiro-oferta" && optionId === "retirar") {
    return { ...s, retired: true, pendingEvent: null };
  }

  let next: CareerState = { ...s };
  let minutes = 1;
  let bonusTrophies: string[] = [];
  let injured = false;
  const opt = event.options.find((o) => o.id === optionId);

  switch (event.kind) {
    case "cantera":
    case "prestamo":
    case "regreso":
    case "europa":
    case "mercado":
    case "declive": {
      if (opt?.clubId && opt.id !== "stay") {
        const target = findClub(opt.clubId);
        if (target) {
          // Al salir cedido se recuerda el club dueño del pase.
          next.parentClubId = event.kind === "prestamo" ? s.club.id : null;
          next.club = target;
        }
      } else if (event.kind === "prestamo" || event.kind === "regreso") {
        next.parentClubId = null;
      }
      break;
    }
    case "competencia": {
      if (optionId === "competir") {
        const titular = Number(event.options[0].effect.replace(/\D/g, ""));
        minutes = Math.random() * 100 < titular ? 1.1 : 0.4;
      } else {
        const dest = pick(clubPool({ tier: Math.max(1, interestTier(s) - 1), country: s.countryName, abroad: canGoAbroad(s), excludeIds: [s.club.id] }));
        next.club = dest;
        minutes = 1;
      }
      break;
    }
    case "mentor": {
      if (optionId === "mentor") {
        minutes = 0.82;
        next.reputation = clamp(s.reputation + 4, 0, 100);
        if (Math.random() < 0.35) bonusTrophies.push("Premio al liderazgo");
      }
      break;
    }
    case "seleccion": {
      if (optionId === "aceptar") {
        next.caps = s.caps + rand(6, 12);
        next.reputation = clamp(s.reputation + 8, 0, 100);
        minutes = 0.92; // desgaste de la gira
      } else {
        next.reputation = clamp(s.reputation - 3, 0, 100);
      }
      break;
    }
    case "capitan": {
      if (optionId === "aceptar") {
        next.reputation = clamp(s.reputation + 6, 0, 100);
        // La presión: puede potenciarte o pesarte.
        minutes = Math.random() < 0.7 ? 1.08 : 0.9;
      }
      break;
    }
    case "doble-turno": {
      if (optionId === "fondo") {
        const exito = Number(event.options[0].effect.replace(/\D/g, ""));
        if (Math.random() * 100 < exito) {
          minutes = 1.12;
          next.potential = Math.min(99, s.potential + rand(1, 3)); // rompés tu techo
        } else {
          minutes = 0.45;
          injured = true;
          next.penaltyOvr = s.penaltyOvr + 3;
        }
      } else {
        minutes = 0.88;
      }
      break;
    }
    case "narrativo": {
      const delta = Number(event.options[0].effect.match(/-?\d+/)?.[0] ?? 0);
      if (delta < 0) {
        next.penaltyOvr = s.penaltyOvr + Math.abs(delta);
        injured = event.title.includes("Lesión");
        if (injured) minutes = 0.6;
      } else {
        next.form = clamp(s.form + 0.5, -1, 1);
      }
      break;
    }
  }

  // --- Simulación de la etapa -------------------------------------------
  const result = simulateStage(next, minutes);
  const ovrBefore = next.ovr;
  const ovrAfter = clamp(
    Math.min(next.potential + 2, next.ovr + result.ovrDelta) - next.penaltyOvr,
    40,
    99
  );

  const trophies = [...bonusTrophies, ...rollTrophies(next, result.performance)];
  const caps = rollCaps(next, result.performance);

  const awardCtx: AwardContext = {
    position: next.position,
    age: next.age,
    ovr: ovrAfter,
    gls: result.gls,
    pj: result.pj,
    performance: result.performance,
    clubTier: next.club.tier,
    reputation: next.reputation,
    trophies,
  };
  const awards = detectAwards(awardCtx, Math.random);

  const totalPj = next.totalPj + result.pj;
  const totalGls = next.totalGls + result.gls;
  const totalAst = next.totalAst + result.ast;
  const totalCaps = next.caps + caps;

  const milestoneCtx: MilestoneContext = {
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
  };
  const milestones = detectMilestones(milestoneCtx);

  const outcome: StageOutcome = {
    ageFrom: next.age,
    ageTo: next.age + 2,
    clubName: next.club.name,
    pj: result.pj,
    gls: result.gls,
    ast: result.ast,
    ovrBefore,
    ovrAfter,
    performance: result.performance,
    starter: result.starter,
    trophies,
    awards,
    milestones,
    injured,
  };

  const reputation = updateReputation(next, result, trophies, awards, caps);
  const newAge = next.age + 2;

  const advanced: CareerState = {
    ...next,
    age: newAge,
    ovr: ovrAfter,
    peakOvr: Math.max(next.peakOvr, ovrAfter),
    marketValue: marketValueFromOvr(ovrAfter, newAge, reputation),
    peakValue: Math.max(next.peakValue, marketValueFromOvr(ovrAfter, newAge, reputation)),
    totalPj,
    totalGls,
    totalAst,
    caps: totalCaps,
    reputation,
    form: clamp(next.form * 0.5 + (result.performance - 1) * 0.8, -1, 1),
    penaltyOvr: Math.max(0, next.penaltyOvr - 3),
    trophies: [...next.trophies, ...trophies.map((label) => ({ label, age: next.age, club: next.club.name }))],
    awards: [...next.awards, ...awards.map((label) => ({ label, age: next.age, club: next.club.name }))],
    history: [
      ...next.history,
      { age: next.age, club: next.club, ovr: ovrAfter, pj: result.pj, gls: result.gls, ast: result.ast, trophies },
    ],
    lastStage: outcome,
  };

  // Retiro: por edad tope, o por nivel demasiado bajo pasados los 33.
  if (newAge >= 38 || (newAge >= 33 && ovrAfter < 56)) {
    return { ...advanced, retired: true, pendingEvent: null };
  }

  const nextKind = newAge === 18 && advanced.club.tier >= 3 ? "prestamo" : pickEventKind(advanced, event.kind);
  return { ...advanced, pendingEvent: buildEvent(advanced, nextKind) };
}

/** Texto narrativo de la última etapa (lo usa la UI). */
export function lastStageNarrative(s: CareerState): string | null {
  if (!s.lastStage) return null;
  return stageNarrative(s.lastStage, s.position);
}
