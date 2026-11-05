import { Request, Response } from "express";
import { getNotifications, snoozeFollowUp } from "../services/notification.service";
import { routeParam } from "../utils/params.util";

export async function getNotificationList(req: Request, res: Response) {
  try {
    const notifications = await getNotifications(req.userId!);
    return res.json({ success: true, data: notifications });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load notifications." });
  }
}

export async function postSnoozeFollowUp(req: Request, res: Response) {
  try {
    const result = await snoozeFollowUp(req.userId!, routeParam(req.params.applicationId));
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Application not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not snooze the follow-up." });
  }
}