import { Router } from "express";
import {
  getInterviews,
  postInterview,
  putInterview,
  removeInterview,
} from "../controllers/interview.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", getInterviews);
router.post("/", postInterview);
router.put("/:id", putInterview);
router.delete("/:id", removeInterview);

export default router;