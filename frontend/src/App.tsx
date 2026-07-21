import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api/client";
import CardClipDefs from "./components/CardClipDefs";
import Layout from "./components/Layout";
import { fetchMe } from "./store/authSlice";
import { fetchLeagues } from "./store/leagueSlice";
import { useAppDispatch, useAppSelector } from "./store/store";

const Auth = lazy(() => import("./pages/Auth"));
const Collection = lazy(() => import("./pages/Collection"));
const History = lazy(() => import("./pages/History"));
const Home = lazy(() => import("./pages/Home"));
const Leagues = lazy(() => import("./pages/Leagues"));
const Market = lazy(() => import("./pages/Market"));
const Matches = lazy(() => import("./pages/Matches"));
const Packs = lazy(() => import("./pages/Packs"));
const Play = lazy(() => import("./pages/Play"));
const Rivals = lazy(() => import("./pages/Rivals"));
const Squad = lazy(() => import("./pages/Squad"));
const Shop = lazy(() => import("./pages/Shop"));

const PageFallback = () => <p style={{ textAlign: "center", padding: 48 }}>Cargando…</p>;

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
    return <PageFallback />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
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
            <Route path="/partidos" element={<Matches />} />
            <Route path="/rivales" element={<Rivals />} />
            <Route path="/historial" element={<History />} />
            <Route path="/jugar" element={<Play />} />
            <Route path="/shop" element={<Shop />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/acceso" replace />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
