import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api/client";
import CardClipDefs from "./components/CardClipDefs";
import Layout from "./components/Layout";
import { fetchMe } from "./store/authSlice";
import { fetchLeagues } from "./store/leagueSlice";
import { useAppDispatch, useAppSelector } from "./store/store";
import Auth from "./pages/Auth";
import Collection from "./pages/Collection";
import Home from "./pages/Home";
import Leagues from "./pages/Leagues";
import Market from "./pages/Market";
import Packs from "./pages/Packs";
import Squad from "./pages/Squad";

export default function App() {
  const dispatch = useAppDispatch();
  const { user, status } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (getToken() && !user) dispatch(fetchMe());
  }, [dispatch, user]);

  useEffect(() => {
    if (user) dispatch(fetchLeagues());
  }, [dispatch, user]);

  if (status === "loading" && !user) {
    return <p style={{ textAlign: "center", padding: 48 }}>Cargando…</p>;
  }

  return (
    <>
      <CardClipDefs />
      <Routes>
        <Route path="/acceso" element={<Auth />} />
        {user ? (
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/sobres" element={<Packs />} />
            <Route path="/coleccion" element={<Collection />} />
            <Route path="/once" element={<Squad />} />
            <Route path="/mercado" element={<Market />} />
            <Route path="/ligas" element={<Leagues />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/acceso" replace />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
