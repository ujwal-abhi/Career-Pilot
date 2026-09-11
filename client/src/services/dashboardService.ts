import type { DashboardStats } from "../types/application.types";

const API_URL = import.meta.env.VITE_API_URL;

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetch(`${API_URL}/api/dashboard`, {
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Could not load dashboard data.");
  }
  return data.data;
}