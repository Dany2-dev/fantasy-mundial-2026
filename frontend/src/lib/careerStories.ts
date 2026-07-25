// Guion de Tu Leyenda: el catálogo de historias que hacen que una carrera se
// sienta vivida y no simulada.
//
// CÓMO FUNCIONA
//  · Cada historia declara CUÁNDO puede aparecer (`when`) y con qué peso.
//    El motor sortea entre las elegibles, así que a los 17 te pasan cosas de
//    juvenil y a los 35 cosas de veterano — nunca al revés.
//  · `once: true` marca los momentos irrepetibles (tu debut, la capitanía).
//    Se recuerdan en `flags`, que también permite CALLBACKS: una decisión de
//    los 19 puede volver a aparecer a los 30.
//  · Los efectos son declarativos (`StoryOutcome`) para que el motor los
//    aplique en un solo lugar y no haya lógica de juego dispersa.
//  · Hay personajes con nombre (tu representante, tu rival de siempre) que
//    reaparecen a lo largo de los años: es lo que le da continuidad al relato.

import { CareerClub, PitchPosition } from "./careerData";

export interface StoryContext {
  surname: string;
  age: number;
  ovr: number;
  potential: number;
  reputation: number;
  club: CareerClub;
  countryName: string;
  position: PitchPosition;
  /** Qué tan por encima/debajo estás del nivel que pide tu club. */
  fit: number;
  form: number;
  caps: number;
  trophies: number;
  totalGls: number;
  totalPj: number;
  injuries: number;
  flags: string[];
  rivalName: string;
  agentName: string;
  friendName: string;
  coachName: string;
  isGK: boolean;
  clubAbroad: boolean;
}

/** Efectos declarativos. El motor los aplica; las historias solo los describen. */
export interface StoryOutcome {
  /** Multiplicador de minutos de la temporada (1 = normal). */
  minutes?: number;
  ovr?: number;
  potential?: number;
  reputation?: number;
  form?: number;
  caps?: number;
  /** Penalización temporal de OVR (lesión, escándalo…). */
  penaltyOvr?: number;
  injuries?: number;
  addFlag?: string;
  bonusTrophy?: string;
  /** Si la opción es una apuesta, se resuelve con la ruleta de la suerte. */
  luck?: {
    chance: number;
    successLabel: string;
    failLabel: string;
    onSuccess: StoryOutcome;
    onFail: StoryOutcome;
  };
}

export interface StoryOption {
  id: string;
  label: string;
  effect: string;
  risk?: string;
  image?: string;
  outcome: StoryOutcome;
}

export interface StoryEvent {
  id: string;
  title: string;
  text: (c: StoryContext) => string;
  when: (c: StoryContext) => boolean;
  /** Más peso = aparece más seguido entre las elegibles. */
  weight?: number;
  once?: boolean;
  options: (c: StoryContext) => StoryOption[];
}

// --- Personajes -------------------------------------------------------------
// Nombres neutros y variados; se sortean al crear la carrera y acompañan al
// jugador toda la vida deportiva.

export const RIVAL_NAMES = [
  "Bruno Salas", "Iker Montiel", "Dani Vergara", "Leo Ferrari", "Mateo Rivas",
  "Adrián Cortés", "Nico Bianchi", "Tomás Aguirre", "Rafa Molina", "Erik Sandoval",
];
export const AGENT_NAMES = [
  "Vicente Arana", "Marta Solís", "Gio Ferraro", "Hugo Beltrán", "Elena Duarte",
  "Paco Ordóñez", "Sasha Petrov", "Claudia Reyes",
];
export const FRIEND_NAMES = [
  "Andrés", "Kevin", "Facu", "Yaya", "Pipe", "Toni", "Marco", "Chema", "Lucho", "Beto",
];
export const COACH_NAMES = [
  "Del Bosque", "Herrera", "Krauss", "Bianchi", "Ferreira", "Novak", "Lombardi", "Mendes",
];

const has = (c: StoryContext, flag: string) => c.flags.includes(flag);

// ---------------------------------------------------------------------------
// CATÁLOGO
// ---------------------------------------------------------------------------

export const STORIES: StoryEvent[] = [
  // ======================= JUVENIL (16-21) ================================
  {
    id: "debut",
    title: "Tu debut profesional",
    once: true,
    weight: 6,
    // Solo tiene sentido si de verdad todavía no jugaste: sin el corte por
    // partidos aparecía tu "debut" con 49 encuentros ya disputados.
    when: (c) => c.age >= 17 && c.age <= 21 && c.totalPj < 12 && !has(c, "debut"),
    text: (c) =>
      `${c.coachName} te cruza en el pasillo y te lo suelta sin ceremonia: "Mañana arrancás vos". ` +
      `Es tu debut con el ${c.club.name}. Esa noche no vas a dormir.`,
    options: () => [
      {
        id: "salir-comer",
        label: "Salir a comerte el partido",
        effect: "Si te sale, nace una estrella",
        risk: "Los nervios pueden traicionarte",
        outcome: {
          addFlag: "debut",
          luck: {
            chance: 58,
            successLabel: "Debut soñado: el estadio coreó tu nombre",
            failLabel: "Los nervios te ganaron y te sacaron al entretiempo",
            onSuccess: { reputation: 6, form: 0.5, minutes: 1.1, ovr: 1 },
            onFail: { form: -0.4, minutes: 0.8 },
          },
        },
      },
      {
        id: "sencillo",
        label: "Jugar sencillo, sin riesgos",
        effect: "Debut discreto pero solvente",
        outcome: { addFlag: "debut", minutes: 1, form: 0.15, reputation: 2 },
      },
    ],
  },

  {
    id: "nostalgia",
    title: "Lejos de casa",
    once: true,
    weight: 3,
    when: (c) => c.age <= 22 && !has(c, "nostalgia"),
    text: (c) =>
      `Llevás meses en la pensión del club. Tu vieja te llama todos los domingos y vos cortás rápido ` +
      `para que no te escuche la voz. Nadie te dijo que ser futbolista fuera tan solitario.`,
    options: (c) => [
      {
        id: "aguantar",
        label: "Apretar los dientes y quedarte",
        effect: "Te hacés fuerte de la cabeza",
        outcome: { addFlag: "resiliente", form: 0.3, reputation: 1 },
      },
      {
        id: "familia",
        label: `Traer a tu familia a ${c.club.country}`,
        effect: "Recuperás el equilibrio",
        risk: "Te distrae del entrenamiento un tiempo",
        outcome: { addFlag: "familia-cerca", minutes: 0.92, form: 0.45 },
      },
    ],
  },

  {
    id: "rival-cantera",
    title: "El otro juvenil",
    once: true,
    weight: 5,
    when: (c) => c.age <= 23 && !has(c, "rival"),
    text: (c) =>
      `${c.rivalName} llegó a la cantera el mismo año que vos y juega en tu puesto. ` +
      `El club solo va a subir a uno al primer equipo. El vestuario ya eligió bando.`,
    options: (c) => [
      {
        id: "competir",
        label: "Ganarle el puesto en la cancha",
        effect: "Si lo superás, sos vos el elegido",
        risk: `${c.rivalName} también sabe jugar`,
        outcome: {
          addFlag: "rival",
          luck: {
            chance: 55,
            successLabel: "Le ganaste el puesto: el club apostó por vos",
            failLabel: "Se quedó con el lugar y a vos te mandaron a esperar",
            onSuccess: { minutes: 1.15, reputation: 4, form: 0.4, addFlag: "rival-ganado" },
            onFail: { minutes: 0.55, form: -0.3, addFlag: "rival-perdido" },
          },
        },
      },
      {
        id: "aliarse",
        label: "Hacerte su amigo",
        effect: "El vestuario te adopta",
        risk: "Compartís minutos",
        outcome: { addFlag: "rival-amigo", minutes: 0.85, reputation: 2, form: 0.2 },
      },
    ],
  },

  {
    id: "representante",
    title: "Tu primer representante",
    once: true,
    weight: 5,
    when: (c) => c.age >= 17 && c.age <= 24 && !has(c, "agente"),
    text: (c) =>
      `${c.agentName} te espera en la puerta del predio con un contrato de representación. ` +
      `"Yo te llevo a Europa", promete. Tu papá desconfía; tu compañero ${c.friendName} dice que es el mejor.`,
    options: (c) => [
      {
        id: "firmar",
        label: `Firmar con ${c.agentName}`,
        effect: "Te abre puertas en el mercado",
        risk: "Se lleva su tajada y te presiona",
        outcome: { addFlag: "agente-tiburon", reputation: 6 },
      },
      {
        id: "familia",
        label: "Que te represente tu familia",
        effect: "Nadie decide por vos",
        risk: "Menos contactos, menos ofertas",
        outcome: { addFlag: "agente-familia", form: 0.25 },
      },
    ],
  },

  {
    id: "estudios",
    title: "La otra vida",
    once: true,
    weight: 2,
    when: (c) => c.age >= 17 && c.age <= 20 && !has(c, "estudios"),
    text: () =>
      `Los horarios del club chocan con la facultad. Tenés que elegir: la carrera que empezaste ` +
      `de suplente por si el fútbol no sale, o apostar todo a la pelota.`,
    options: () => [
      {
        id: "todo-futbol",
        label: "Apostar todo al fútbol",
        effect: "Entrenás el doble",
        risk: "Sin plan B",
        outcome: { addFlag: "sin-plan-b", minutes: 1.08, potential: 2 },
      },
      {
        id: "equilibrio",
        label: "Sostener las dos cosas",
        effect: "Cabeza amueblada para toda la carrera",
        risk: "Menos horas de entrenamiento",
        outcome: { addFlag: "estudioso", minutes: 0.93, form: 0.3 },
      },
    ],
  },

  // ======================= ASCENSO (21-28) ================================
  {
    id: "portada",
    title: "La portada",
    once: true,
    weight: 4,
    when: (c) => c.age >= 20 && c.reputation >= 18 && !has(c, "portada"),
    text: (c) =>
      `Por primera vez sos tapa de un diario deportivo: "${c.surname.toUpperCase()}, LA NUEVA JOYA". ` +
      `Al día siguiente hay tres cámaras esperándote en el estacionamiento del club.`,
    options: () => [
      {
        id: "disfrutar",
        label: "Disfrutar el momento",
        effect: "Tu nombre suena en todos lados",
        risk: "La presión también sube",
        outcome: { addFlag: "mediatico", reputation: 9, form: -0.15 },
      },
      {
        id: "perfil-bajo",
        label: "Mantener perfil bajo",
        effect: "Cero distracciones",
        outcome: { addFlag: "perfil-bajo", form: 0.35, reputation: 2 },
      },
    ],
  },

  {
    id: "noche",
    title: "La noche te llama",
    weight: 3,
    when: (c) => c.age >= 19 && c.age <= 28,
    text: (c) =>
      `${c.friendName} organiza una salida después del partido. "Una noche no le hace mal a nadie", insiste. ` +
      `El problema es que mañana hay entrenamiento a las 8 y el técnico controla los pesajes.`,
    options: (c) => [
      {
        id: "salir",
        label: "Salir con los muchachos",
        effect: "Vestuario unido",
        risk: "Si te agarran, se pudre",
        outcome: {
          luck: {
            chance: 55,
            successLabel: "Nadie se enteró y el grupo quedó más unido",
            failLabel: `${c.coachName} se enteró: multa y suplencia`,
            onSuccess: { form: 0.3, reputation: 1 },
            onFail: { minutes: 0.7, form: -0.5, reputation: -4 },
          },
        },
      },
      {
        id: "quedarse",
        label: "Quedarte a descansar",
        effect: "Llegás entero al entrenamiento",
        outcome: { form: 0.2, minutes: 1.03 },
      },
    ],
  },

  {
    id: "clasico",
    title: "El clásico",
    weight: 2,
    when: (c) => c.age >= 19 && c.club.tier >= 2,
    text: (c) =>
      `Se viene el clásico. La ciudad está partida al medio y el ${c.club.name} no gana hace tres. ` +
      `${c.coachName} te mira en la charla técnica más tiempo del necesario.`,
    options: () => [
      {
        id: "asumir",
        label: "Pedir la pelota siempre",
        effect: "Si aparecés, sos ídolo",
        risk: "Si fallás, sos el culpable",
        outcome: {
          luck: {
            chance: 52,
            successLabel: "Fuiste la figura del clásico: la hinchada te canta",
            failLabel: "Te comieron en el clásico y la prensa fue durísima",
            onSuccess: { reputation: 10, form: 0.5 },
            onFail: { reputation: -5, form: -0.45 },
          },
        },
      },
      {
        id: "cumplir",
        label: "Jugar para el equipo",
        effect: "Partido sobrio, sin riesgos",
        outcome: { form: 0.15, reputation: 2 },
      },
    ],
  },

  {
    id: "publicidad",
    title: "La marca deportiva",
    once: true,
    weight: 3,
    when: (c) => c.reputation >= 30 && !has(c, "publicidad"),
    text: (c) =>
      `Una marca deportiva quiere ficharte como imagen. Sesión de fotos, spot de TV y un cheque ` +
      `que multiplica tu sueldo. ${c.agentName} ya dijo que sí sin consultarte.`,
    options: () => [
      {
        id: "aceptar",
        label: "Firmar el contrato",
        effect: "Tu cara en todas partes",
        risk: "Rodajes en plena pretemporada",
        outcome: { addFlag: "imagen-marca", reputation: 12, minutes: 0.94 },
      },
      {
        id: "rechazar",
        label: "Rechazarlo y enfocarte",
        effect: "Temporada sin distracciones",
        outcome: { form: 0.4, minutes: 1.05 },
      },
    ],
  },

  {
    id: "cambio-posicion",
    title: "Reinventarte",
    once: true,
    weight: 3,
    when: (c) => c.age >= 22 && c.age <= 31 && !c.isGK && !has(c, "reinvencion"),
    text: (c) =>
      `${c.coachName} te llama a su oficina con un pizarrón lleno de flechas. Cree que rendirías más ` +
      `unos metros más atrás. "Confiá en mí", te dice. Vos llevás toda la vida jugando donde jugás.`,
    options: (c) => [
      {
        id: "aceptar",
        label: "Aceptar el cambio de rol",
        effect: "Puede alargarte la carrera",
        risk: "Adaptarte cuesta una temporada",
        outcome: {
          addFlag: "reinvencion",
          luck: {
            chance: 60,
            successLabel: "El cambio te potenció: entendés el juego como nunca",
            failLabel: "Nunca te sentiste cómodo en el puesto nuevo",
            onSuccess: { potential: 3, form: 0.4, reputation: 4, ovr: 2 },
            onFail: { minutes: 0.8, form: -0.35 },
          },
        },
      },
      {
        id: "negarse",
        label: "Negarte: sos lo que sos",
        effect: "Seguís en tu puesto natural",
        risk: `${c.coachName} lo toma a mal`,
        outcome: { minutes: 0.9, form: 0.1 },
      },
    ],
  },

  {
    id: "amigo-lesionado",
    title: "El lugar de un amigo",
    once: true,
    weight: 3,
    when: (c) => c.age >= 20 && c.age <= 32 && !has(c, "amigo-lesion"),
    text: (c) =>
      `${c.friendName}, tu mejor amigo del plantel, se rompió los ligamentos. Está fuera toda la temporada… ` +
      `y su lugar en el once es tuyo. Nadie sabe si abrazarte o darte el pésame.`,
    options: (c) => [
      {
        id: "honrar",
        label: `Jugar por ${c.friendName}`,
        effect: "Motivación extra toda la temporada",
        outcome: { addFlag: "amigo-lesion", form: 0.5, minutes: 1.08, reputation: 3 },
      },
      {
        id: "acompanar",
        label: "Acompañarlo en la recuperación",
        effect: "Amistad para toda la vida",
        risk: "Menos horas de gimnasio",
        outcome: { addFlag: "amigo-lesion", minutes: 0.95, reputation: 5, form: 0.2 },
      },
    ],
  },

  {
    id: "oferta-petrodolares",
    title: "El cheque en blanco",
    weight: 3,
    when: (c) => c.reputation >= 45 && c.age >= 24 && !has(c, "petrodolares"),
    text: (c) =>
      `Llega una oferta de una liga lejana con un contrato que no vas a ver nunca más en tu vida. ` +
      `${c.agentName} te lo repite tres veces por si no escuchaste bien. Deportivamente, es un paso al costado.`,
    options: () => [
      {
        id: "aceptar",
        label: "Ir por el dinero",
        effect: "Tu familia asegurada de por vida",
        risk: "Te borrás del mapa competitivo",
        outcome: { addFlag: "petrodolares", reputation: -12, minutes: 1.05, potential: -2 },
      },
      {
        id: "rechazar",
        label: "Rechazarlo: querés competir",
        effect: "Tu ambición intacta",
        outcome: { addFlag: "rechazo-dinero", form: 0.4, reputation: 5 },
      },
    ],
  },

  {
    id: "redes",
    title: "Un tuit a destiempo",
    weight: 2,
    when: (c) => c.age >= 20 && c.reputation >= 25,
    text: () =>
      `Publicaste algo caliente después de una derrota y explotó. Capturas por todos lados, ` +
      `el community del club en pánico y el presidente pidiendo explicaciones.`,
    options: () => [
      {
        id: "disculpa",
        label: "Pedir disculpas públicamente",
        effect: "Apagás el incendio",
        outcome: { reputation: -3, form: 0.1 },
      },
      {
        id: "sostener",
        label: "Sostener lo que dijiste",
        effect: "La gente valora que seas frontal",
        risk: "El club te multa",
        outcome: { addFlag: "polemico", reputation: 4, minutes: 0.88 },
      },
    ],
  },

  // ======================= PICO (27-33) ===================================
  {
    id: "capitania",
    title: "El brazalete",
    once: true,
    weight: 6,
    when: (c) => c.age >= 26 && c.fit >= -2 && !has(c, "capitan"),
    text: (c) =>
      `${c.coachName} deja el brazalete sobre tu casillero sin decir nada. El vestuario del ` +
      `${c.club.name} entero está mirando qué hacés con él.`,
    options: () => [
      {
        id: "aceptar",
        label: "Ponértelo",
        effect: "Referente absoluto del club",
        risk: "Toda la presión sobre vos",
        outcome: { addFlag: "capitan", reputation: 10, minutes: 1.06, form: -0.1 },
      },
      {
        id: "ceder",
        label: "Cedérselo a un veterano",
        effect: "El vestuario te respeta igual",
        outcome: { reputation: 3, form: 0.3 },
      },
    ],
  },

  {
    id: "conflicto-tecnico",
    title: "Guerra fría con el técnico",
    weight: 4,
    when: (c) => c.age >= 23 && c.fit >= -6,
    text: (c) =>
      `${c.coachName} te sacó en el minuto 60 por tercera vez seguida y esta vez pateaste una botella. ` +
      `La foto ya está en todos lados. El club te cita el lunes.`,
    options: (c) => [
      {
        id: "plantarse",
        label: "Plantarte y exigir respeto",
        effect: "O te gana el pulso, o lo ganás vos",
        risk: "Podés terminar en la tribuna",
        outcome: {
          luck: {
            chance: 48,
            successLabel: `${c.coachName} recapacitó: volvés al once`,
            failLabel: "Te mandó a entrenar con los suplentes",
            onSuccess: { minutes: 1.12, reputation: 5 },
            onFail: { minutes: 0.5, form: -0.5, reputation: -4 },
          },
        },
      },
      {
        id: "disculparse",
        label: "Pedir disculpas y agachar la cabeza",
        effect: "Paz en el vestuario",
        risk: "Perdés algo de jerarquía",
        outcome: { minutes: 0.95, form: 0.2, reputation: -1 },
      },
    ],
  },

  {
    id: "club-rival",
    title: "La oferta que no se acepta",
    once: true,
    weight: 4,
    when: (c) => c.reputation >= 40 && c.age >= 24 && c.club.tier >= 3 && !has(c, "traicion"),
    text: (c) =>
      `El rival histórico del ${c.club.name} te quiere. Duplican tu sueldo y te prometen ser el eje del proyecto. ` +
      `La hinchada ya se enteró y hay pintadas en el predio con tu nombre.`,
    options: (c) => [
      {
        id: "traicionar",
        label: "Aceptar y cruzar la vereda",
        effect: "Salto deportivo y económico",
        risk: "Serás traidor para siempre",
        outcome: { addFlag: "traidor", reputation: 8, form: -0.3 },
      },
      {
        id: "quedarse",
        label: `Quedarte y besar el escudo`,
        effect: "Ídolo eterno del " + c.club.name,
        outcome: { addFlag: "idolo", reputation: 6, form: 0.5, minutes: 1.05 },
      },
    ],
  },

  {
    id: "lesion-grave",
    title: "El crujido",
    weight: 3,
    when: (c) => c.age >= 24 && c.injuries <= 2,
    text: () =>
      `Un cruce fortuito, un crujido y el silencio del estadio. La resonancia confirma lo peor: ` +
      `meses afuera. El fisio te dice que la cabeza va a doler más que la rodilla.`,
    options: () => [
      {
        id: "acelerar",
        label: "Acelerar la recuperación",
        effect: "Volvés antes de lo previsto",
        risk: "Podés recaer y arrastrarlo",
        outcome: {
          injuries: 1,
          penaltyOvr: 2,
          luck: {
            chance: 45,
            successLabel: "Volviste antes y a buen nivel",
            failLabel: "Recaíste: la lesión se hizo crónica",
            onSuccess: { minutes: 0.75, form: 0.3 },
            onFail: { minutes: 0.4, injuries: 1, penaltyOvr: 3 },
          },
        },
      },
      {
        id: "paciencia",
        label: "Respetar los plazos",
        effect: "Volvés sano y entero",
        risk: "Te perdés casi toda la temporada",
        outcome: { injuries: 1, penaltyOvr: 1, minutes: 0.45, form: 0.15 },
      },
    ],
  },

  {
    id: "fundacion",
    title: "Devolver algo",
    once: true,
    weight: 2,
    when: (c) => c.reputation >= 50 && c.age >= 26 && !has(c, "fundacion"),
    text: (c) =>
      `Volvés al barrio donde empezaste a patear. La cancha sigue sin luces y los pibes juegan con ` +
      `una pelota parchada. ${c.agentName} dice que una fundación "queda bien para la imagen".`,
    options: () => [
      {
        id: "fundar",
        label: "Montar la escuelita en serio",
        effect: "Te ganás el cariño de toda una región",
        risk: "Te ocupa tiempo y cabeza",
        outcome: { addFlag: "fundacion", reputation: 12, minutes: 0.95 },
      },
      {
        id: "donar",
        label: "Donar y seguir enfocado",
        effect: "Ayudás sin distraerte",
        outcome: { reputation: 4, form: 0.15 },
      },
    ],
  },

  {
    id: "rival-companero",
    title: "Viejos conocidos",
    once: true,
    weight: 4,
    when: (c) => has(c, "rival") && c.age >= 25 && !has(c, "rival-reencuentro"),
    text: (c) =>
      `El club acaba de fichar a ${c.rivalName}. Sí, el mismo de la cantera. Diez años después ` +
      `vuelven a compartir vestuario y todos en el club saben la historia.`,
    options: (c) => [
      {
        id: "enterrar",
        label: "Enterrar el hacha",
        effect: "Sociedad letal en la cancha",
        outcome: { addFlag: "rival-reencuentro", form: 0.45, reputation: 5, minutes: 1.03 },
      },
      {
        id: "guerra",
        label: "Demostrarle quién manda acá",
        effect: "La competencia te saca lo mejor",
        risk: `${c.rivalName} no se va a dejar`,
        outcome: {
          addFlag: "rival-reencuentro",
          luck: {
            chance: 55,
            successLabel: `Le ganaste el pulso otra vez: el equipo es tuyo`,
            failLabel: `${c.rivalName} te comió el puesto y el vestuario`,
            onSuccess: { minutes: 1.12, reputation: 7, form: 0.4 },
            onFail: { minutes: 0.68, form: -0.4 },
          },
        },
      },
    ],
  },

  {
    id: "hijo-futbol",
    title: "Sangre nueva",
    once: true,
    weight: 2,
    when: (c) => c.age >= 30 && !has(c, "hijo"),
    text: () =>
      `Tu hijo llega de la escuela con la mochila llena de pasto y una pregunta: quiere probarse ` +
      `en la cantera. Sabés exactamente todo lo que eso significa: lo lindo y lo brutal.`,
    options: () => [
      {
        id: "apoyar",
        label: "Acompañarlo en el camino",
        effect: "Le enseñás todo lo que aprendiste",
        risk: "Te reparte la cabeza",
        outcome: { addFlag: "hijo", minutes: 0.95, form: 0.35, reputation: 3 },
      },
      {
        id: "proteger",
        label: "Pedirle que estudie primero",
        effect: "Lo cuidás de la presión",
        outcome: { addFlag: "hijo", form: 0.2 },
      },
    ],
  },

  // ======================= DECLIVE (33-39) ================================
  {
    id: "cuerpo-basta",
    title: "El cuerpo pasa la factura",
    weight: 5,
    when: (c) => c.age >= 33,
    text: (c) =>
      `Te levantás y tardás veinte minutos en poder bajar las escaleras. El médico del ` +
      `${c.club.name} te lo dice sin vueltas: "Ya no podés entrenar como a los 25".`,
    options: () => [
      {
        id: "gestionar",
        label: "Administrar cargas y elegir partidos",
        effect: "Llegás entero a lo importante",
        risk: "Menos minutos totales",
        outcome: { minutes: 0.78, form: 0.3, injuries: -1 },
      },
      {
        id: "todo",
        label: "Jugar todo, como siempre",
        effect: "El equipo te necesita",
        risk: "Alto riesgo de romperte",
        outcome: {
          minutes: 1.08,
          luck: {
            chance: 50,
            successLabel: "Aguantaste el año entero a pura garra",
            failLabel: "Tu cuerpo dijo basta: otra lesión",
            onSuccess: { reputation: 5, form: 0.3 },
            onFail: { injuries: 1, penaltyOvr: 3, minutes: 0.5 },
          },
        },
      },
    ],
  },

  {
    id: "ultima-danza",
    title: "La última oportunidad",
    once: true,
    weight: 5,
    when: (c) => c.age >= 33 && c.club.tier >= 3 && !has(c, "ultima-danza"),
    text: (c) =>
      `El ${c.club.name} armó un equipo para ganarlo todo y vos sabés que esta puede ser tu última ` +
      `chance real de levantar algo grande. ${c.coachName} te pregunta si querés ser parte del proyecto.`,
    options: () => [
      {
        id: "todo-o-nada",
        label: "Ir por todo una vez más",
        effect: "Más chance de título",
        risk: "Exige tu cuerpo al límite",
        outcome: { addFlag: "ultima-danza", minutes: 1.1, form: 0.4, injuries: 1 },
      },
      {
        id: "rol",
        label: "Aceptar un rol secundario",
        effect: "Cuidás el cuerpo y sumás desde adentro",
        outcome: { addFlag: "ultima-danza", minutes: 0.72, form: 0.2, reputation: 2 },
      },
    ],
  },

  {
    id: "jugador-entrenador",
    title: "El pizarrón te llama",
    once: true,
    weight: 3,
    when: (c) => c.age >= 34 && !has(c, "jugador-tecnico"),
    text: (c) =>
      `El club te ofrece algo raro: seguir jugando pero también empezar a formarte como entrenador ` +
      `junto a ${c.coachName}. Es empezar la segunda vida antes de terminar la primera.`,
    options: () => [
      {
        id: "aceptar",
        label: "Aceptar el doble rol",
        effect: "Te preparás para lo que viene",
        risk: "Menos foco en jugar",
        outcome: { addFlag: "jugador-tecnico", minutes: 0.82, reputation: 6 },
      },
      {
        id: "jugador",
        label: "Todavía sos jugador y nada más",
        effect: "Foco total en la cancha",
        outcome: { minutes: 1.05, form: 0.2 },
      },
    ],
  },

  {
    id: "volver-casa",
    title: "Volver al principio",
    once: true,
    weight: 4,
    when: (c) => c.age >= 33 && c.clubAbroad && !has(c, "volver-casa"),
    text: (c) =>
      `El club donde te formaste te llama. No pueden pagarte ni la décima parte de lo que ganás, ` +
      `pero te ofrecen algo que no se compra: retirarte en casa, con tu gente.`,
    options: () => [
      {
        id: "volver",
        label: "Volver a casa",
        effect: "Cierre emotivo, hinchada rendida",
        risk: "Bajás de categoría deportiva",
        outcome: { addFlag: "volver-casa", reputation: 8, form: 0.5, minutes: 1.05 },
      },
      {
        id: "seguir",
        label: "Seguir compitiendo al máximo nivel",
        effect: "Todavía te queda cuerda arriba",
        outcome: { form: 0.2, minutes: 1 },
      },
    ],
  },

  {
    id: "homenaje",
    title: "Tu partido despedida",
    once: true,
    weight: 4,
    when: (c) => c.age >= 36 && c.reputation >= 35 && !has(c, "homenaje"),
    text: (c) =>
      `El ${c.club.name} quiere organizarte un partido homenaje a fin de temporada. ` +
      `Estadio lleno, tus viejos compañeros, tu familia en el círculo central. Falta que vos digas que sí.`,
    options: () => [
      {
        id: "aceptar",
        label: "Aceptar el homenaje",
        effect: "Tu nombre queda en la historia del club",
        outcome: { addFlag: "homenaje", reputation: 14, form: 0.4 },
      },
      {
        id: "sin-ruido",
        label: "Irte sin ruido",
        effect: "Salís por la puerta de atrás, como querías",
        outcome: { addFlag: "homenaje", form: 0.3 },
      },
    ],
  },

  {
    id: "leyenda-numero",
    title: "El número retirado",
    once: true,
    weight: 3,
    when: (c) => c.age >= 34 && has(c, "idolo") && c.trophies >= 2 && !has(c, "numero-retirado"),
    text: (c) =>
      `La dirigencia del ${c.club.name} propone retirar tu número ${c.surname ? "" : ""}del club para siempre. ` +
      `Nadie más lo va a usar. Algunos hinchas históricos creen que es demasiado.`,
    options: () => [
      {
        id: "aceptar",
        label: "Aceptar el honor",
        effect: "Leyenda inmortal del club",
        outcome: { addFlag: "numero-retirado", reputation: 12 },
      },
      {
        id: "rechazar",
        label: "Pedir que se lo den a un pibe",
        effect: "Gesto que la gente no olvida",
        outcome: { addFlag: "numero-retirado", reputation: 8, form: 0.3 },
      },
    ],
  },

  // ======================= PORTEROS ======================================
  {
    id: "penal-atajado",
    title: "El especialista en penales",
    once: true,
    weight: 4,
    when: (c) => c.isGK && c.age >= 21 && !has(c, "especialista-penales"),
    text: () =>
      `El analista del club te trae un dossier: horas de video de cómo patean los rivales. ` +
      `Estudiarlo es aburridísimo, pero podría convertirte en un especialista en tandas.`,
    options: () => [
      {
        id: "estudiar",
        label: "Estudiar cada penal",
        effect: "Te volvés temible en las tandas",
        risk: "Horas robadas al entrenamiento",
        outcome: { addFlag: "especialista-penales", minutes: 0.96, reputation: 5, form: 0.3 },
      },
      {
        id: "instinto",
        label: "Confiar en tu instinto",
        effect: "Jugás como sentís",
        outcome: { form: 0.25 },
      },
    ],
  },

  {
    id: "error-garrafal",
    title: "El error que se repite en loop",
    weight: 3,
    when: (c) => c.isGK && c.age >= 20,
    text: (c) =>
      `Se te escapó entre las manos en el peor momento y el gol dio la vuelta al mundo. ` +
      `En el ${c.club.name} te bancan, pero el ruido afuera es insoportable.`,
    options: () => [
      {
        id: "cara",
        label: "Dar la cara en conferencia",
        effect: "El vestuario y la gente lo valoran",
        outcome: { reputation: 4, form: 0.25 },
      },
      {
        id: "silencio",
        label: "Encerrarte a entrenar en silencio",
        effect: "Volvés más fuerte",
        risk: "La prensa te castiga igual",
        outcome: { reputation: -3, form: 0.45, minutes: 1.03 },
      },
    ],
  },

  // ======================= VESTUARIO Y CLUB ==============================
  {
    id: "tecnico-nuevo",
    title: "Llegó un técnico nuevo",
    weight: 2,
    when: (c) => c.age >= 19,
    text: (c) =>
      `Echaron a ${c.coachName} y llega un entrenador con fama de tener sus propios favoritos. ` +
      `La primera semana es una audición para los veintitantos que estamos en la lista.`,
    options: () => [
      {
        id: "impresionar",
        label: "Matarte en la pretemporada",
        effect: "Podés ganarte el puesto de entrada",
        risk: "Llegás fundido al arranque",
        outcome: {
          luck: {
            chance: 60,
            successLabel: "Te ganaste al técnico desde el día uno",
            failLabel: "Llegaste sobreentrenado y arrancaste flojo",
            onSuccess: { minutes: 1.12, form: 0.35, reputation: 3, ovr: 2 },
            onFail: { minutes: 0.85, form: -0.3 },
          },
        },
      },
      {
        id: "esperar",
        label: "Dejar que te vea con calma",
        effect: "Arrancás sin desgastarte",
        outcome: { minutes: 0.97, form: 0.15 },
      },
    ],
  },

  {
    id: "vestuario-dividido",
    title: "El vestuario partido al medio",
    weight: 3,
    when: (c) => c.age >= 22 && c.club.tier >= 2,
    text: (c) =>
      `Un grupo de veteranos quiere ir al presidente a pedir la cabeza del técnico. ` +
      `${c.friendName} te pregunta de qué lado estás. En este vestuario ya no se habla de fútbol.`,
    options: () => [
      {
        id: "veteranos",
        label: "Sumarte a los referentes",
        effect: "Ganás peso interno",
        risk: "Si el técnico se queda, quedás marcado",
        outcome: {
          luck: {
            chance: 50,
            successLabel: "Cayó el técnico y quedaste como líder del grupo",
            failLabel: "El técnico se quedó y te mandó al fondo de la lista",
            onSuccess: { reputation: 6, minutes: 1.08 },
            onFail: { minutes: 0.6, reputation: -4, form: -0.3 },
          },
        },
      },
      {
        id: "neutral",
        label: "No meterte en política",
        effect: "Te concentrás en jugar",
        outcome: { form: 0.25, minutes: 1.02 },
      },
    ],
  },

  {
    id: "gol-del-ano",
    title: "Una que entra por la escuadra",
    weight: 3,
    when: (c) => !c.isGK && c.age >= 19,
    text: () =>
      `Te queda picando al borde del área y todo el estadio hace ese silencio raro de medio segundo. ` +
      `Podés acomodarla al palo o probar la de tu vida desde ahí.`,
    options: () => [
      {
        id: "volea",
        label: "Reventarla de volea",
        effect: "Gol del año si entra",
        risk: "Si la tirás afuera, te van a cargar un mes",
        outcome: {
          luck: {
            chance: 42,
            successLabel: "Golazo histórico: la repiten en todos los noticieros",
            failLabel: "Se fue a la tribuna y quedó el meme para siempre",
            onSuccess: { reputation: 11, form: 0.5 },
            onFail: { reputation: -2, form: -0.2 },
          },
        },
      },
      {
        id: "acomodar",
        label: "Acomodarla al segundo palo",
        effect: "Lo más probable es que sea gol",
        outcome: { form: 0.3, reputation: 3 },
      },
    ],
  },

  {
    id: "renovacion",
    title: "La mesa de negociación",
    weight: 3,
    when: (c) => c.age >= 21 && c.fit >= -6,
    text: (c) =>
      `El club te pone un contrato sobre la mesa. ${c.agentName} dice que pidas el doble; ` +
      `el dirigente dice que es la última oferta. Vos solo querés jugar.`,
    options: (c) => [
      {
        id: "apretar",
        label: `Dejar que ${c.agentName} apriete`,
        effect: "Podés salir muy beneficiado",
        risk: "Podés quedar en offside con el club",
        outcome: {
          luck: {
            chance: 55,
            successLabel: "Firmaste un contratazo y sos intocable",
            failLabel: "La dirigencia se ofendió y te congeló",
            onSuccess: { reputation: 7, minutes: 1.06 },
            onFail: { minutes: 0.72, reputation: -3 },
          },
        },
      },
      {
        id: "firmar",
        label: "Firmar sin discutir",
        effect: "El club te queda agradecido",
        outcome: { reputation: 3, form: 0.25, minutes: 1.03 },
      },
    ],
  },

  {
    id: "descenso",
    title: "Peleando el descenso",
    weight: 3,
    when: (c) => c.club.tier <= 2 && c.age >= 19,
    text: (c) =>
      `El ${c.club.name} está metido en la pelea de abajo y quedan ocho fechas. ` +
      `La gente espera en el predio, y no precisamente para pedir autógrafos.`,
    options: (c) => [
      {
        id: "liderar",
        label: "Ponerte el equipo al hombro",
        effect: "Si se salvan, sos héroe de la gente",
        risk: "Si bajan, cargás con la culpa",
        outcome: {
          luck: {
            chance: 58,
            successLabel: `Salvaron al ${c.club.name} y la hinchada no lo va a olvidar`,
            failLabel: "Se consumó el descenso y fue un año durísimo",
            onSuccess: { reputation: 8, form: 0.45, minutes: 1.1 },
            onFail: { reputation: -4, form: -0.5 },
          },
        },
      },
      {
        id: "salvarse",
        label: "Cuidar tu imagen y tu futuro",
        effect: "Evitás el desgaste del quilombo",
        outcome: { minutes: 0.9, form: -0.1 },
      },
    ],
  },

  {
    id: "documental",
    title: "Las cámaras te siguen",
    once: true,
    weight: 2,
    when: (c) => c.reputation >= 55 && !has(c, "documental"),
    text: (c) =>
      `Una plataforma quiere filmar un documental sobre tu temporada: cámaras en tu casa, ` +
      `en el vestuario, en la concentración. ${c.agentName} ya calcula los ceros.`,
    options: () => [
      {
        id: "aceptar",
        label: "Abrir las puertas",
        effect: "Alcance mundial",
        risk: "Cero intimidad todo el año",
        outcome: { addFlag: "documental", reputation: 14, form: -0.2, minutes: 0.96 },
      },
      {
        id: "rechazar",
        label: "Cuidar tu vida privada",
        effect: "Tranquilidad para rendir",
        outcome: { form: 0.35 },
      },
    ],
  },

  {
    id: "dorsal-10",
    title: "La camiseta pesada",
    once: true,
    weight: 3,
    when: (c) => c.age >= 22 && c.reputation >= 30 && !c.isGK && !has(c, "dorsal-10"),
    text: (c) =>
      `Se fue el ídolo del ${c.club.name} y su número quedó libre. El club te lo ofrece a vos. ` +
      `En este club esa camiseta la usaron leyendas… y también la hundieron algunos.`,
    options: () => [
      {
        id: "aceptar",
        label: "Ponerte el número",
        effect: "Asumís ser el referente",
        risk: "Toda la exigencia sobre tu espalda",
        outcome: {
          addFlag: "dorsal-10",
          luck: {
            chance: 58,
            successLabel: "Honraste la camiseta: ahora es tuya",
            failLabel: "El peso del número te terminó jugando en contra",
            onSuccess: { reputation: 9, form: 0.4, minutes: 1.05 },
            onFail: { reputation: -3, form: -0.35 },
          },
        },
      },
      {
        id: "seguir",
        label: "Quedarte con tu número de siempre",
        effect: "Sin presiones extra",
        outcome: { addFlag: "dorsal-10", form: 0.2 },
      },
    ],
  },

  {
    id: "regreso-lesion",
    title: "El día que volvés",
    weight: 3,
    when: (c) => c.injuries >= 1 && c.age >= 21,
    text: (c) =>
      `Después de meses de gimnasio y kinesiología, ${c.coachName} dice tu nombre para el banco. ` +
      `Cuando te pares a calentar, cincuenta mil personas se van a levantar.`,
    options: () => [
      {
        id: "entrar",
        label: "Entrar y jugarte entero",
        effect: "Reencuentro con tu mejor versión",
        risk: "El cuerpo puede no estar listo",
        outcome: {
          luck: {
            chance: 62,
            successLabel: "Volviste mejor de lo que te fuiste",
            failLabel: "Recaíste a los veinte minutos",
            onSuccess: { form: 0.5, reputation: 5, minutes: 1.05, ovr: 1 },
            onFail: { injuries: 1, penaltyOvr: 2, minutes: 0.55 },
          },
        },
      },
      {
        id: "gradual",
        label: "Volver de a poco",
        effect: "Recuperación completa y sin recaídas",
        outcome: { minutes: 0.82, form: 0.3 },
      },
    ],
  },

  {
    id: "mundial-convocatoria",
    title: "La lista del Mundial",
    once: true,
    weight: 5,
    when: (c) => c.caps > 0 && c.ovr >= 76 && c.age <= 36 && !has(c, "mundial-lista"),
    text: (c) =>
      `Se viene el Mundial y ${c.countryName} da la lista el lunes. Estás en la burbuja: ` +
      `podés entrar o quedarte mirándolo por televisión como cuando eras chico.`,
    options: (c) => [
      {
        id: "todo",
        label: "Dejar todo para entrar",
        effect: "El sueño de tu vida",
        risk: "Forzás el cuerpo al límite",
        outcome: {
          addFlag: "mundial-lista",
          luck: {
            chance: 62,
            successLabel: `Entraste en la lista de ${c.countryName}: vas al Mundial`,
            failLabel: "Te quedaste afuera de la lista por un puesto",
            onSuccess: { reputation: 15, caps: 6, form: 0.4 },
            onFail: { reputation: -2, form: -0.4 },
          },
        },
      },
      {
        id: "club",
        label: "Priorizar tu club",
        effect: "Temporada redonda con tu equipo",
        outcome: { addFlag: "mundial-lista", minutes: 1.06, form: 0.25 },
      },
    ],
  },

  {
    id: "final-perdida",
    title: "La final que se escapó",
    weight: 2,
    when: (c) => c.age >= 22 && c.club.tier >= 3 && c.trophies === 0,
    text: (c) =>
      `Perdieron la final. En el vestuario del ${c.club.name} no habla nadie. ` +
      `Vos mirás la medalla de subcampeón y no sabés si guardarla o tirarla.`,
    options: () => [
      {
        id: "combustible",
        label: "Usarla de combustible",
        effect: "Volvés obsesionado con ganar",
        outcome: { form: 0.5, reputation: 2, minutes: 1.05 },
      },
      {
        id: "pasar",
        label: "Pasar página rápido",
        effect: "No dejás que te pese",
        outcome: { form: 0.2 },
      },
    ],
  },

  {
    id: "pibe-tribuna",
    title: "Un pibe en la tribuna",
    weight: 2,
    when: (c) => c.reputation >= 25,
    text: (c) =>
      `Terminado el partido, un nene con tu camiseta te espera en el alambrado. ` +
      `Lleva tres horas ahí. Te acordás perfecto de cuando el que esperaba eras vos.`,
    options: () => [
      {
        id: "camiseta",
        label: "Regalarle tu camiseta y charlar",
        effect: "La gente te adora",
        outcome: { reputation: 4, form: 0.2 },
      },
      {
        id: "invitar",
        label: "Invitarlo a entrenar con el plantel",
        effect: "Historia que da la vuelta al mundo",
        outcome: { reputation: 8, minutes: 0.98 },
      },
    ],
  },

  {
    id: "veterano-referente",
    title: "El último de los viejos",
    weight: 3,
    when: (c) => c.age >= 31 && c.age <= 37,
    text: (c) =>
      `Mirás alrededor en el vestuario y sos el más grande por seis años. Los pibes te dicen "profe" ` +
      `medio en broma. El ${c.club.name} te pide que sostengas al grupo.`,
    options: () => [
      {
        id: "liderar",
        label: "Ser el líder del grupo",
        effect: "Jerarquía y respeto absoluto",
        risk: "Menos energía para lo tuyo",
        outcome: { minutes: 0.92, reputation: 7, form: 0.3 },
      },
      {
        id: "ejemplo",
        label: "Liderar solo con el ejemplo",
        effect: "Te enfocás en rendir",
        outcome: { minutes: 1.05, form: 0.2 },
      },
    ],
  },
];


/** Historias elegibles ahora mismo, respetando condiciones y `once`. */
export function eligibleStories(c: StoryContext, excludeId?: string | null): StoryEvent[] {
  return STORIES.filter((st) => {
    if (st.once && c.flags.includes(`story:${st.id}`)) return false;
    // Nunca la misma historia dos temporadas seguidas: es lo que más rompe la
    // ilusión de que tu carrera avanza.
    if (excludeId && st.id === excludeId) return false;
    return st.when(c);
  });
}

/** Sortea una historia entre las elegibles, respetando pesos. */
export function pickStory(
  c: StoryContext,
  excludeId?: string | null,
  rnd: () => number = Math.random
): StoryEvent | null {
  const pool = eligibleStories(c, excludeId);
  if (!pool.length) return null;
  const total = pool.reduce((a, s) => a + (s.weight ?? 1), 0);
  let r = rnd() * total;
  for (const s of pool) {
    r -= s.weight ?? 1;
    if (r <= 0) return s;
  }
  return pool[pool.length - 1];
}
