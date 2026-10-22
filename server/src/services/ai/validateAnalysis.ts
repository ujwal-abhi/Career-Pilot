import type {
  ResumeAnalysisResult,
  JobMatchResult,
  TailoringResult,
  InterviewQuestionsResult,
  InterviewQuestionItem,
  QuestionCategory,
  AnswerFeedbackResult,
} from "./providers/types";
import { containsTerm, findSkills } from "./skills";
import { CHECK_LABELS } from "./answerEvaluation";

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

// ---- Interview questions ----

const VALID_CATEGORIES: QuestionCategory[] = [
  "HR",
  "TECHNICAL",
  "BEHAVIORAL",
  "PROJECT",
  "ROLE_SPECIFIC",
];
const MAX_QUESTIONS = 25;
const MAX_TEXT_LENGTH = 600;

export function validateInterviewResult(
  raw: Partial<InterviewQuestionsResult>,
  resumeText: string,
  jobDescription: string,
  context: string // the position and company the user typed in
): InterviewQuestionsResult {
  const allowedText = `${resumeText}\n${jobDescription}\n${context}`;
  const rawQuestions: unknown[] = Array.isArray(raw.questions) ? raw.questions : [];

  const seen = new Set<string>();
  const questions: InterviewQuestionItem[] = [];
  let removed = 0;

  for (const item of rawQuestions) {
    if (typeof item !== "object" || item === null) {
      removed += 1;
      continue;
    }

    const candidate = item as Partial<InterviewQuestionItem>;
    const category = candidate.category;
    const question = typeof candidate.question === "string" ? candidate.question.trim() : "";
    const answerStructure =
      typeof candidate.answerStructure === "string" ? candidate.answerStructure.trim() : "";

    if (category === undefined || !VALID_CATEGORIES.includes(category)) {
      removed += 1;
      continue;
    }
    if (
      question.length === 0 ||
      question.length > MAX_TEXT_LENGTH ||
      answerStructure.length === 0 ||
      answerStructure.length > MAX_TEXT_LENGTH
    ) {
      removed += 1;
      continue;
    }

    // A PROJECT question presumes you did the work, so its skills must be in the RESUME.
    // Other questions may also mention skills that only appear in the job description.
    const sourceText = category === "PROJECT" ? resumeText : allowedText;
    const isGroundedQuestion = findSkills(question).every((skill) =>
      containsTerm(sourceText, skill)
    );
    if (!isGroundedQuestion) {
      removed += 1;
      continue;
    }

    const key = question.toLowerCase();
    if (seen.has(key)) continue; // exact duplicates are dropped quietly
    seen.add(key);

    questions.push({ category, question, answerStructure });
    if (questions.length >= MAX_QUESTIONS) break;
  }

  const notes = toStringArray(raw.notes);
  if (removed > 0) {
    notes.push(
      `${removed} generated question(s) were removed because they were malformed or mentioned skills not found in your resume or the job description.`
    );
  }

  return { questions, notes };
}

// ---- Practice feedback ----

const MAX_FEEDBACK_ITEMS = 8;
const MAX_FEEDBACK_ITEM_LENGTH = 500;
const MAX_TOTAL_CHECKS = 20;

function cleanFeedbackStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= MAX_FEEDBACK_ITEM_LENGTH)
    .slice(0, MAX_FEEDBACK_ITEMS);
}

export function validateFeedbackResult(raw: Partial<AnswerFeedbackResult>): AnswerFeedbackResult {
  // Only known check keys survive, so weak-area counting never sees junk.
  const failedChecks = Array.from(
    new Set(
      (Array.isArray(raw.failedChecks) ? raw.failedChecks : []).filter(
        (key): key is string => typeof key === "string" && key in CHECK_LABELS
      )
    )
  );

  const rawTotal = typeof raw.totalCount === "number" ? Math.round(raw.totalCount) : 0;
  const totalCount = Math.min(MAX_TOTAL_CHECKS, Math.max(rawTotal, failedChecks.length, 1));

  return {
    strengths: cleanFeedbackStrings(raw.strengths),
    improvements: cleanFeedbackStrings(raw.improvements),
    failedChecks,
    // Derived, never trusted from the provider, so the numbers always agree.
    passedCount: totalCount - failedChecks.length,
    totalCount,
    notes: cleanFeedbackStrings(raw.notes),
  };
}