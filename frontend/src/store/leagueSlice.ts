import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { api } from "../api/client";
import { League, Player } from "../types";

const ACTIVE_KEY = "fm26_liga_activa";

interface LeagueState {
  leagues: League[];
  activeLeagueId: string | null;
  status: "idle" | "loading" | "ready";
}

const initialState: LeagueState = {
  leagues: [],
  activeLeagueId: localStorage.getItem(ACTIVE_KEY),
  status: "idle",
};

export const fetchLeagues = createAsyncThunk("leagues/fetch", async () => {
  const data = await api<{ leagues: League[] }>("/leagues");
  return data.leagues;
});

export const createLeague = createAsyncThunk(
  "leagues/create",
  async (body: { name: string; competitionId: number }) => {
    const data = await api<{ league: League; starterPack: Player[] | null }>("/leagues", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data;
  }
);

export const joinLeague = createAsyncThunk("leagues/join", async (code: string) => {
  const data = await api<{ league: League; starterPack: Player[] | null }>("/leagues/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return data;
});

const leagueSlice = createSlice({
  name: "leagues",
  initialState,
  reducers: {
    setActiveLeague(state, action: PayloadAction<string>) {
      state.activeLeagueId = action.payload;
      localStorage.setItem(ACTIVE_KEY, action.payload);
    },
    setLeagueCoins(state, action: PayloadAction<{ leagueId: string; coins: number }>) {
      const league = state.leagues.find((l) => l.id === action.payload.leagueId);
      if (league) league.myCoins = action.payload.coins;
    },
    clearLeagues(state) {
      state.leagues = [];
      state.activeLeagueId = null;
      localStorage.removeItem(ACTIVE_KEY);
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchLeagues.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchLeagues.fulfilled, (state, action) => {
        state.status = "ready";
        state.leagues = action.payload;
        const stillMember = action.payload.some((l) => l.id === state.activeLeagueId);
        if (!stillMember) {
          state.activeLeagueId = action.payload[0]?.id ?? null;
          if (state.activeLeagueId) localStorage.setItem(ACTIVE_KEY, state.activeLeagueId);
          else localStorage.removeItem(ACTIVE_KEY);
        }
      })
      .addCase(createLeague.fulfilled, (state, action) => {
        state.leagues.push({ ...action.payload.league, memberCount: 1 });
        state.activeLeagueId = action.payload.league.id;
        localStorage.setItem(ACTIVE_KEY, action.payload.league.id);
      })
      .addCase(joinLeague.fulfilled, (state, action) => {
        state.leagues.push(action.payload.league);
        state.activeLeagueId = action.payload.league.id;
        localStorage.setItem(ACTIVE_KEY, action.payload.league.id);
      });
  },
});

export const { setActiveLeague, setLeagueCoins, clearLeagues } = leagueSlice.actions;
export default leagueSlice.reducer;
