import type { ResumeAnalysisResult, JobMatchResult, TailoringResult } from "./providers/types";
import { containsTerm, findSkills } from "./skills";

function clampScore(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function validateAnalysisResult(raw: Partial<ResumeAnalysisResult>): ResumeAnalysisResult {
  return {
    overallScore: clampScore(raw.overallScore),
    skillsScore: clampScore(raw.skillsScore),
    experienceScore: clampScore(raw.experienceScore),
    projectsScore: clampScore(raw.projectsScore),
    keywordsScore: clampScore(raw.keywordsScore),
    atsScore: clampScore(raw.atsScore),
    strengths: toStringArray(raw.strengths),
    improvements: toStringArray(raw.improvements),
  };
}

export function validateJobMatchResult(raw: Partial<JobMatchResult>): JobMatchResult {
  return {
    matchScore: clampScore(raw.matchScore),
    matchedSkills: toStringArray(raw.matchedSkills),
    missingSkills: toStringArray(raw.missingSkills),
    relevantExperience: toStringArray(raw.relevantExperience),
    potentialGaps: toStringArray(raw.potentialGaps),
    recommendations: toStringArray(raw.recommendations),
  };
}

// ---- Tailoring: the "never invent anything" guardrail ----

const NUMBER_PATTERN = /\d[\d,.]*%?/g;

// A piece of generated text is "grounded" if every number and every recognized
// skill it mentions also appears in the original resume text.
function isGrounded(generated: string, resumeText: string): boolean {
  const numbers = generated.match(NUMBER_PATTERN) ?? [];
  const lowerResume = resumeText.toLowerCase();
  const numbersOk = numbers.every((n) => lowerResume.includes(n.replace(/[^\d]+$/, "")));
  if (!numbersOk) return false;

  return findSkills(generated).every((skill) => containsTerm(resumeText, skill));
}

export function validateTailoringResult(
  raw: Partial<TailoringResult>,
  resumeText: string
): TailoringResult {
  const rawSkills = toStringArray(raw.skills);
  const rawBullets = toStringArray(raw.bullets);
  const rawSummary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const notes = toStringArray(raw.notes);

  const skills = rawSkills.filter((skill) => containsTerm(resumeText, skill));
  const bullets = rawBullets.filter((bullet) => isGrounded(bullet, resumeText));
  const summary = rawSummary && isGrounded(rawSummary, resumeText) ? rawSummary : "";

  const removedCount =
    rawSkills.length - skills.length +
    (rawBullets.length - bullets.length) +
    (rawSummary && !summary ? 1 : 0);

  if (removedCount > 0) {
    notes.push(
      `${removedCount} generated item(s) were removed because they mentioned skills or numbers that couldn't be found in your resume.`
    );
  }

  return { summary, skills, bullets, notes };
}