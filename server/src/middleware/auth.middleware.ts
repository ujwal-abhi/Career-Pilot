import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated." });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session." });
  }
}