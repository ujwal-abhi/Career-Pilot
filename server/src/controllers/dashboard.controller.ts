import { Request, Response } from "express";
import { getDashboardStats } from "../services/dashboard.service";

export async function getDashboard(req: Request, res: Response) {
  try {
    const stats = await getDashboardStats(req.userId!);
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load dashboard data." });
  }
}