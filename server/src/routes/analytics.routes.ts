import { Router } from "express";
import { getAnalyticsData } from "../controllers/analytics.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, getAnalyticsData);

export default router;