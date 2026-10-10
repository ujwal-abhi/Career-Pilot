import { Request, Response } from "express";
import { runInterviewPrep, getLatestInterviewSet } from "../services/interviewPrep.service";

export async function postInterviewPrep(req: Request, res: Response) {
  const { resumeId, applicationId } = req.body;
  if (!resumeId || !applicationId) {
    return res.status(400).json({ success: false, message: "resumeId and applicationId are required." });
  }
  try {
    const interviewSet = await runInterviewPrep(req.userId!, resumeId, applicationId);
    return res.status(201).json({ success: true, data: { interviewSet } });
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
          message: "This application has no job description. Add one by editing the application.",
        });
      }
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not generate interview questions." });
  }
}

export async function getInterviewPrep(req: Request, res: Response) {
  const { resumeId, applicationId } = req.params;
  try {
    const interviewSet = await getLatestInterviewSet(req.userId!, resumeId, applicationId);
    return res.json({ success: true, data: { interviewSet } });
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
    return res.status(500).json({ success: false, message: "Could not load interview questions." });
  }
}