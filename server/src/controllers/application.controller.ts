import { Request, Response } from "express";
import {
  listApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
} from "../services/application.service";
import { validateApplicationInput } from "../validators/application.validator";
import { routeParam } from "../utils/params.util";

export async function getApplications(req: Request, res: Response) {
  try {
    const applications = await listApplications(req.userId!);
    return res.json({ success: true, data: { applications } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load applications." });
  }
}

export async function getApplication(req: Request, res: Response) {
  try {
    const application = await getApplicationById(req.userId!, routeParam(req.params.id));
    return res.json({ success: true, data: { application } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Application not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
}

export async function postApplication(req: Request, res: Response) {
  const validationError = validateApplicationInput(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const application = await createApplication(req.userId!, req.body);
    return res.status(201).json({ success: true, data: { application } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not create application." });
  }
}

export async function putApplication(req: Request, res: Response) {
  const validationError = validateApplicationInput(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const application = await updateApplication(req.userId!, routeParam(req.params.id), req.body);
    return res.json({ success: true, data: { application } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Application not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not update application." });
  }
}

export async function removeApplication(req: Request, res: Response) {
  try {
    await deleteApplication(req.userId!, routeParam(req.params.id));
    return res.json({ success: true, data: { message: "Application deleted." } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Application not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not delete application." });
  }
}