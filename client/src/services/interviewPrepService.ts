import type { InterviewSet } from "../types/interviewPrep.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

export async function runInterviewPrep(
  resumeId: string,
  applicationId: string
): Promise<{ interviewSet: InterviewSet }> {
  const response = await fetch(`${API_URL}/api/ai/interview-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ resumeId, applicationId }),
  });
  return handleResponse(response);
}

export async function getInterviewPrep(
  resumeId: string,
  applicationId: string
): Promise<{ interviewSet: InterviewSet | null }> {
  const response = await fetch(
    `${API_URL}/api/ai/interview-questions/${resumeId}/${applicationId}`,
    { credentials: "include" }
  );
  return handleResponse(response);
}