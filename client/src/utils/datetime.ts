// Interviews and reminders are stored on the server as exact moments in time (UTC).
// The browser is the only place that knows the person's time zone, so ALL conversion
// between "what the person typed" and "the stored moment" happens here.

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// ISO moment -> the value an <input type="datetime-local"> wants, in the person's local time.
// Example, in India (UTC+5:30): "2026-12-01T09:30:00.000Z" -> "2026-12-01T15:00".
export function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// What the person typed (local time, no zone) -> an exact UTC moment to send to the server.
// A "YYYY-MM-DDTHH:mm" string with no zone is defined to mean LOCAL time, so this is
// correct wherever the person is. Returns null if the field is empty or invalid.
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// A sensible default for a new form: the next full hour, some hours from now.
export function defaultLocalInputValue(hoursAhead: number, now: Date = new Date()): string {
  const date = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return toLocalInputValue(date.toISOString());
}

// "Mon, Dec 1, 3:00 PM", in the person's own locale and time zone.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "in 3 hours", "yesterday", "2 days ago".
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const minutes = diffMs / 60_000;
  if (Math.abs(minutes) < 1) return "now";
  if (Math.abs(minutes) < 60) return relativeFormat.format(Math.round(minutes), "minute");
  const hours = minutes / 60;
  if (Math.abs(hours) < 48) return relativeFormat.format(Math.round(hours), "hour");
  return relativeFormat.format(Math.round(hours / 24), "day");
}