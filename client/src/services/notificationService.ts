import type { NotificationsResponse } from "../types/schedule.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

export async function getNotifications(): Promise<NotificationsResponse> {
  const response = await fetch(`${API_URL}/api/notifications`, { credentials: "include" });
  return handleResponse(response);
}

export async function snoozeFollowUp(applicationId: string): Promise<{ snoozedUntil: string }> {
  const response = await fetch(`${API_URL}/api/notifications/follow-ups/${applicationId}/snooze`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(response);
}