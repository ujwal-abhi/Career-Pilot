import { parseDateInput } from "../utils/datetime.util";

const MAX_TITLE = 200;

export function validateReminderInput(body: unknown): string | null {
  const data = (body ?? {}) as Record<string, unknown>;

  if (typeof data.title !== "string" || !data.title.trim()) {
    return "Title is required.";
  }
  if (data.title.length > MAX_TITLE) {
    return `Title must be ${MAX_TITLE} characters or fewer.`;
  }
  if (parseDateInput(data.dueAt) === null) {
    return "Choose a valid due date and time.";
  }
  if (data.applicationId !== undefined && data.applicationId !== null && typeof data.applicationId !== "string") {
    return "Invalid application.";
  }
  return null;
}

export function validateCompletedInput(body: unknown): string | null {
  const data = (body ?? {}) as Record<string, unknown>;
  return typeof data.completed === "boolean" ? null : "completed must be true or false.";
}