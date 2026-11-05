import { Router } from "express";
import { getNotificationList, postSnoozeFollowUp } from "../controllers/notification.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", getNotificationList);
router.post("/follow-ups/:applicationId/snooze", postSnoozeFollowUp);

export default router;