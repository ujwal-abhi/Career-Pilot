import { Request, Response } from "express";
import { submitAttempt, listAttempts, getWeakAreas } from "../services/practice.service";

export async function postPracticeAttempt(req: Request, res: Response) {
  const { questionId, answer } = req.body;
  if (!questionId || typeof questionId !== "string") {
    return res.status(400).json({ success: false, message: "questionId is required." });
  }
  try {
    const attempt = await submitAttempt(req.userId!, questionId, answer);
    return res.status(201).json({ success: true, data: { attempt } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "QUESTION_NOT_FOUND") {
        return res.status(404).json({ success: false, message: "Question not found." });
      }
      if (error.message === "EMPTY_ANSWER") {
        return res.status(400).json({ success: false, message: "Please write an answer first." });
      }
      if (error.message === "ANSWER_TOO_LONG") {
        return res
          .status(400)
          .json({ success: false, message: "Your answer is too long (max 5000 characters)." });
      }
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not check your answer." });
  }
}

export async function getPracticeAttempts(req: Request, res: Response) {
  try {
    const attempts = await listAttempts(req.userId!, req.params.questionId);
    return res.json({ success: true, data: { attempts } });
  } catch (error) {
    if (error instanceof Error && error.message === "QUESTION_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Question not found." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load attempts." });
  }
}

export async function getPracticeWeakAreas(req: Request, res: Response) {
  try {
    const weakAreas = await getWeakAreas(req.userId!);
    return res.json({ success: true, data: { weakAreas } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load weak areas." });
  }
}