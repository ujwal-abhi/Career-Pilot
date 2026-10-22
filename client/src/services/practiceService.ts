import type { PracticeAttempt, WeakAreas } from "../types/practice.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

export async function submitAttempt(
  questionId: string,
  answer: string
): Promise<{ attempt: PracticeAttempt }> {
  const response = await fetch(`${API_URL}/api/ai/practice/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ questionId, answer }),
  });
  return handleResponse(response);
}

export async function getAttempts(questionId: string): Promise<{ attempts: PracticeAttempt[] }> {
  const response = await fetch(`${API_URL}/api/ai/practice/questions/${questionId}/attempts`, {
    credentials: "include",
  });
  return handleResponse(response);
}

export async function getWeakAreas(): Promise<{ weakAreas: WeakAreas }> {
  const response = await fetch(`${API_URL}/api/ai/practice/weak-areas`, {
    credentials: "include",
  });
  return handleResponse(response);
}