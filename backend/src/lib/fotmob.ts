// Cliente de la API interna de FotMob (TypeScript / Node 22 con fetch global).
// Endpoints verificados (NO requieren el header firmado `x-mas`, solo
// User-Agent realista + Referer):
//   - Liga/calendario: /_next/data/<buildId>/en/leagues/77.json?id=77
//   - Plantilla equipo: /api/data/teams?id=<teamId>
//   - Detalle partido:  /api/data/matchDetails?matchId=<id>
// El buildId cambia en cada despliegue de FotMob -> se extrae de la home.

import { roundNumberFor } from "./rounds";

const BASE = process.env.FOTMOB_BASE ?? "https://www.fotmob.com";
export const FOTMOB_LEAGUE_ID = Number(process.env.FOTMOB_LEAGUE_ID ?? 77);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
  Referer: `${BASE}/`,
};

let _buildId: string | null = null;

// Escudo de selección y foto de jugador (CDN de FotMob).
export const teamLogoUrl = (teamId: number) =>
  `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`;
export const playerPhotoUrl = (playerId: number) =>
  `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch con reintentos + backoff (FotMob a veces da timeout en frío).
async function fetchRetry(url: string, attempts = 5): Promise<Response> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status >= 500) throw new Error(`FotMob ${res.status}`);
      return res;
    } catch (e) {
      last = e;
      if (i < attempts) await sleep(Math.min(2 ** i * 500, 8000));
    }
  }
  throw new Error(`FotMob fetch falló (${attempts} intentos) en ${url}: ${String(last)}`);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`FotMob ${res.status} en ${url}`);
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`FotMob ${res.status} en ${url}`);
  return (await res.json()) as T;
}

export async function getBuildId(force = false): Promise<string> {
  if (_buildId && !force) return _buildId;
  const html = await fetchText(`${BASE}/en`);
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error("No se pudo extraer buildId de FotMob");
  _buildId = m[1];
  return _buildId;
}

// ---------- tipos ----------
export type FMTeam = { fotmobId: number; name: string; group: string | null };
export type FMMatch = {
  fotmobId: number;
  homeId: number | null;
  homeName: string | null;
  awayId: number | null;
  awayName: string | null;
  group: string | null;
  round: number | null;
  utcTime: string | null;
  finished: boolean;
  started: boolean;
  liveMinute: string | null;
  homeScore: number | null;
  awayScore: number | null;
};
export type FMSquadPlayer = {
  fotmobId: number;
  name: string;
  age: number | null;
  position: string; // GK | DEF | MID | FWD
  shirtNumber: number | null;
  transferValue: number | null;
  avgRating: number | null;
};
export type FMMatchDetail = {
  ratings: Record<number, number>; // playerId -> rating 0..10
  goals: Record<number, number>;
  assists: Record<number, number>;
  playedTeam: Record<number, number>;
  minutes: Record<number, number>;
};

const ROLE_TO_POS: Record<string, string> = {
  keepers: "GK",
  defenders: "DEF",
  midfielders: "MID",
  attackers: "FWD",
};

function scoreParts(scoreStr: string | undefined): [number | null, number | null] {
  if (scoreStr && scoreStr.includes("-")) {
    const [h, a] = scoreStr.split("-").map((s) => parseInt(s.trim(), 10));
    if (!isNaN(h) && !isNaN(a)) return [h, a];
  }
  return [null, null];
}

// ---------- liga: equipos + partidos ----------
export async function getLeague(): Promise<{ teams: FMTeam[]; matches: FMMatch[] }> {
  const build = await getBuildId();
  const path = `/_next/data/${build}/en/leagues/${FOTMOB_LEAGUE_ID}.json?id=${FOTMOB_LEAGUE_ID}`;
  let data: any;
  try {
    data = await fetchJson<any>(`${BASE}${path}`);
  } catch {
    const fresh = await getBuildId(true);
    data = await fetchJson<any>(
      `${BASE}/_next/data/${fresh}/en/leagues/${FOTMOB_LEAGUE_ID}.json?id=${FOTMOB_LEAGUE_ID}`
    );
  }
  const pp = data.pageProps ?? {};
  const allMatches: any[] = pp.fixtures?.allMatches ?? [];

  const matches: FMMatch[] = allMatches.map((m) => {
    const [hs, as_] = scoreParts(m.status?.scoreStr);
    const st = m.status ?? {};
    const started = Boolean(st.started);
    const finished = Boolean(st.finished);
    return {
      fotmobId: Number(m.id),
      homeId: m.home?.id ? Number(m.home.id) : null,
      homeName: m.home?.name ?? null,
      awayId: m.away?.id ? Number(m.away.id) : null,
      awayName: m.away?.name ?? null,
      group: m.group ?? null,
      round: roundNumberFor(m.round ?? m.roundName),
      utcTime: st.utcTime ?? null,
      finished,
      started,
      liveMinute: started && !finished ? st.liveTime?.short ?? st.liveTime?.long ?? "EN VIVO" : null,
      homeScore: hs,
      awayScore: as_,
    };
  });

  // Solo las 48 selecciones de la fase de grupos (grupos A-L).
  const teamMap = new Map<number, FMTeam>();
  for (const m of matches) {
    if (!m.group || !/^[A-L]$/.test(m.group)) continue;
    if (m.homeId && !teamMap.has(m.homeId))
      teamMap.set(m.homeId, { fotmobId: m.homeId, name: m.homeName!, group: m.group });
    if (m.awayId && !teamMap.has(m.awayId))
      teamMap.set(m.awayId, { fotmobId: m.awayId, name: m.awayName!, group: m.group });
  }

  return { teams: [...teamMap.values()], matches };
}

// ---------- plantilla de un equipo ----------
export async function getTeamSquad(teamId: number): Promise<FMSquadPlayer[]> {
  const data = await fetchJson<any>(`${BASE}/api/data/teams?id=${teamId}`);
  const groups: any[] = data.squad?.squad ?? [];
  const out: FMSquadPlayer[] = [];
  for (const g of groups) {
    const pos = ROLE_TO_POS[g.title];
    if (!pos) continue; // saltar 'coach'
    for (const p of g.members ?? []) {
      if (!p.id) continue;
      out.push({
        fotmobId: Number(p.id),
        name: p.name,
        age: p.age ?? null,
        position: pos,
        shirtNumber: p.shirtNumber ?? null,
        transferValue: typeof p.transferValue === "number" ? p.transferValue : null,
        avgRating: typeof p.rating === "number" ? p.rating : null,
      });
    }
  }
  return out;
}

// ---------- detalle de partido: ratings, goles, asistencias, minutos ----------
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();

export async function getMatchDetails(matchId: number): Promise<FMMatchDetail> {
  const data = await fetchJson<any>(`${BASE}/api/data/matchDetails?matchId=${matchId}`);
  const content = data.content ?? {};
  const ratings: Record<number, number> = {};
  const goals: Record<number, number> = {};
  const assists: Record<number, number> = {};
  const playedTeam: Record<number, number> = {};
  const minutes: Record<number, number> = {};
  const nameToId = new Map<string, number>();

  for (const side of ["homeTeam", "awayTeam"] as const) {
    const team = content.lineup?.[side];
    if (!team) continue;
    const teamId = Number(team.id);
    const starters = team.starters ?? [];
    const subs = team.subs ?? [];
    for (const [isStarter, grp] of [
      [true, starters],
      [false, subs],
    ] as const) {
      for (const p of grp) {
        const id = Number(p.id);
        if (!id) continue;
        playedTeam[id] = teamId;
        nameToId.set(norm(p.name ?? ""), id);
        const r = p.performance?.rating;
        if (typeof r === "number") {
          ratings[id] = r;
          // Si tiene rating asumimos que jugó; titular ~ 90', suplente ~ 30'.
          minutes[id] = isStarter ? 90 : 30;
        }
      }
    }
  }

  const events: any[] = content.matchFacts?.events?.events ?? [];
  for (const e of events) {
    if (e.type !== "Goal") continue;
    const scorerId = Number(e.player?.id);
    if (scorerId) goals[scorerId] = (goals[scorerId] ?? 0) + 1;
    const assistRaw = (e.assistStr ?? "").replace(/(?:^|\s)assist by\s+/i, "").trim();
    if (assistRaw) {
      const aid = nameToId.get(norm(assistRaw));
      if (aid) assists[aid] = (assists[aid] ?? 0) + 1;
    }
  }

  return { ratings, goals, assists, playedTeam, minutes };
}
