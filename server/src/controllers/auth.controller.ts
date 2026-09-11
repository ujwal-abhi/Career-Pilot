import { Request, Response } from "express";
import { registerUser, loginUser, getUserById } from "../services/auth.service";
import { validateRegisterInput, validateLoginInput } from "../validators/auth.validator";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // set to true in production (requires HTTPS)
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

export async function register(req: Request, res: Response) {
  const validationError = validateRegisterInput(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    const { token, user } = await registerUser(req.body);
    res.cookie("token", token, COOKIE_OPTIONS);
    return res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_IN_USE") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
}

export async function login(req: Request, res: Response) {
  const validationError = validateLoginInput(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    const { token, user } = await loginUser(req.body);
    res.cookie("token", token, COOKIE_OPTIONS);
    return res.json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
}

export function logout(req: Request, res: Response) {
  res.clearCookie("token", COOKIE_OPTIONS);
  return res.json({ success: true, data: { message: "Logged out successfully." } });
}

export async function getMe(req: Request, res: Response) {
  const user = await getUserById(req.userId!);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  return res.json({ success: true, data: { user } });
}