import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { api } from "../api/client";
import { League } from "../types";

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

export const createLeague = createAsyncThunk("leagues/create", async (name: string) => {
  const data = await api<{ league: League }>("/leagues", { method: "POST", body: JSON.stringify({ name }) });
  return data.league;
});

export const joinLeague = createAsyncThunk("leagues/join", async (code: string) => {
  const data = await api<{ league: League }>("/leagues/join", { method: "POST", body: JSON.stringify({ code }) });
  return data.league;
});

const leagueSlice = createSlice({
  name: "leagues",
  initialState,
  reducers: {
    setActiveLeague(state, action: PayloadAction<string>) {
      state.activeLeagueId = action.payload;
      localStorage.setItem(ACTIVE_KEY, action.payload);
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
        state.leagues.push({ ...action.payload, memberCount: 1 });
        state.activeLeagueId = action.payload.id;
        localStorage.setItem(ACTIVE_KEY, action.payload.id);
      })
      .addCase(joinLeague.fulfilled, (state, action) => {
        state.leagues.push(action.payload);
        state.activeLeagueId = action.payload.id;
        localStorage.setItem(ACTIVE_KEY, action.payload.id);
      });
  },
});

export const { setActiveLeague, clearLeagues } = leagueSlice.actions;
export default leagueSlice.reducer;
