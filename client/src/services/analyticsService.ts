import type { AnalyticsData } from "../types/analytics.types";

const API_URL = import.meta.env.VITE_API_URL;

export async function getAnalytics(): Promise<AnalyticsData> {
  const response = await fetch(`${API_URL}/api/analytics`, {
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Could not load analytics.");
  }
  return data.data;
}