export interface User {
  id: string;
  name: string;
  email: string;
  coins: number;
}

export interface Team {
  id: number;
  name: string;
  logoUrl: string | null;
  flag: string | null;
  group?: string | null;
}

export interface Player {
  id: number;
  name: string;
  position: "POR" | "DEF" | "MED" | "DEL";
  rating: number;
  basePrice: number;
  photoUrl: string | null;
  age?: number | null;
  teamId: number;
  team: Team;
  // Presentes cuando el jugador viene de /collection o /collection/market (dentro de una liga).
  clause?: number;
  protectedUntil?: string | null;
  isProtected?: boolean;
  listedPrice?: number | null;
}

export interface Competition {
  id: number;
  name: string;
  ccode: string | null;
  type: string;
  logoUrl: string | null;
  isCurrent: boolean;
  teamCount: number;
  playerCount: number;
  hasStarted: boolean;
}

export interface GameweekInfo {
  number: number;
  label: string;
  deadline: string;
  status: "upcoming" | "finished";
}

export interface League {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  memberCount?: number;
  competitionId?: number;
  competition?: { id: number; name: string; logoUrl: string | null; type?: string } | null;
  currentGameweek?: GameweekInfo | null;
}

export interface Standing {
  userId: string;
  name: string;
  points: number;
  cardCount: number;
  teamValue: number;
}

export interface MarketCard extends Player {
  owner: { id: string; name: string };
}

export interface GameweekScore {
  gameweek: number;
  gameweekLabel: string;
  status: "upcoming" | "finished";
  points: number;
}

export interface Trade {
  id: string;
  leagueId: string;
  fromUserId: string;
  toUserId: string;
  offeredPlayerId: number;
  requestedPlayerId: number;
  coins: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  fromUser: { id: string; name: string };
  toUser: { id: string; name: string };
  offeredPlayer?: Player;
  requestedPlayer?: Player;
}

export interface MatchTeam {
  name: string;
  flag: string | null;
  logoUrl: string | null;
}

export interface Match {
  id: number;
  home: MatchTeam;
  away: MatchTeam;
  group: string | null;
  round: number | null;
  roundLabel: string | null;
  utcTime: string | null;
  status: "scheduled" | "live" | "finished";
  homeScore: number | null;
  awayScore: number | null;
}

export interface PlayerStatMatch {
  opponent: string;
  opponentLogo: string | null;
  home: boolean;
  homeScore: number | null;
  awayScore: number | null;
  utcTime: string | null;
  status: string;
}

export interface PlayerStatRow {
  gameweek: number;
  gameweekLabel: string;
  status: string;
  goals: number;
  assists: number;
  points: number;
  match: PlayerStatMatch | null;
}

export interface PlayerOwnership {
  owner: { id: string; name: string };
  isMine: boolean;
  clause: number;
  protectedUntil: string | null;
  protected: boolean;
}

export interface PlayerDetail {
  player: Player;
  ownership: PlayerOwnership | null;
  listing: { id: string; price: number; sellerId: string } | null;
  stats: PlayerStatRow[];
}

export interface Listing {
  id: string;
  leagueId: string;
  sellerId: string;
  playerId: number;
  price: number;
  createdAt: string;
  player: Player;
  seller: { id: string; name: string };
}

export type Rarity = "oro" | "plata" | "bronce";

export function rarityOf(rating: number): Rarity {
  if (rating >= 85) return "oro";
  if (rating >= 78) return "plata";
  return "bronce";
}
