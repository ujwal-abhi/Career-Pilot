import { Request, Response } from "express";
import { getAnalytics } from "../services/analytics.service";

export async function getAnalyticsData(req: Request, res: Response) {
  try {
    const analytics = await getAnalytics(req.userId!);
    return res.json({ success: true, data: analytics });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load analytics." });
  }
}