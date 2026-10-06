import type { JobMatch, MatchOptionResume, MatchOptionApplication } from "../types/jobMatch.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

export async function getMatchOptions(): Promise<{
  resumes: MatchOptionResume[];
  applications: MatchOptionApplication[];
}> {
  const response = await fetch(`${API_URL}/api/ai/job-match/options`, {
    credentials: "include",
  });
  return handleResponse(response);
}

export async function runJobMatch(resumeId: string, applicationId: string): Promise<{ match: JobMatch }> {
  const response = await fetch(`${API_URL}/api/ai/job-match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ resumeId, applicationId }),
  });
  return handleResponse(response);
}

export async function getJobMatch(
  resumeId: string,
  applicationId: string
): Promise<{ match: JobMatch | null }> {
  const response = await fetch(`${API_URL}/api/ai/job-match/${resumeId}/${applicationId}`, {
    credentials: "include",
  });
  return handleResponse(response);
}