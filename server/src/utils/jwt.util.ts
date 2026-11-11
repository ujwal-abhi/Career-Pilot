import jwt from "jsonwebtoken";
import { env } from "../config/env";

const JWT_EXPIRES_IN = "7d";
// Pinning the algorithm on BOTH sign and verify closes the "algorithm confusion" class of
// attacks, where a forged token names a weaker algorithm (or "none") for itself.
const JWT_ALGORITHM = "HS256";

export interface TokenPayload {
  userId: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret, { algorithms: [JWT_ALGORITHM] });
  // A token we signed always has a string userId. Anything else is treated as invalid
  // instead of being trusted because the signature happened to match.
  if (typeof decoded !== "object" || decoded === null || typeof decoded.userId !== "string") {
    throw new Error("INVALID_TOKEN_PAYLOAD");
  }
  return { userId: decoded.userId };
}