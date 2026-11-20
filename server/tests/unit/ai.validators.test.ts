import { describe, it, expect } from "vitest";
import {
  validateAnalysisResult,
  validateJobMatchResult,
  validateTailoringResult,
  validateInterviewResult,
  validateFeedbackResult,
} from "../../src/services/ai/validateAnalysis";
import { CHECK_LABELS } from "../../src/services/ai/answerEvaluation";

// These validators sit between the AI provider and the database. Today the provider is a
// rule-based mock; when a real model replaces it, a model can return anything. So every
// test here feeds in bad or dishonest output and checks that it is cleaned up or removed.

describe("validateAnalysisResult / validateJobMatchResult", () => {
  it("clamps scores into 0-100 and rounds them", () => {
    const result = validateAnalysisResult({ overallScore: 250, skillsScore: -20, atsScore: 72.6 });
    expect(result.overallScore).toBe(100);
    expect(result.skillsScore).toBe(0);
    expect(result.atsScore).toBe(73);
  });

  it("turns missing, NaN or non-numeric scores into 0 instead of storing garbage", () => {
    const result = validateAnalysisResult({ overallScore: NaN, skillsScore: "abc" as unknown as number });
    expect(result.overallScore).toBe(0);
    expect(result.skillsScore).toBe(0);
    expect(result.projectsScore).toBe(0);
  });

  it("accepts a numeric string and keeps only strings in the lists", () => {
    const result = validateAnalysisResult({
      overallScore: "80" as unknown as number,
      strengths: ["Good", 5, null, "Also good"] as unknown as string[],
      improvements: "not an array" as unknown as string[],
    });
    expect(result.overallScore).toBe(80);
    expect(result.strengths).toEqual(["Good", "Also good"]);
    expect(result.improvements).toEqual([]);
  });

  it("applies the same cleaning to job match results", () => {
    const result = validateJobMatchResult({ matchScore: 140, matchedSkills: ["react", 3] as unknown as string[] });
    expect(result.matchScore).toBe(100);
    expect(result.matchedSkills).toEqual(["react"]);
    expect(result.missingSkills).toEqual([]);
  });
});

describe("validateTailoringResult (never invent anything)", () => {
  const resume = "Built dashboards with React and TypeScript. Improved load time by 40% for 200 users.";

  it("keeps skills, bullets and a summary that are fully backed by the resume", () => {
    const result = validateTailoringResult(
      {
        summary: "Developer with React and TypeScript experience.",
        skills: ["react", "typescript"],
        bullets: ["Improved load time by 40% for 200 users."],
        notes: [],
      },
      resume
    );
    expect(result.skills).toEqual(["react", "typescript"]);
    expect(result.bullets).toHaveLength(1);
    expect(result.summary).not.toBe("");
    expect(result.notes).toEqual([]);
  });

  it("removes a skill that is not on the resume", () => {
    const result = validateTailoringResult({ skills: ["react", "kubernetes"], bullets: [], summary: "", notes: [] }, resume);
    expect(result.skills).toEqual(["react"]);
  });

  it("removes a bullet that invents a number", () => {
    const result = validateTailoringResult(
      { skills: [], bullets: ["Improved load time by 90%.", "Improved load time by 40% for 200 users."], summary: "", notes: [] },
      resume
    );
    expect(result.bullets).toEqual(["Improved load time by 40% for 200 users."]);
  });

  it("removes a bullet that mentions a skill the resume does not have", () => {
    const result = validateTailoringResult(
      { skills: [], bullets: ["Deployed services on AWS with Docker."], summary: "", notes: [] },
      resume
    );
    expect(result.bullets).toEqual([]);
  });

  it("blanks an ungrounded summary", () => {
    const result = validateTailoringResult({ skills: [], bullets: [], summary: "Expert in Kubernetes and Python.", notes: [] }, resume);
    expect(result.summary).toBe("");
  });

  it("tells the user how many items were removed", () => {
    const result = validateTailoringResult(
      { skills: ["react", "docker"], bullets: ["Used AWS daily."], summary: "Expert in Python.", notes: [] },
      resume
    );
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatch(/^3 generated item\(s\) were removed/);
  });

  it("does not let java stand in for javascript (whole-word matching)", () => {
    const result = validateTailoringResult({ skills: ["java"], bullets: [], summary: "", notes: [] }, "I write JavaScript.");
    expect(result.skills).toEqual([]);
  });
});

describe("validateInterviewResult", () => {
  const resume = "Built a React app with TypeScript.";
  const job = "We use Docker and PostgreSQL.";
  const context = "Frontend Developer Acme";
  const valid = (overrides: object = {}) => ({
    category: "TECHNICAL",
    question: "How have you used React?",
    answerStructure: "Explain your approach.",
    ...overrides,
  });
  const run = (questions: unknown[], notes: string[] = []) =>
    validateInterviewResult({ questions: questions as never, notes }, resume, job, context);

  it("keeps well-formed questions", () => {
    expect(run([valid()]).questions).toHaveLength(1);
  });

  it("drops an unknown category, an empty question and an over-long question", () => {
    const result = run([
      valid({ category: "TRICK" }),
      valid({ question: "   " }),
      valid({ question: "x".repeat(601) }),
      valid({ answerStructure: "" }),
      null,
      "a string",
    ]);
    expect(result.questions).toEqual([]);
    expect(result.notes[0]).toMatch(/^6 generated question\(s\) were removed/);
  });

  it("drops a question about a skill found in neither the resume nor the job description", () => {
    expect(run([valid({ question: "Tell me about your Kubernetes experience." })]).questions).toEqual([]);
  });

  it("allows a non-project question about a skill that only the job description mentions", () => {
    expect(run([valid({ question: "How would you get up to speed on Docker?" })]).questions).toHaveLength(1);
  });

  it("requires a PROJECT question's skills to be on the RESUME, since it presumes you did the work", () => {
    const result = run([valid({ category: "PROJECT", question: "Tell me about the Docker setup you built." })]);
    expect(result.questions).toEqual([]);
  });

  it("drops duplicates quietly (case-insensitive) and caps the list at 25", () => {
    const duplicates = run([valid(), valid({ question: "HOW HAVE YOU USED REACT?" })]);
    expect(duplicates.questions).toHaveLength(1);
    expect(duplicates.notes).toEqual([]);

    const many = run(Array.from({ length: 40 }, (_, i) => valid({ question: `Question number ${i}?` })));
    expect(many.questions).toHaveLength(25);
  });

  it("treats a missing questions array as empty", () => {
    expect(validateInterviewResult({}, resume, job, context).questions).toEqual([]);
  });
});

describe("validateFeedbackResult", () => {
  it("keeps only known check keys, without duplicates", () => {
    const result = validateFeedbackResult({
      failedChecks: ["FIRST_PERSON", "FIRST_PERSON", "MADE_UP_CHECK", 7 as unknown as string],
      totalCount: 6,
    });
    expect(result.failedChecks).toEqual(["FIRST_PERSON"]);
  });

  it("derives passedCount itself instead of trusting the provider", () => {
    const result = validateFeedbackResult({ failedChecks: ["SPECIFICS", "CONCISE"], totalCount: 6, passedCount: 99 });
    expect(result.passedCount).toBe(4);
    expect(result.totalCount).toBe(6);
  });

  it("never lets totalCount be smaller than the number of failed checks, or below 1, or above 20", () => {
    expect(validateFeedbackResult({ failedChecks: ["SPECIFICS", "CONCISE"], totalCount: 1 }).totalCount).toBe(2);
    expect(validateFeedbackResult({ totalCount: 0 }).totalCount).toBe(1);
    expect(validateFeedbackResult({ totalCount: 500 }).totalCount).toBe(20);
  });

  it("trims feedback text, drops empty or over-long items, and keeps at most 8", () => {
    const result = validateFeedbackResult({
      strengths: ["  Good  ", "", "x".repeat(501)],
      improvements: Array.from({ length: 12 }, (_, i) => `Tip ${i}`),
    });
    expect(result.strengths).toEqual(["Good"]);
    expect(result.improvements).toHaveLength(8);
  });

  it("only accepts check keys that exist in CHECK_LABELS", () => {
    const keys = Object.keys(CHECK_LABELS);
    expect(validateFeedbackResult({ failedChecks: keys, totalCount: keys.length }).failedChecks).toEqual(keys);
  });
});