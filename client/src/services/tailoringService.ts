import type { Tailoring } from "../types/tailoring.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

export async function runTailoring(
  resumeId: string,
  applicationId: string
): Promise<{ tailoring: Tailoring }> {
  const response = await fetch(`${API_URL}/api/ai/resume-tailor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ resumeId, applicationId }),
  });
  return handleResponse(response);
}

export async function getTailoring(
  resumeId: string,
  applicationId: string
): Promise<{ tailoring: Tailoring | null }> {
  const response = await fetch(`${API_URL}/api/ai/resume-tailor/${resumeId}/${applicationId}`, {
    credentials: "include",
  });
  return handleResponse(response);
}