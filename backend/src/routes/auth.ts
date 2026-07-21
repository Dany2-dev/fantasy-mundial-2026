import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth, signToken } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, "El nombre necesita al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña necesita al menos 6 caracteres"),
});

// El presupuesto ya no vive en User: es por liga (LeagueMembership.coins).
const publicUser = { id: true, name: true, email: true } as const;

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, password } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Ese email ya está registrado" });

  const user = await prisma.user.create({
    data: { name, email, password: await bcrypt.hash(password, 10) },
    select: publicUser,
  });
  res.status(201).json({ token: signToken(user.id), user });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email y contraseña son obligatorios" });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }
  const { password: _omit, ...safe } = user;
  res.json({ token: signToken(user.id), user: { id: safe.id, name: safe.name, email: safe.email } });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: (req as AuthRequest).userId },
    select: publicUser,
  });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ user });
});

export default router;
