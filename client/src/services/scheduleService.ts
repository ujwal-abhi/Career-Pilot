import type {
  Interview,
  InterviewInput,
  Reminder,
  ReminderInput,
} from "../types/schedule.types";

const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data.data;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// ---- Interviews ----

export async function getInterviews(): Promise<{ interviews: Interview[] }> {
  const response = await fetch(`${API_URL}/api/interviews`, { credentials: "include" });
  return handleResponse(response);
}

export async function createInterview(input: InterviewInput): Promise<{ interview: Interview }> {
  const response = await fetch(`${API_URL}/api/interviews`, {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(input),
  });
  return handleResponse(response);
}

// The application an interview belongs to cannot be changed, so it is not sent.
export async function updateInterview(
  id: string,
  input: Omit<InterviewInput, "applicationId">
): Promise<{ interview: Interview }> {
  const response = await fetch(`${API_URL}/api/interviews/${id}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(input),
  });
  return handleResponse(response);
}

export async function deleteInterview(id: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/interviews/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(response);
}

// ---- Reminders ----

export async function getReminders(): Promise<{ reminders: Reminder[] }> {
  const response = await fetch(`${API_URL}/api/reminders`, { credentials: "include" });
  return handleResponse(response);
}

export async function createReminder(input: ReminderInput): Promise<{ reminder: Reminder }> {
  const response = await fetch(`${API_URL}/api/reminders`, {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(input),
  });
  return handleResponse(response);
}

export async function setReminderCompleted(
  id: string,
  completed: boolean
): Promise<{ reminder: Reminder }> {
  const response = await fetch(`${API_URL}/api/reminders/${id}/completed`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ completed }),
  });
  return handleResponse(response);
}

export async function deleteReminder(id: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/reminders/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(response);
}