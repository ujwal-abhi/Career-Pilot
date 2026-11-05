// Turn free text into a safe link, or null. Only http(s) is allowed: a location typed as
// "javascript:alert(1)" must never become a clickable link.
export function asHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}