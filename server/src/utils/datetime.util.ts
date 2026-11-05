const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

// A full ISO 8601 timestamp WITH an explicit zone: "2026-10-30T09:30:00.000Z" or "...+05:30".
// A bare "2026-10-30T15:00" is rejected on purpose. Without a zone the server would have to
// guess whose clock it is, and `new Date("5")` is happily parsed as May 2001, so loose
// parsing is not safe for something people schedule interviews with.
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

export function parseDateInput(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_WITH_ZONE.test(value.trim())) return null;
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR ? date : null;
}