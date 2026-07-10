import cors from "cors";
import express from "express";
import authRouter from "./routes/auth";
import collectionRouter from "./routes/collection";
import competitionsRouter from "./routes/competitions";
import leaguesRouter from "./routes/leagues";
import matchesRouter from "./routes/matches";
import packsRouter from "./routes/packs";
import playersRouter from "./routes/players";
import squadRouter from "./routes/squad";
import tradesRouter from "./routes/trades";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "Fantasy Mundial 2026 API" }));

app.use("/api/auth", authRouter);
app.use("/api", playersRouter); // /api/players, /api/countries
app.use("/api/competitions", competitionsRouter);
app.use("/api/leagues", leaguesRouter);
app.use("/api/packs", packsRouter);
app.use("/api/collection", collectionRouter);
app.use("/api/squad", squadRouter);
app.use("/api/trades", tradesRouter);
app.use("/api/matches", matchesRouter);

// Manejador de errores: nunca filtrar detalles internos al cliente
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`⚽ API lista en http://localhost:${PORT}/api/health`);
});
