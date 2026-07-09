export interface User {
  id: string;
  name: string;
  email: string;
  coins: number;
}

export interface Country {
  id: number;
  name: string;
  flag: string;
  group: string;
}

export interface Player {
  id: number;
  name: string;
  position: "POR" | "DEF" | "MED" | "DEL";
  rating: number;
  basePrice: number;
  countryId: number;
  country: Country;
}

export interface League {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  memberCount?: number;
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

export type Rarity = "oro" | "plata" | "bronce";

export function rarityOf(rating: number): Rarity {
  if (rating >= 85) return "oro";
  if (rating >= 78) return "plata";
  return "bronce";
}
