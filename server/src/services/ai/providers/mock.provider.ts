import type {
  AIProvider,
  ResumeAnalysisResult,
  JobMatchResult,
  TailoringResult,
} from "./types";
import { containsTerm, findSkills } from "../skills";

const ACTION_VERBS = [
  "led", "built", "developed", "designed", "improved", "increased",
  "reduced", "managed", "created", "implemented", "optimized", "launched",
  "achieved", "delivered", "collaborated",
];

const SECTION_HEADERS = ["experience", "education", "skills", "projects", "summary"];

// Matches a leading bullet marker (•, ●, ▪, ◦, ‣, ·, a PDF private-use bullet, -, –, —, *).
// Written as \u escapes so the file survives copy/paste without encoding surprises.
const BULLET_PREFIX = /^\s*[\u2022\u25CF\u25AA\u25E6\u2023\u00B7\uF0B7*\-\u2013\u2014]\s*/;

function countMatches(text: string, terms: string[]): number {
  return terms.filter((term) => containsTerm(text, term)).length;
}

function scaleScore(matchCount: number, maxExpected: number): number {
  const raw = Math.round((matchCount / maxExpected) * 100);
  return Math.min(100, Math.max(40, raw)); // floor of 40 so a thin resume isn't a brutal 0
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// Pulls out lines that look like resume bullet points: either they start with a
// bullet marker, or they start with an action verb. Lines are returned exactly as
// written in the resume (minus the bullet marker) — never reworded.
function extractBullets(resumeText: string): string[] {
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

export class MockAIProvider implements AIProvider {
  async analyzeResume(resumeText: string): Promise<ResumeAnalysisResult> {
    const skillMatches = findSkills(resumeText).length;
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

  async matchResumeToJob(resumeText: string, jobDescription: string): Promise<JobMatchResult> {
    const jobSkills = findSkills(jobDescription);
    const resumeSkills = findSkills(resumeText);

    const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
    const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));

    const matchScore =
      jobSkills.length > 0
        ? Math.round((matchedSkills.length / jobSkills.length) * 100)
        : 50; // the job description didn't mention any skill we recognize — can't meaningfully score overlap

    const relevantExperience: string[] = [];
    const potentialGaps: string[] = [];
    const recommendations: string[] = [];

    if (matchedSkills.length > 0) {
      relevantExperience.push(
        `Your resume shows experience with ${matchedSkills.slice(0, 5).join(", ")}, which this role asks for.`
      );
    } else {
      relevantExperience.push(
        "No direct skill keyword overlap was detected between your resume and this job description."
      );
    }

    if (missingSkills.length > 0) {
      potentialGaps.push(
        `This role mentions ${missingSkills.join(", ")}, which weren't found in your resume.`
      );
      recommendations.push(
        `Consider adding or highlighting experience with: ${missingSkills.join(", ")}.`
      );
    } else if (jobSkills.length > 0) {
      recommendations.push("Your resume already covers every specific skill this job description mentions.");
    }

    if (matchScore < 50) {
      recommendations.push(
        "This may be a stretch role based on keyword overlap alone — use your own judgment alongside this score."
      );
    }

    return {
      matchScore,
      matchedSkills,
      missingSkills,
      relevantExperience,
      potentialGaps,
      recommendations,
    };
  }

  async tailorResume(
    resumeText: string,
    jobDescription: string,
    targetPosition: string
  ): Promise<TailoringResult> {
    const jobSkills = findSkills(jobDescription);
    const resumeSkills = findSkills(resumeText);

    // Only skills present in BOTH the resume and the job description.
    const skills = jobSkills.filter((skill) => resumeSkills.includes(skill));

    const notes: string[] = [];

    let summary = "";
    if (skills.length > 0) {
      summary = `Seeking a ${targetPosition} role, bringing skills in ${formatList(skills.slice(0, 5))}.`;
    } else {
      notes.push(
        "No skills from this job description were found in your resume, so no summary or skills list could be built without inventing something."
      );
    }

    // Existing resume lines, ranked by how many of the job's skills they mention.
    const bullets = extractBullets(resumeText)
      .map((text) => ({
        text,
        score: findSkills(text).filter((skill) => jobSkills.includes(skill)).length,
      }))
      .filter((bullet) => bullet.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((bullet) => bullet.text);

    if (bullets.length === 0 && skills.length > 0) {
      notes.push(
        "None of your bullet points mention skills from this job description (or your PDF's bullet lines couldn't be detected — wrapped or unusually formatted lines can hide them)."
      );
    }

    return { summary, skills, bullets, notes };
  }
}