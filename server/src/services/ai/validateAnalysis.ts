import type { ResumeAnalysisResult, JobMatchResult } from "./providers/types";

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