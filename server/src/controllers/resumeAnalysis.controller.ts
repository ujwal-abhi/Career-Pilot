import { Request, Response } from "express";
import { runResumeAnalysis, getLatestAnalysis } from "../services/resumeAnalysis.service";

export async function postResumeAnalysis(req: Request, res: Response) {
  try {
    const analysis = await runResumeAnalysis(req.userId!, req.params.resumeId);
    return res.status(201).json({ success: true, data: { analysis } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }
    if (error instanceof Error && error.message === "NO_TEXT") {
      return res.status(400).json({
        success: false,
        message: "This resume has no extracted text to analyze. Try re-uploading it.",
      });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not analyze resume." });
  }
}

export async function getResumeAnalysis(req: Request, res: Response) {
  try {
    const analysis = await getLatestAnalysis(req.userId!, req.params.resumeId);
    return res.json({ success: true, data: { analysis } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load analysis." });
  }
}