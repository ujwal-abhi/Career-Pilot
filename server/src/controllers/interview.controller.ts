import { Request, Response } from "express";
import {
  listInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
} from "../services/interview.service";
import { validateInterviewInput } from "../validators/interview.validator";
import { routeParam } from "../utils/params.util";

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof Error && error.message === "NOT_FOUND") {
    return res.status(404).json({ success: false, message: "Interview not found." });
  }
  if (error instanceof Error && error.message === "APPLICATION_NOT_FOUND") {
    return res.status(404).json({ success: false, message: "Application not found." });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: fallback });
}

export async function getInterviews(req: Request, res: Response) {
  try {
    const interviews = await listInterviews(req.userId!);
    return res.json({ success: true, data: { interviews } });
  } catch (error) {
    return handleError(res, error, "Could not load interviews.");
  }
}

export async function postInterview(req: Request, res: Response) {
  const validationError = validateInterviewInput(req.body, { requireApplication: true });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const interview = await createInterview(req.userId!, req.body);
    return res.status(201).json({ success: true, data: { interview } });
  } catch (error) {
    return handleError(res, error, "Could not schedule the interview.");
  }
}

export async function putInterview(req: Request, res: Response) {
  const validationError = validateInterviewInput(req.body, { requireApplication: false });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const interview = await updateInterview(req.userId!, routeParam(req.params.id), req.body);
    return res.json({ success: true, data: { interview } });
  } catch (error) {
    return handleError(res, error, "Could not update the interview.");
  }
}

export async function removeInterview(req: Request, res: Response) {
  try {
    await deleteInterview(req.userId!, routeParam(req.params.id));
    return res.json({ success: true, data: { message: "Interview deleted." } });
  } catch (error) {
    return handleError(res, error, "Could not delete the interview.");
  }
}