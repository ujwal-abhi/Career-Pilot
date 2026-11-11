import { Router } from "express";
import { postResumeAnalysis, getResumeAnalysis } from "../controllers/resumeAnalysis.controller";
import { getMatchOptions, postJobMatch, getJobMatch } from "../controllers/jobMatch.controller";
import { postTailoring, getTailoring } from "../controllers/tailoring.controller";
import { postInterviewPrep, getInterviewPrep } from "../controllers/interviewPrep.controller";
import {
  postPracticeAttempt,
  getPracticeAttempts,
  getPracticeWeakAreas,
} from "../controllers/practice.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { aiLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.use(requireAuth);
router.use(aiLimiter); // after requireAuth, so the limit is counted per signed-in user

router.post("/resume-analysis/:resumeId", postResumeAnalysis);
router.get("/resume-analysis/:resumeId", getResumeAnalysis);

router.get("/job-match/options", getMatchOptions);
router.post("/job-match", postJobMatch);
router.get("/job-match/:resumeId/:applicationId", getJobMatch);

router.post("/resume-tailor", postTailoring);
router.get("/resume-tailor/:resumeId/:applicationId", getTailoring);

router.post("/interview-questions", postInterviewPrep);
router.get("/interview-questions/:resumeId/:applicationId", getInterviewPrep);

router.post("/practice/attempts", postPracticeAttempt);
router.get("/practice/questions/:questionId/attempts", getPracticeAttempts);
router.get("/practice/weak-areas", getPracticeWeakAreas);

export default router;