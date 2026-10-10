export const ACTION_VERBS = [
  "led", "built", "developed", "designed", "improved", "increased",
  "reduced", "managed", "created", "implemented", "optimized", "launched",
  "achieved", "delivered", "collaborated",
];

// Matches a leading bullet marker (bullet dots, dashes, asterisks, a PDF private-use bullet).
// Written as \u escapes so the file survives copy/paste without encoding surprises.
const BULLET_PREFIX = /^\s*[\u2022\u25CF\u25AA\u25E6\u2023\u00B7\uF0B7*\-\u2013\u2014]\s*/;

// Pulls out lines that look like resume bullet points: either they start with a
// bullet marker, or they start with an action verb. Lines are returned exactly as
// written in the resume (minus the bullet marker), never reworded.
export function extractBullets(resumeText: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const rawLine of resumeText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const hasBulletMarker = BULLET_PREFIX.test(line);
    const cleaned = line.replace(BULLET_PREFIX, "").trim();
    const words = cleaned.split(/\s+/);
    const firstWord = words[0]?.toLowerCase() ?? "";

    if (words.length < 5 || words.length > 45) continue;
    if (!hasBulletMarker && !ACTION_VERBS.includes(firstWord)) continue;
    if (seen.has(cleaned)) continue;

    seen.add(cleaned);
    results.push(cleaned);
  }

  return results;
}

// Splits prose (like a job description) into sentence-like pieces, one per sentence or line.
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((piece) => piece.replace(BULLET_PREFIX, "").trim())
    .filter((piece) => piece.length > 0);
}