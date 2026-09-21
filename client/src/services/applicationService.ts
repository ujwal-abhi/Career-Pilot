import type { Application, ApplicationInput } from "../types/application.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

export async function getApplications(): Promise<{ applications: Application[] }> {
  const response = await fetch(`${API_URL}/api/applications`, {
    credentials: "include",
  });
  return handleResponse(response);
}

export async function createApplication(
  input: ApplicationInput
): Promise<{ application: Application }> {
  const response = await fetch(`${API_URL}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  return handleResponse(response);
}

export async function updateApplication(
  id: string,
  input: ApplicationInput
): Promise<{ application: Application }> {
  const response = await fetch(`${API_URL}/api/applications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  return handleResponse(response);
}

export async function deleteApplication(id: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/applications/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(response);
}