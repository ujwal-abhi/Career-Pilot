import { Router } from "express";
import {
  getReminders,
  postReminder,
  patchReminderCompleted,
  removeReminder,
} from "../controllers/reminder.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", getReminders);
router.post("/", postReminder);
router.patch("/:id/completed", patchReminderCompleted);
router.delete("/:id", removeReminder);

export default router;