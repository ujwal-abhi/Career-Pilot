const VALID_STATUSES = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

interface ApplicationInput {
  company?: string;
  position?: string;
  status?: string;
}

export function validateApplicationInput(data: ApplicationInput): string | null {
  if (!data.company || !data.company.trim()) {
    return "Company is required.";
  }
  if (!data.position || !data.position.trim()) {
    return "Position is required.";
  }
  if (data.status && !VALID_STATUSES.includes(data.status)) {
    return "Invalid status value.";
  }
  return null;
}