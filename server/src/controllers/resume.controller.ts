import { Request, Response } from "express";
import {
  listResumes,
  getResumeById,
  createResume,
  deleteResume,
  setDefaultResume,
  getResumeFilePath,
} from "../services/resume.service";
import { routeParam } from "../utils/params.util";

export async function getResumes(req: Request, res: Response) {
  try {
    const resumes = await listResumes(req.userId!);
    return res.json({ success: true, data: { resumes } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load resumes." });
  }
}

export async function postResume(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file was uploaded." });
  }
  try {
    const resume = await createResume(req.userId!, req.file);
    return res.status(201).json({ success: true, data: { resume } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not save resume." });
  }
}

export async function downloadResume(req: Request, res: Response) {
  try {
    const resume = await getResumeById(req.userId!, routeParam(req.params.id));
    const filePath = getResumeFilePath(resume.storedName);
    return res.download(filePath, resume.fileName);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not download resume." });
  }
}

export async function removeResume(req: Request, res: Response) {
  try {
    await deleteResume(req.userId!, routeParam(req.params.id));
    return res.json({ success: true, data: { message: "Resume deleted." } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not delete resume." });
  }
}

export async function putDefaultResume(req: Request, res: Response) {
  try {
    await setDefaultResume(req.userId!, routeParam(req.params.id));
    return res.json({ success: true, data: { message: "Default resume updated." } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not update default resume." });
  }
}