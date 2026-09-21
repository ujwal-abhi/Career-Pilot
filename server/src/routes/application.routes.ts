import { Router } from "express";
import {
  getApplications,
  getApplication,
  postApplication,
  putApplication,
  removeApplication,
} from "../controllers/application.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", getApplications);
router.get("/:id", getApplication);
router.post("/", postApplication);
router.put("/:id", putApplication);
router.delete("/:id", removeApplication);

export default router;