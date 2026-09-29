import type { AIProvider, ResumeAnalysisResult } from "./types";

const SKILL_KEYWORDS = [
  "javascript", "typescript", "react", "node", "express", "python", "java",
  "sql", "postgresql", "mongodb", "aws", "docker", "kubernetes", "git",
  "html", "css", "tailwind", "next.js", "rest api", "graphql", "ci/cd",
];

const ACTION_VERBS = [
  "led", "built", "developed", "designed", "improved", "increased",
  "reduced", "managed", "created", "implemented", "optimized", "launched",
  "achieved", "delivered", "collaborated",
];

const SECTION_HEADERS = ["experience", "education", "skills", "projects", "summary"];

function countMatches(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term)).length;
}

function scaleScore(matchCount: number, maxExpected: number): number {
  const raw = Math.round((matchCount / maxExpected) * 100);
  return Math.min(100, Math.max(40, raw)); // floor of 40 so a thin resume isn't a brutal 0
}

export class MockAIProvider implements AIProvider {
  async analyzeResume(resumeText: string): Promise<ResumeAnalysisResult> {
    const skillMatches = countMatches(resumeText, SKILL_KEYWORDS);
    const keywordMatches = countMatches(resumeText, ACTION_VERBS);
    const sectionMatches = countMatches(resumeText, SECTION_HEADERS);
    const hasYearRange = /20\d{2}/.test(resumeText);
    const hasProjectMention = /project/i.test(resumeText);
    const wordCount = resumeText.trim().split(/\s+/).length;

    const skillsScore = scaleScore(skillMatches, 8);
    const keywordsScore = scaleScore(keywordMatches, 6);
    const experienceScore = scaleScore(
      (hasYearRange ? 1 : 0) + countMatches(resumeText, ["experience", "worked", "internship"]),
      3
    );
    const projectsScore = hasProjectMention
      ? scaleScore(countMatches(resumeText, ["project"]) + 1, 2)
      : 40;
    const atsScore = scaleScore(
      sectionMatches + (wordCount > 150 && wordCount < 1200 ? 1 : 0),
      6
    );

    const overallScore = Math.round(
      (skillsScore + experienceScore + projectsScore + keywordsScore + atsScore) / 5
    );

    const strengths: string[] = [];
    const improvements: string[] = [];

    if (skillsScore >= 70) strengths.push("Strong presence of relevant technical skills.");
    else improvements.push("Consider explicitly listing more relevant technical skills.");

    if (keywordsScore >= 70) strengths.push("Good use of strong action verbs describing your work.");
    else improvements.push('Try starting bullet points with action verbs like "built", "led", or "improved".');

    if (hasYearRange) strengths.push("Clear timeline of experience with dates.");
    else improvements.push("Add clear date ranges for your work experience.");

    if (atsScore >= 70) strengths.push("Resume structure includes standard sections, which helps ATS parsing.");
    else improvements.push("Add clearly labeled sections (Experience, Education, Skills, Projects) to improve ATS readability.");

    return {
      overallScore,
      skillsScore,
      experienceScore,
      projectsScore,
      keywordsScore,
      atsScore,
      strengths,
      improvements,
    };
  }
}