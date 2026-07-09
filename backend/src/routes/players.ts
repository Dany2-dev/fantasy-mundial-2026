import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/countries", requireAuth, async (_req, res) => {
  const countries = await prisma.country.findMany({ orderBy: { name: "asc" } });
  res.json({ countries });
});

router.get("/players", requireAuth, async (req, res) => {
  const { search, position, countryId } = req.query;
  const players = await prisma.player.findMany({
    where: {
      ...(typeof search === "string" && search
        ? { name: { contains: search, mode: "insensitive" } }
        : {}),
      ...(typeof position === "string" && position ? { position } : {}),
      ...(typeof countryId === "string" && countryId ? { countryId: Number(countryId) } : {}),
    },
    include: { country: true },
    orderBy: { rating: "desc" },
  });
  res.json({ players });
});

export default router;
