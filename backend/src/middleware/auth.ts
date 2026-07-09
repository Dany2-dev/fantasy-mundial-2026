import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "secreto-dev-cambialo";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export interface AuthRequest extends Request {
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub?: string };
    if (!payload.sub) throw new Error("sin sub");
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

export function signToken(userId: string) {
  return jwt.sign({}, JWT_SECRET, { subject: userId, expiresIn: "7d" });
}
