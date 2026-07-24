// Motor puro de Tu Leyenda: generación del jugador, curva de progresión
// (crece en la juventud, pico ~28-30, decae después) y el árbol de eventos
// con decisiones. Todo determinista salvo por `Math.random`, así que las
// pantallas solo leen el estado — no hay lógica de juego en los componentes.
//
// Modelo de "encaje" (fit): cada club tiene un OVR de plantilla esperado
// según su tier real (expectedOvrForTier). fit = tu OVR - ese esperado.
//   fit muy negativo → el club te queda grande: menos minutos, más chance
//     de ir a préstamo o de competir por el puesto, casi no ganas títulos.
//   fit muy positivo → eres mejor que el nivel del club: minutos asegurados,
//     los grandes se fijan en ti (más "mercado de pases").
// Los títulos dependen sobre todo del TIER del club (un tier 5 gana ligas
// todo el tiempo, un tier 1 casi nunca), con el fit como ajuste fino.
import { CareerClub, PitchPosition, canteraClubs, clubsForCountry, expectedOvrForTier, findClub, tierFromOvr } from "./careerData";

export interface CareerTrophy {
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
  effect: string; // texto visible: "Titular 65% / Lesión 35%", "+3 OVR", etc.
  risk?: string;
  image?: string; // foto de contexto (Pexels) cuando la opción trae % de riesgo
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
  | "competencia"
  | "mentor"
  | "narrativo"
  | "doble-turno"
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
  peakOvr: number;
  marketValue: number;
  peakValue: number;
  club: CareerClub;
  totalPj: number;
  totalGls: number;
  totalAst: number;
  trophies: CareerTrophy[];
  awards: string[];
  caps: number;
  history: CareerStage[];
  penaltyOvr: number; // penalización temporal (problema fiscal, lesión…), se disuelve con el tiempo
  retired: boolean;
  pendingEvent: CareerEvent | null;
}

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Fotos de Pexels que ilustran cada tipo de decisión con porcentaje.
import { PEXELS } from "./careerData";

// Cuánto mejor/peor eres que lo que ese club espera de su plantilla titular.
export function clubFit(ovr: number, club: CareerClub): number {
  return ovr - expectedOvrForTier(club.tier);
}

// Curva logarítmica (misma familia que valueFromOverall del backend real,
// calibrada contra valores de mercado reales de FotMob): a diferencia de una
// exponencial simple, no dispara a cientos de millones apenas se sale de los
// 60-70 de rating.
export function marketValueFromOvr(ovr: number, age: number): number {
  const base = Math.pow(10, (ovr - 7.4) / 10.4);
  const ageFactor = age <= 24 ? 1.1 : age <= 29 ? 1 : age <= 33 ? 0.55 : 0.25;
  return Math.max(50_000, Math.round((base * ageFactor) / 10_000) * 10_000);
}

export function newCareer(input: {
  surname: string;
  number: number;
  foot: "Izquierda" | "Derecha";
  countryName: string;
  countryCode: string;
  position: PitchPosition;
}): CareerState {
  const ovr = 50 + rand(-2, 3);
  const club = pick(canteraClubs(input.countryName));
  return {
    ...input,
    age: 16,
    ovr,
    peakOvr: ovr,
    marketValue: marketValueFromOvr(ovr, 16),
    peakValue: marketValueFromOvr(ovr, 16),
    club,
    totalPj: 0,
    totalGls: 0,
    totalAst: 0,
    trophies: [],
    awards: [],
    caps: 0,
    history: [],
    penaltyOvr: 0,
    retired: false,
    pendingEvent: buildCanteraEvent(club, input.countryName),
  };
}

function buildCanteraEvent(currentClub: CareerClub, country: string): CareerEvent {
  const others = canteraClubs(country).filter((c) => c.id !== currentClub.id);
  const options: CareerClub[] = [currentClub, ...others].slice(0, 3);
  return {
    kind: "cantera",
    title: "Oferta de cantera",
    description: "Tres clubes quieren sumarte a su proyecto juvenil. Elegí dónde empieza tu carrera.",
    options: options.map((c) => ({
      id: c.id,
      label: `Fichar por ${c.name}`,
      clubId: c.id,
      effect: `${c.league}`,
    })),
  };
}

// Multiplicador de minutos según qué tan grande te queda el club (ver
// clubFit): a un club que te queda grande no te van a poner de titular
// seguido, a uno que te queda chico casi no te sacan.
function fitMultiplier(fit: number): number {
  if (fit <= -15) return 0.45;
  if (fit <= -8) return 0.65;
  if (fit <= 0) return 0.85;
  if (fit <= 10) return 1;
  return 1.15;
}

// Simula una etapa (~2 años) con el club/decisión actual: minutos, goles,
// asistencias y evolución de OVR, según edad, encaje con el club y
// penalizaciones activas.
function simulateStage(s: CareerState, minutesShare: number): { pj: number; gls: number; ast: number; ovrDelta: number } {
  const effectiveShare = clamp(minutesShare * fitMultiplier(clubFit(s.ovr, s.club)), 0.15, 1.3);
  const basePj = Math.round(rand(20, 34) * effectiveShare);
  const attack = s.position === "DC" || s.position === "EI" || s.position === "ED" ? 1.3 : s.position === "MCO" ? 1 : 0.4;
  const gls = Math.max(0, Math.round((basePj / 10) * attack * (s.ovr / 65) * (Math.random() * 0.6 + 0.7)));
  const ast = Math.max(0, Math.round((basePj / 12) * (attack * 0.6 + 0.4) * (Math.random() * 0.6 + 0.7)));

  let ovrDelta: number;
  if (s.age <= 21) ovrDelta = rand(4, 9) * effectiveShare;
  else if (s.age <= 27) ovrDelta = rand(2, 6) * effectiveShare;
  else if (s.age <= 30) ovrDelta = rand(-1, 3);
  else if (s.age <= 33) ovrDelta = rand(-4, 0);
  else ovrDelta = rand(-8, -3);

  return { pj: basePj, gls, ast, ovrDelta: Math.round(ovrDelta) };
}

function closeStage(s: CareerState, sim: { pj: number; gls: number; ast: number; ovrDelta: number }, trophies: string[]): CareerState {
  const ovr = Math.max(40, Math.min(99, s.ovr + sim.ovrDelta - s.penaltyOvr));
  const stage: CareerStage = { age: s.age, club: s.club, ovr, pj: sim.pj, gls: sim.gls, ast: sim.ast, trophies };
  return {
    ...s,
    ovr,
    peakOvr: Math.max(s.peakOvr, ovr),
    marketValue: marketValueFromOvr(ovr, s.age),
    peakValue: Math.max(s.peakValue, marketValueFromOvr(ovr, s.age)),
    totalPj: s.totalPj + sim.pj,
    totalGls: s.totalGls + sim.gls,
    totalAst: s.totalAst + sim.ast,
    history: [...s.history, stage],
    penaltyOvr: Math.max(0, s.penaltyOvr - 2),
    trophies: [...s.trophies, ...trophies.map((label) => ({ label, age: s.age, club: s.club.name }))],
  };
}

// La chance de título depende sobre todo de qué tan grande es el club real
// (tier), no de tu OVR personal — un club chico casi nunca sale campeón
// aunque tú rindas; uno grande gana seguido aunque tú no seas titular fijo.
function maybeTrophy(s: CareerState): string[] {
  const baseByTier = [0, 0.02, 0.06, 0.15, 0.32, 0.55][s.club.tier] ?? 0.02;
  const fit = clubFit(s.ovr, s.club);
  const chance = clamp(baseByTier + clamp(fit / 300, -0.08, 0.12), 0.01, 0.75);
  if (Math.random() > chance) return [];
  const options = s.club.tier >= 3 ? ["Liga", "Copa Nacional", "Copa Continental"] : ["Liga", "Copa Nacional"];
  return [pick(options)];
}

function maybeCap(s: CareerState): number {
  if (s.ovr < 74) return 0;
  const chance = s.ovr >= 88 ? 0.8 : s.ovr >= 80 ? 0.45 : 0.15;
  return Math.random() < chance ? rand(1, 4) : 0;
}

// Elige el siguiente tipo de evento según edad, fase de carrera y encaje
// con el club actual: si el club te queda grande, más "competencia"/
// "préstamo"; si te queda chico, más "mercado" (los grandes se fijan en ti).
function pickEventKind(s: CareerState, lastKind: EventKind | null): EventKind {
  const declining = s.age >= 31 && s.ovr < s.peakOvr - 5;
  if (declining && Math.random() < 0.4) return Math.random() < 0.5 ? "declive" : "retiro-oferta";

  const fit = clubFit(s.ovr, s.club);
  let pool: EventKind[];
  if (fit <= -10) {
    pool = ["competencia", "competencia", "prestamo", "prestamo", "narrativo", "doble-turno"];
  } else if (fit >= 10) {
    pool = ["mercado", "mercado", "mentor", "narrativo", "doble-turno"];
  } else {
    pool = ["mercado", "competencia", "mentor", "narrativo", "doble-turno"];
  }
  const filtered = pool.filter((k) => k !== lastKind);
  return pick(filtered.length ? filtered : pool);
}

function buildEvent(s: CareerState, kind: EventKind, lastClubId: string | null): CareerEvent {
  const tier = tierFromOvr(s.ovr);
  const fit = clubFit(s.ovr, s.club);
  switch (kind) {
    case "prestamo": {
      // A préstamo, un escalón (o dos si el club te queda muy grande) por
      // debajo de tu club actual — así sumas minutos de verdad.
      const targetTier = Math.max(1, s.club.tier - (fit <= -15 ? 2 : 1));
      const opts = clubsForCountry(s.countryName, targetTier, [s.club.id]).slice(0, 2);
      return {
        kind,
        title: "Salida a préstamo",
        description: "Tu club quiere que sumes minutos en otro equipo. Elegí dónde seguir tu desarrollo.",
        options: opts.map((c) => ({ id: c.id, label: `Préstamo en ${c.name}`, clubId: c.id, effect: c.league })),
      };
    }
    case "regreso": {
      const alt1 = pick(clubsForCountry(s.countryName, tier, [s.club.id]));
      const alt2 = pick(clubsForCountry(s.countryName, tier, [s.club.id, alt1.id]));
      return {
        kind,
        title: "Regreso a tu club",
        description: "Volvés a tu club y vas a ser tenido en cuenta. Si igual querés salir, tenés dos ofertas para cambiar de aire.",
        options: [
          { id: alt1.id, label: `Fichar por ${alt1.name}`, clubId: alt1.id, effect: alt1.league },
          { id: alt2.id, label: `Fichar por ${alt2.name}`, clubId: alt2.id, effect: alt2.league },
          { id: "stay", label: `Quedarse en ${s.club.name}`, clubId: s.club.id, effect: "Continuidad" },
        ],
      };
    }
    case "mercado": {
      const upTier = Math.min(5, tier + 1);
      const offer = pick(clubsForCountry(s.countryName, upTier, [s.club.id]));
      return {
        kind,
        title: "Mercado de pases",
        description: `${offer.name} (${offer.league}) presentó una oferta por vos. Podés aceptar el reto o quedarte a pelear tu lugar.`,
        options: [
          { id: offer.id, label: `Fichar por ${offer.name}`, clubId: offer.id, effect: "Más exigencia, más nivel" },
          { id: "stay", label: `Quedarse en ${s.club.name}`, clubId: s.club.id, effect: "Continuidad, menos riesgo" },
        ],
      };
    }
    case "competencia": {
      // El % de titularidad refleja el encaje real: si el club te queda
      // grande, vas a jugar mucho menos que si te queda chico.
      const titular = clamp(55 + fit * 1.8, 15, 85);
      return {
        kind,
        title: "Competencia por el puesto",
        description: "El club incorpora a otro jugador para competir por tu lugar.",
        options: [
          { id: "competir", label: "Competir", effect: `Titular ${titular}%`, risk: `Rotación baja ${100 - titular}%`, image: PEXELS.bench },
          { id: "salida", label: "Buscar salida", effect: "Cambiar de aire", risk: "Empezar de cero", image: PEXELS.celebration },
        ],
      };
    }
    case "mentor": {
      return {
        kind,
        title: "Promesa inesperada",
        description: "El club te pide ser mentor de un juvenil prometedor.",
        options: [
          { id: "mentor", label: "Aceptar ser mentor", effect: "Más chance de campeón", risk: "Menos minutos", image: PEXELS.coach },
          { id: "no", label: "Rechazar y seguir enfocado", effect: "Minutos completos", risk: "Sin bono de vestuario" },
        ],
      };
    }
    case "narrativo": {
      const events = [
        { title: "Problema fiscal", desc: "Una auditoría a tus finanzas te distrae de las canchas.", penalty: 3 },
        { title: "Lesión muscular", desc: "Una molestia te deja fuera varias semanas justo en pretemporada.", penalty: 4 },
        { title: "Cambio de entrenador", desc: "El nuevo DT no cuenta contigo al inicio.", penalty: 2 },
        { title: "Racha de forma", desc: "Llegás a la etapa en el mejor momento de tu carrera.", penalty: -3 },
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
      const titular = clamp(60 + fit * 1.5, 20, 85);
      return {
        kind,
        title: "Doble turno",
        description: "Dos entrenamientos al día para mejorar tu rendimiento.",
        options: [
          { id: "fondo", label: "Entrenar a fondo", effect: `Titular ${titular}%`, risk: `Lesión ${100 - titular}%`, image: PEXELS.training },
          { id: "carga", label: "Bajar la carga", effect: "Menos minutos", risk: "Sin riesgo de lesión" },
        ],
      };
    }
    case "declive": {
      const opts = clubsForCountry(s.countryName, Math.max(1, tier - 1), [s.club.id, lastClubId ?? ""]).slice(0, 2);
      return {
        kind,
        title: "El cuerpo ya no responde igual",
        description: "Tu rendimiento bajó y el club evalúa tu continuidad. Opciones para seguir compitiendo.",
        options: [
          ...opts.map((c) => ({ id: c.id, label: `Fichar por ${c.name}`, clubId: c.id, effect: c.league })),
          { id: "stay", label: `Resistir en ${s.club.name}`, clubId: s.club.id, effect: "Menos protagonismo" },
        ],
      };
    }
    case "retiro-oferta": {
      return {
        kind,
        title: "¿Hasta cuándo seguís?",
        description: "El cuerpo técnico te pregunta directamente sobre tu futuro.",
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

export function resolveOption(s: CareerState, optionId: string): CareerState {
  const event = s.pendingEvent;
  if (!event) return s;

  if (event.kind === "retiro-oferta" && optionId === "retirar") {
    return { ...s, retired: true, pendingEvent: null };
  }

  let next = s;
  let minutesShare = 1;
  let trophiesThisStage: string[] = [];

  if (event.kind === "cantera" || event.kind === "prestamo" || event.kind === "mercado" || event.kind === "declive") {
    const opt = event.options.find((o) => o.id === optionId);
    if (opt?.clubId && opt.id !== "stay") next = { ...s, club: findClub(opt.clubId) ?? s.club };
  } else if (event.kind === "regreso") {
    const opt = event.options.find((o) => o.id === optionId);
    if (opt?.clubId && opt.id !== "stay") next = { ...s, club: findClub(opt.clubId) ?? s.club };
  } else if (event.kind === "competencia") {
    if (optionId === "competir") {
      const titular = Number(event.options[0].effect.replace(/\D/g, ""));
      minutesShare = Math.random() * 100 < titular ? 1 : 0.4;
    } else {
      const opts = clubsForCountry(s.countryName, tierFromOvr(s.ovr), [s.club.id]);
      next = { ...s, club: pick(opts) };
      minutesShare = 0.7;
    }
  } else if (event.kind === "mentor") {
    if (optionId === "mentor") {
      minutesShare = 0.75;
      if (Math.random() < 0.4) trophiesThisStage.push("Reconocimiento al mentor del año");
    }
  } else if (event.kind === "doble-turno") {
    if (optionId === "fondo") {
      const titular = Number(event.options[0].effect.replace(/\D/g, ""));
      minutesShare = Math.random() * 100 < titular ? 1.15 : 0.5;
    } else {
      minutesShare = 0.8;
    }
  } else if (event.kind === "narrativo") {
    const penaltyMatch = event.options[0].effect.match(/-?\d+/);
    const delta = penaltyMatch ? Number(penaltyMatch[0]) : 0;
    if (delta > 0) next = { ...s, penaltyOvr: s.penaltyOvr + delta };
    else next = { ...s, ovr: Math.min(99, s.ovr - delta), peakOvr: Math.max(s.peakOvr, s.ovr - delta) };
  } else if (event.kind === "retiro-oferta") {
    minutesShare = 1;
  }

  const sim = simulateStage(next, minutesShare);
  const wonTrophies = [...trophiesThisStage, ...maybeTrophy(next)];
  next = closeStage(next, sim, wonTrophies);
  next = { ...next, caps: next.caps + maybeCap(next) };

  const newAge = next.age + 2;
  const willRetire = newAge >= 38 || (newAge >= 33 && next.ovr < 55);

  if (willRetire) {
    return { ...next, age: newAge, retired: true, pendingEvent: null };
  }

  const nextKind = pickNextKind(next, newAge, event.kind);
  const nextEvent = buildEvent({ ...next, age: newAge }, nextKind, s.club.id);
  return { ...next, age: newAge, pendingEvent: nextEvent };
}

function pickNextKind(s: CareerState, newAge: number, prevKind: EventKind): EventKind {
  if (newAge === 18) return "prestamo";
  if (newAge === 20) return "regreso";
  return pickEventKind({ ...s, age: newAge }, prevKind);
}
