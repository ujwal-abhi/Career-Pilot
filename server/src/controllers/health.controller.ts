import { Request, Response } from "express";

export const getHealth = (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
};