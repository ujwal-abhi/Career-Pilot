import type { ResumeAnalysis } from "../types/analysis.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

export async function runAnalysis(resumeId: string): Promise<{ analysis: ResumeAnalysis }> {
  const response = await fetch(`${API_URL}/api/ai/resume-analysis/${resumeId}`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(response);
}

export async function getAnalysis(resumeId: string): Promise<{ analysis: ResumeAnalysis | null }> {
  const response = await fetch(`${API_URL}/api/ai/resume-analysis/${resumeId}`, {
    credentials: "include",
  });
  return handleResponse(response);
}