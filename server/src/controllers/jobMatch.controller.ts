import { Request, Response } from "express";
import {
  runJobMatch,
  getLatestJobMatch,
  listResumesForMatch,
  listApplicationsForMatch,
} from "../services/jobMatch.service";
import { routeParam } from "../utils/params.util";

export async function getMatchOptions(req: Request, res: Response) {
  try {
    const [resumes, applications] = await Promise.all([
      listResumesForMatch(req.userId!),
      listApplicationsForMatch(req.userId!),
    ]);
    return res.json({ success: true, data: { resumes, applications } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load options." });
  }
}

export async function postJobMatch(req: Request, res: Response) {
  const { resumeId, applicationId } = req.body;
  if (!resumeId || !applicationId) {
    return res.status(400).json({ success: false, message: "resumeId and applicationId are required." });
  }
  try {
    const match = await runJobMatch(req.userId!, resumeId, applicationId);
    return res.status(201).json({ success: true, data: { match } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RESUME_NOT_FOUND") {
        return res.status(404).json({ success: false, message: "Resume not found." });
      }
      if (error.message === "APPLICATION_NOT_FOUND") {
        return res.status(404).json({ success: false, message: "Application not found." });
      }
      if (error.message === "NO_RESUME_TEXT") {
        return res
          .status(400)
          .json({ success: false, message: "This resume has no extracted text. Try re-uploading it." });
      }
      if (error.message === "NO_JOB_DESCRIPTION") {
        return res.status(400).json({
          success: false,
          message: "This application has no job description to match against. Add one by editing the application.",
        });
      }
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not run job match analysis." });
  }
}

export async function getJobMatch(req: Request, res: Response) {
  const resumeId = routeParam(req.params.resumeId);
  const applicationId = routeParam(req.params.applicationId);
  try {
    const match = await getLatestJobMatch(req.userId!, resumeId, applicationId);
    return res.json({ success: true, data: { match } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RESUME_NOT_FOUND") {
        return res.status(404).json({ success: false, message: "Resume not found." });
      }
      if (error.message === "APPLICATION_NOT_FOUND") {
        return res.status(404).json({ success: false, message: "Application not found." });
      }
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load job match." });
  }
}