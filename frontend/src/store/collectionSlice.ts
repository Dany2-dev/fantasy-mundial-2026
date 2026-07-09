import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../api/client";
import { Player } from "../types";

interface CollectionState {
  items: Player[];
  leagueId: string | null;
  status: "idle" | "loading" | "ready";
}

const initialState: CollectionState = { items: [], leagueId: null, status: "idle" };

export const fetchCollection = createAsyncThunk("collection/fetch", async (leagueId: string) => {
  const data = await api<{ collection: Player[] }>(`/collection?leagueId=${leagueId}`);
  return { leagueId, items: data.collection };
});

const collectionSlice = createSlice({
  name: "collection",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(fetchCollection.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchCollection.fulfilled, (state, action) => {
        state.status = "ready";
        state.items = action.payload.items;
        state.leagueId = action.payload.leagueId;
      })
      .addCase(fetchCollection.rejected, (state) => {
        state.status = "idle";
      });
  },
});

export default collectionSlice.reducer;
