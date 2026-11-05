import { parseDateInput } from "../utils/datetime.util";

const VALID_FORMATS = ["PHONE", "VIDEO", "ONSITE"];
const MAX_TITLE = 120;
const MAX_LOCATION = 300;
const MAX_NOTES = 2000;

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return `${label} must be text.`;
  if (value.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

export function validateInterviewInput(
  body: unknown,
  options: { requireApplication: boolean }
): string | null {
  const data = (body ?? {}) as Record<string, unknown>;

  if (options.requireApplication) {
    if (typeof data.applicationId !== "string" || !data.applicationId.trim()) {
      return "Choose which application this interview is for.";
    }
  }
  if (typeof data.title !== "string" || !data.title.trim()) {
    return "Title is required (for example, \"Technical round 1\").";
  }
  if (data.title.length > MAX_TITLE) {
    return `Title must be ${MAX_TITLE} characters or fewer.`;
  }
  if (data.format !== undefined && (typeof data.format !== "string" || !VALID_FORMATS.includes(data.format))) {
    return "Invalid interview format.";
  }
  if (parseDateInput(data.scheduledAt) === null) {
    return "Choose a valid date and time for the interview.";
  }
  return (
    optionalText(data.location, MAX_LOCATION, "Location") ??
    optionalText(data.notes, MAX_NOTES, "Notes")
  );
}