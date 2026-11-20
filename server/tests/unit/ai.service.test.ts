import { describe, it, expect } from "vitest";
import {
  analyzeResumeText,
  matchResumeToJobText,
  tailorResumeText,
  generateInterviewQuestionsText,
  evaluateAnswerText,
} from "../../src/services/ai/ai.service";
import { findSkills } from "../../src/services/ai/skills";

// These run the real mock provider AND the validation that follows it (the same path the
// API uses), so they check what a user would actually receive.

const resume = [
  "Jane Doe",
  "EXPERIENCE",
  "Software Engineer Intern, 2024 - 2025",
  "• Built a dashboard with React and TypeScript used by 200 people",
  "• Reduced API response time by 40% by adding PostgreSQL indexes",
  "• Collaborated with designers to improve the checkout flow for the web app",
  "PROJECTS",
  "• Developed a personal budgeting project using Node and Express with a REST API",
  "SKILLS",
  "React, TypeScript, Node, Express, PostgreSQL, Git",
  "EDUCATION",
  "B.E. Computer Science",
].join("\n");

const job =
  "We are hiring a frontend developer. You will build user interfaces with React and TypeScript. " +
  "Experience with Docker and AWS is a plus. You will collaborate with designers and ship features weekly.";

const resumeSkills = findSkills(resume);

describe("analyzeResumeText", () => {
  it("returns scores between 0 and 100 and the average as the overall score", async () => {
    const result = await analyzeResumeText(resume);
    const parts = [result.skillsScore, result.experienceScore, result.projectsScore, result.keywordsScore, result.atsScore];
    for (const score of [result.overallScore, ...parts]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
    expect(result.overallScore).toBe(Math.round(parts.reduce((a, b) => a + b, 0) / 5));
  });

  it("scores a rich resume above a thin one", async () => {
    const rich = await analyzeResumeText(resume);
    const thin = await analyzeResumeText("I like computers.");
    expect(rich.overallScore).toBeGreaterThan(thin.overallScore);
    expect(thin.improvements.length).toBeGreaterThan(0);
  });

  it("is deterministic: the same resume always gets the same result", async () => {
    expect(await analyzeResumeText(resume)).toEqual(await analyzeResumeText(resume));
  });

  it("does not crash on an empty resume", async () => {
    const result = await analyzeResumeText("");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });
});

describe("matchResumeToJobText", () => {
  it("splits the job's skills into matched and missing", async () => {
    const result = await matchResumeToJobText(resume, job);
    expect(result.matchedSkills.sort()).toEqual(["react", "typescript"]);
    expect(result.missingSkills.sort()).toEqual(["aws", "docker"]);
    expect(result.matchScore).toBe(50);
  });

  it("scores 100 when the resume covers every skill, and 0 when it covers none", async () => {
    expect((await matchResumeToJobText(resume, "We use React and Git.")).matchScore).toBe(100);
    expect((await matchResumeToJobText(resume, "We use Kubernetes and Docker.")).matchScore).toBe(0);
  });

  it("gives a neutral 50 when the job description names no recognised skill (nothing to compare)", async () => {
    expect((await matchResumeToJobText(resume, "Join our friendly team.")).matchScore).toBe(50);
  });
});

describe("tailorResumeText (never invent anything)", () => {
  it("only lists skills that appear in BOTH the resume and the job description", async () => {
    const result = await tailorResumeText(resume, job, "Frontend Developer");
    expect(result.skills.sort()).toEqual(["react", "typescript"]);
  });

  it("only returns bullets that are verbatim lines from the resume", async () => {
    const result = await tailorResumeText(resume, job, "Frontend Developer");
    expect(result.bullets.length).toBeGreaterThan(0);
    for (const bullet of result.bullets) {
      expect(resume).toContain(bullet);
    }
  });

  it("never mentions a skill the resume does not contain", async () => {
    const result = await tailorResumeText(resume, job, "Frontend Developer");
    const everything = [result.summary, ...result.skills, ...result.bullets].join(" ");
    for (const skill of findSkills(everything)) {
      expect(resumeSkills).toContain(skill);
    }
  });

  it("builds nothing, and says why, when the resume has none of the job's skills", async () => {
    const result = await tailorResumeText("I enjoy gardening and baking bread every weekend.", job, "Developer");
    expect(result.summary).toBe("");
    expect(result.skills).toEqual([]);
    expect(result.notes.join(" ")).toMatch(/without inventing/);
  });
});

describe("generateInterviewQuestionsText", () => {
  it("covers all five categories", async () => {
    const result = await generateInterviewQuestionsText(resume, job, "Frontend Developer", "Acme");
    const categories = new Set(result.questions.map((question) => question.category));
    expect([...categories].sort()).toEqual(["BEHAVIORAL", "HR", "PROJECT", "ROLE_SPECIFIC", "TECHNICAL"]);
  });

  it("asks a ramp-up question for a skill only the job wants, and a usage question for a shared skill", async () => {
    const { questions } = await generateInterviewQuestionsText(resume, job, "Frontend Developer", "Acme");
    const technical = questions.filter((question) => question.category === "TECHNICAL").map((question) => question.question);
    expect(technical.some((text) => /Docker/.test(text) && /get up to speed/.test(text))).toBe(true);
    expect(technical.some((text) => /React/.test(text) && /you used it/.test(text))).toBe(true);
  });

  it("builds PROJECT questions only from the person's own resume lines", async () => {
    const { questions } = await generateInterviewQuestionsText(resume, job, "Frontend Developer", "Acme");
    const project = questions.filter((question) => question.category === "PROJECT");
    expect(project.length).toBeGreaterThan(0);
    for (const question of project) {
      const quoted = question.question.match(/"(.+)"/)?.[1] ?? "";
      expect(resume).toContain(quoted);
    }
  });

  it("has no duplicate questions", async () => {
    const { questions } = await generateInterviewQuestionsText(resume, job, "Frontend Developer", "Acme");
    const texts = questions.map((question) => question.question.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("every question has an answer structure", async () => {
    const { questions } = await generateInterviewQuestionsText(resume, job, "Frontend Developer", "Acme");
    for (const question of questions) expect(question.answerStructure.length).toBeGreaterThan(0);
  });
});

describe("evaluateAnswerText", () => {
  it("returns feedback whose counts agree", async () => {
    const result = await evaluateAnswerText({
      category: "BEHAVIORAL",
      question: "Tell me about a mistake you made.",
      answer: "I broke the build once.",
      resumeText: resume,
    });
    expect(result.passedCount + result.failedChecks.length).toBe(result.totalCount);
    expect(result.failedChecks).toContain("ENOUGH_DETAIL");
  });
});