import { Router } from "express";
import { postResumeAnalysis, getResumeAnalysis } from "../controllers/resumeAnalysis.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.post("/resume-analysis/:resumeId", postResumeAnalysis);
router.get("/resume-analysis/:resumeId", getResumeAnalysis);

export default router;