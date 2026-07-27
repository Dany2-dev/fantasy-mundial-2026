import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { api } from "../api/client";
import { Player } from "../types";
import { fetchCollection } from "./collectionSlice";
import { fetchLeagues } from "./leagueSlice";

interface MarketState {
  // Jugador que se está fichando ahora mismo: sirve para bloquear los botones
  // y evitar que se fiche dos veces por doble clic.
  signingPlayerId: number | null;
  // Último fichaje cerrado. Mientras tenga valor, la página muestra la carta
  // dándose la vuelta; se limpia al cerrar la celebración.
  lastSigned: { player: Player; price: number } | null;
  error: string | null;
}

const initialState: MarketState = { signingPlayerId: null, lastSigned: null, error: null };

/** Ficha a un agente libre y, de paso, refresca presupuesto y colección. */
export const signFreeAgent = createAsyncThunk(
  "market/signFreeAgent",
  async (
    { leagueId, player, price }: { leagueId: string; player: Player; price: number },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await api("/free-agents/sign", {
        method: "POST",
        body: JSON.stringify({ leagueId, playerId: player.id }),
      });
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : "No se pudo fichar");
    }
    // El fichaje toca dos cosas: el dinero de la liga y tu plantilla.
    dispatch(fetchLeagues());
    dispatch(fetchCollection(leagueId));
    return { player, price };
  }
);

const marketSlice = createSlice({
  name: "market",
  initialState,
  reducers: {
    // Cierra la celebración del fichaje.
    clearLastSigned(state) {
      state.lastSigned = null;
    },
    clearMarketError(state) {
      state.error = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(signFreeAgent.pending, (state, action) => {
        state.signingPlayerId = action.meta.arg.player.id;
        state.error = null;
      })
      .addCase(signFreeAgent.fulfilled, (state, action) => {
        state.signingPlayerId = null;
        state.lastSigned = action.payload;
      })
      .addCase(signFreeAgent.rejected, (state, action: PayloadAction<unknown>) => {
        state.signingPlayerId = null;
        state.error = typeof action.payload === "string" ? action.payload : "No se pudo fichar";
      });
  },
});

export const { clearLastSigned, clearMarketError } = marketSlice.actions;
export default marketSlice.reducer;
