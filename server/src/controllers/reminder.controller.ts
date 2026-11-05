import { Request, Response } from "express";
import {
  listReminders,
  createReminder,
  setReminderCompleted,
  deleteReminder,
} from "../services/reminder.service";
import { validateReminderInput, validateCompletedInput } from "../validators/reminder.validator";
import { routeParam } from "../utils/params.util";

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof Error && error.message === "NOT_FOUND") {
    return res.status(404).json({ success: false, message: "Reminder not found." });
  }
  if (error instanceof Error && error.message === "APPLICATION_NOT_FOUND") {
    return res.status(404).json({ success: false, message: "Application not found." });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: fallback });
}

export async function getReminders(req: Request, res: Response) {
  try {
    const reminders = await listReminders(req.userId!);
    return res.json({ success: true, data: { reminders } });
  } catch (error) {
    return handleError(res, error, "Could not load reminders.");
  }
}

export async function postReminder(req: Request, res: Response) {
  const validationError = validateReminderInput(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const reminder = await createReminder(req.userId!, req.body);
    return res.status(201).json({ success: true, data: { reminder } });
  } catch (error) {
    return handleError(res, error, "Could not create the reminder.");
  }
}

export async function patchReminderCompleted(req: Request, res: Response) {
  const validationError = validateCompletedInput(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const reminder = await setReminderCompleted(req.userId!, routeParam(req.params.id), req.body.completed);
    return res.json({ success: true, data: { reminder } });
  } catch (error) {
    return handleError(res, error, "Could not update the reminder.");
  }
}

export async function removeReminder(req: Request, res: Response) {
  try {
    await deleteReminder(req.userId!, routeParam(req.params.id));
    return res.json({ success: true, data: { message: "Reminder deleted." } });
  } catch (error) {
    return handleError(res, error, "Could not delete the reminder.");
  }
}