import { Router } from "express";
import { postResumeAnalysis, getResumeAnalysis } from "../controllers/resumeAnalysis.controller";
import { getMatchOptions, postJobMatch, getJobMatch } from "../controllers/jobMatch.controller";
import { postTailoring, getTailoring } from "../controllers/tailoring.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.post("/resume-analysis/:resumeId", postResumeAnalysis);
router.get("/resume-analysis/:resumeId", getResumeAnalysis);

router.get("/job-match/options", getMatchOptions);
router.post("/job-match", postJobMatch);
router.get("/job-match/:resumeId/:applicationId", getJobMatch);

router.post("/resume-tailor", postTailoring);
router.get("/resume-tailor/:resumeId/:applicationId", getTailoring);

export default router;