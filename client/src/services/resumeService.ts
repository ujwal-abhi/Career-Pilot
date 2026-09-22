import type { Resume } from "../types/resume.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

export async function getResumes(): Promise<{ resumes: Resume[] }> {
  const response = await fetch(`${API_URL}/api/resumes`, {
    credentials: "include",
  });
  return handleResponse(response);
}

export async function uploadResume(file: File): Promise<{ resume: Resume }> {
  const formData = new FormData();
  formData.append("resume", file);

  // No Content-Type header here on purpose — the browser sets the correct
  // multipart boundary automatically when the body is FormData. Setting it
  // manually would actually break the upload.
  const response = await fetch(`${API_URL}/api/resumes`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return handleResponse(response);
}

export function getDownloadUrl(id: string): string {
  return `${API_URL}/api/resumes/${id}/download`;
}

export async function deleteResume(id: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/resumes/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(response);
}

export async function setDefaultResume(id: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/resumes/${id}/default`, {
    method: "PUT",
    credentials: "include",
  });
  return handleResponse(response);
}