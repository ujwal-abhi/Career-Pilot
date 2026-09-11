import type { AuthResponse } from "../types/auth.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse(response: Response): Promise<AuthResponse> {
  const data: AuthResponse = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
}

export async function register(email: string, password: string, name: string) {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, name }),
  });
  return handleResponse(response);
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
}

export async function logout() {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(response);
}

export async function getMe() {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    credentials: "include",
  });
  return handleResponse(response);
}