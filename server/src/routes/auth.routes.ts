import { Router } from "express";
import { register, login, logout, getMe } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { loginAccountLimiter, loginIpLimiter, registerLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginIpLimiter, loginAccountLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, getMe);

export default router;