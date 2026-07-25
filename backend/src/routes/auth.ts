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
const publicUser = { id: true, name: true, email: true, avatarUrl: true } as const;

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
  // Las cuentas creadas con Google guardan `password: ""`. bcrypt.compare
  // contra "" siempre falla, pero el mensaje genérico sería confuso, así que
  // se les dice explícitamente por dónde entrar.
  if (user && !user.password && user.googleId) {
    return res.status(401).json({ error: "Esa cuenta entra con Google. Usa el botón de Google." });
  }
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }
  const { password: _omit, ...safe } = user;
  res.json({ token: signToken(user.id), user: { id: safe.id, name: safe.name, email: safe.email } });
});

// --------------------------------------------------------------------------
// Acceso con Google
//
// El front usa Google Identity Services y nos manda el `credential` (un JWT
// firmado por Google). Lo validamos contra el endpoint oficial `tokeninfo` en
// vez de verificar la firma en local: evita sumar `google-auth-library` y su
// cache de claves públicas por un flujo que solo corre al iniciar sesión. El
// costo es una llamada HTTP por login, que a la escala de este proyecto no
// pesa. Si algún día el login se vuelve caliente, hay que cambiar a
// verificación local con JWKS.

interface GoogleTokenInfo {
  aud: string;
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  picture?: string;
}

async function verifyGoogleToken(credential: string): Promise<GoogleTokenInfo> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("El acceso con Google no está configurado en el servidor");

  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!r.ok) throw new Error("El token de Google no es válido");
  const info = (await r.json()) as GoogleTokenInfo;

  // `aud` es la comprobación que impide que alguien reutilice aquí un token
  // emitido para OTRA aplicación: sin esto, cualquier JWT válido de Google
  // serviría para entrar como el dueño de ese email.
  if (info.aud !== clientId) throw new Error("Ese token de Google es de otra aplicación");
  if (info.email_verified !== true && info.email_verified !== "true") {
    throw new Error("Tu email de Google no está verificado");
  }
  if (!info.email || !info.sub) throw new Error("Google no devolvió los datos de la cuenta");
  return info;
}

router.get("/google/config", (_req, res) => {
  // El front pregunta si mostrar o no el botón: sin client id configurado, no
  // tiene sentido pintarlo.
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID ?? null });
});

router.post("/google", async (req, res) => {
  const credential = req.body?.credential;
  if (typeof credential !== "string" || !credential) {
    return res.status(400).json({ error: "Falta el token de Google" });
  }

  let info: GoogleTokenInfo;
  try {
    info = await verifyGoogleToken(credential);
  } catch (e) {
    return res.status(401).json({ error: e instanceof Error ? e.message : "No se pudo validar tu cuenta de Google" });
  }

  const email = info.email.toLowerCase();
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: info.sub }, { email }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: info.name?.trim() || email.split("@")[0],
        googleId: info.sub,
        avatarUrl: info.picture ?? null,
        password: "", // sin contraseña: esta cuenta entra solo con Google
      },
    });
  } else if (!user.googleId) {
    // Ya existía con email+contraseña: se vincula el Google a esa misma cuenta
    // en vez de crear una duplicada. Es seguro porque Google ya nos confirmó
    // que el email está verificado y le pertenece.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: info.sub, avatarUrl: user.avatarUrl ?? info.picture ?? null },
    });
  }

  res.json({
    token: signToken(user.id),
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
  });
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
