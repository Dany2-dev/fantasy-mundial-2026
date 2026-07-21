import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { api, getToken, setToken } from "../api/client";
import { User } from "../types";

interface AuthState {
  user: User | null;
  status: "idle" | "loading" | "ready";
  error: string | null;
  // Solo cubre el chequeo inicial de sesión (fetchMe con el token guardado).
  // Separado de `status` para que un login/registro fallido no dispare la
  // pantalla de carga de App.tsx y desmonte toda la página de Auth (perdía
  // el scroll y los campos del formulario en cada intento fallido).
  checkingSession: boolean;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
  checkingSession: !!getToken(),
};

type AuthResponse = { token: string; user: User };

export const login = createAsyncThunk("auth/login", async (body: { email: string; password: string }) => {
  const data = await api<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) });
  setToken(data.token);
  return data.user;
});

export const register = createAsyncThunk(
  "auth/register",
  async (body: { name: string; email: string; password: string }) => {
    const data = await api<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) });
    setToken(data.token);
    return data.user;
  }
);

export const fetchMe = createAsyncThunk("auth/me", async () => {
  const data = await api<{ user: User }>("/auth/me");
  return data.user;
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      setToken(null);
      state.user = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers(builder) {
    for (const thunk of [login, register, fetchMe]) {
      builder
        .addCase(thunk.pending, (state) => {
          state.status = "loading";
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.status = "ready";
          state.user = action.payload;
          if (thunk === fetchMe) state.checkingSession = false;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.status = "idle";
          state.error = action.error.message ?? "Error de autenticación";
          if (thunk === fetchMe) {
            setToken(null);
            state.checkingSession = false;
          }
        });
    }
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
