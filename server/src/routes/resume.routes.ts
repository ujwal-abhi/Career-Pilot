import { Router } from "express";
import {
  getResumes,
  postResume,
  downloadResume,
  removeResume,
  putDefaultResume,
} from "../controllers/resume.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { uploadResume } from "../middleware/upload.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", getResumes);
router.post("/", uploadResume.single("resume"), postResume);
router.get("/:id/download", downloadResume);
router.delete("/:id", removeResume);
router.put("/:id/default", putDefaultResume);

export default router;