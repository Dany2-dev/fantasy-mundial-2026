import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [nombre, posición, rating]
type SeedPlayer = [string, "POR" | "DEF" | "MED" | "DEL", number];

const DATA: { name: string; flag: string; group: string; players: SeedPlayer[] }[] = [
  {
    name: "México", flag: "🇲🇽", group: "A",
    players: [
      ["Luis Malagón", "POR", 80], ["Johan Vásquez", "DEF", 79], ["César Montes", "DEF", 78],
      ["Jesús Gallardo", "DEF", 76], ["Kevin Álvarez", "DEF", 75], ["Edson Álvarez", "MED", 82],
      ["Luis Chávez", "MED", 79], ["Orbelín Pineda", "MED", 77], ["Hirving Lozano", "DEL", 81],
      ["Santiago Giménez", "DEL", 82], ["Raúl Jiménez", "DEL", 79], ["Julián Quiñones", "DEL", 78],
    ],
  },
  {
    name: "Argentina", flag: "🇦🇷", group: "B",
    players: [
      ["Emiliano Martínez", "POR", 87], ["Cristian Romero", "DEF", 85], ["Lisandro Martínez", "DEF", 84],
      ["Nicolás Tagliafico", "DEF", 80], ["Nahuel Molina", "DEF", 80], ["Rodrigo De Paul", "MED", 84],
      ["Enzo Fernández", "MED", 85], ["Alexis Mac Allister", "MED", 85], ["Lionel Messi", "DEL", 90],
      ["Julián Álvarez", "DEL", 88], ["Lautaro Martínez", "DEL", 86], ["Ángel Di María", "DEL", 83],
    ],
  },
  {
    name: "Brasil", flag: "🇧🇷", group: "C",
    players: [
      ["Alisson Becker", "POR", 88], ["Marquinhos", "DEF", 85], ["Éder Militão", "DEF", 84],
      ["Danilo", "DEF", 80], ["Casemiro", "MED", 82], ["Bruno Guimarães", "MED", 84],
      ["Lucas Paquetá", "MED", 82], ["Vinícius Jr", "DEL", 90], ["Rodrygo", "DEL", 86],
      ["Raphinha", "DEL", 86], ["Endrick", "DEL", 80], ["Neymar Jr", "DEL", 85],
    ],
  },
  {
    name: "Francia", flag: "🇫🇷", group: "D",
    players: [
      ["Mike Maignan", "POR", 87], ["Jules Koundé", "DEF", 84], ["Dayot Upamecano", "DEF", 83],
      ["Theo Hernández", "DEF", 85], ["William Saliba", "DEF", 85], ["Aurélien Tchouaméni", "MED", 84],
      ["Eduardo Camavinga", "MED", 83], ["Antoine Griezmann", "MED", 85], ["Kylian Mbappé", "DEL", 91],
      ["Ousmane Dembélé", "DEL", 87], ["Marcus Thuram", "DEL", 83], ["Randal Kolo Muani", "DEL", 80],
    ],
  },
  {
    name: "España", flag: "🇪🇸", group: "E",
    players: [
      ["Unai Simón", "POR", 84], ["Dani Carvajal", "DEF", 84], ["Aymeric Laporte", "DEF", 82],
      ["Marc Cucurella", "DEF", 81], ["Rodri", "MED", 89], ["Pedri", "MED", 86],
      ["Gavi", "MED", 83], ["Fabián Ruiz", "MED", 84], ["Lamine Yamal", "DEL", 89],
      ["Nico Williams", "DEL", 85], ["Álvaro Morata", "DEL", 81], ["Ferran Torres", "DEL", 80],
    ],
  },
  {
    name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "F",
    players: [
      ["Jordan Pickford", "POR", 83], ["Kyle Walker", "DEF", 81], ["John Stones", "DEF", 83],
      ["Trent Alexander-Arnold", "DEF", 85], ["Declan Rice", "MED", 86], ["Jude Bellingham", "MED", 89],
      ["Phil Foden", "MED", 86], ["Cole Palmer", "MED", 86], ["Bukayo Saka", "DEL", 87],
      ["Harry Kane", "DEL", 88], ["Anthony Gordon", "DEL", 81], ["Ollie Watkins", "DEL", 81],
    ],
  },
  {
    name: "Po22al", flag: "🇵🇹", group: "G",
    players: [
      ["Diogo Costa", "POR", 85], ["Rúben Dias", "DEF", 87], ["João Cancelo", "DEF", 83],
      ["Nuno Mendes", "DEF", 84], ["Vitinha", "MED", 85], ["Bruno Fernandes", "MED", 86],
      ["Bernardo Silva", "MED", 86], ["João Neves", "MED", 82], ["Cristiano Ronaldo", "DEL", 85],
      ["Rafael Leão", "DEL", 85], ["João Félix", "DEL", 80], ["Gonçalo Ramos", "DEL", 81],
    ],
  },
  {
    name: "Alemania", flag: "🇩🇪", group: "H",
    players: [
      ["Marc-André ter Stegen", "POR", 86], ["Antonio Rüdiger", "DEF", 86], ["Jonathan Tah", "DEF", 83],
      ["Nico Schlotterbeck", "DEF", 82], ["David Raum", "DEF", 80], ["Joshua Kimmich", "MED", 86],
      ["İlkay Gündoğan", "MED", 84], ["Florian Wirtz", "MED", 88], ["Jamal Musiala", "MED", 88],
      ["Kai Havertz", "DEL", 84], ["Niclas Füllkrug", "DEL", 80], ["Leroy Sané", "DEL", 82],
    ],
  },
];

// Seed OFFLINE de respaldo (sin red): una sola competencia con 8 selecciones.
// El seed real multi-competencia está en seed-competitions.ts (npm run db:seed:fotmob).
async function main() {
  // Sembrar cuentas del sistema
  const systemAccounts = ['SYSTEM_EMISSION', 'SYSTEM_TAX', 'SYSTEM_SINK'];
  for (const accountId of systemAccounts) {
    await prisma.systemAccount.upsert({
      where: { id: accountId },
      update: {},
      create: { id: accountId, balance: 0 },
    });
  }
  console.log('✔ Cuentas del sistema sembradas.');

  const count = await prisma.player.count();
  if (count > 0) {
    console.log(`La base ya tiene ${count} jugadores, no se vuelve a sembrar.`);
    return;
  }

  const competition = await prisma.competition.upsert({
    where: { fotmobId: 77 },
    update: {},
    create: {
      fotmobId: 77,
      name: "Copa Mundial (offline)",
      ccode: "INT",
      type: "cup",
      priority: 1,
      isCurrent: true,
    },
  });

  for (const c of DATA) {
    const team = await prisma.team.create({
      data: { competitionId: competition.id, fotmobId: 900000 + DATA.indexOf(c), name: c.name, flag: c.flag, group: c.group },
    });
    await prisma.player.createMany({
      data: c.players.map(([name, position, rating], i) => ({
        competitionId: competition.id,
        teamId: team.id,
        fotmobId: team.id * 100 + i, // id sintético estable en modo offline
        name,
        position,
        rating,
        basePrice: rating * 120,
      })),
    });
    console.log(`✔ ${c.flag} ${c.name}: ${c.players.length} jugadores`);
  }

  await prisma.gameweek.upsert({
    where: { competitionId_number: { competitionId: competition.id, number: 1 } },
    update: {},
    create: { competitionId: competition.id, number: 1, deadline: new Date("2026-06-11T18:00:00Z"), status: "upcoming" },
  });

  console.log("Seed offline completo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
