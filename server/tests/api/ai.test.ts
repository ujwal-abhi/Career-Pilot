import { describe, it, expect, beforeAll } from "vitest";
import prisma from "../../src/config/db";
import { api } from "../helpers/api";
import { createUser, useCleanDatabase, type TestUser } from "../helpers/db";
import { createApplicationRow, createResumeRow, RESUME_TEXT } from "../helpers/factories";

useCleanDatabase();

let user: TestUser;
let resume: { id: string };
let application: { id: string };
let emptyResume: { id: string };
let noJobApplication: { id: string };

beforeAll(async () => {
  user = await createUser("ai");
  resume = await createResumeRow(user.id, { isDefault: true });
  application = await createApplicationRow(user.id, { company: "Acme", position: "Frontend Developer" });
  emptyResume = await createResumeRow(user.id, { extractedText: null, fileName: "scanned.pdf" });
  noJobApplication = await createApplicationRow(user.id, { company: "NoJob", jobDescription: null });
});

const post = (url: string, body?: object) => api().post(url).set("Cookie", user.cookie).send(body ?? {});
const get = (url: string) => api().get(url).set("Cookie", user.cookie);

describe("resume analysis", () => {
  it("returns no analysis before one is run", async () => {
    const res = await get(`/api/ai/resume-analysis/${resume.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.analysis).toBeNull();
  });

  it("creates a stored analysis with sensible scores", async () => {
    const res = await post(`/api/ai/resume-analysis/${resume.id}`);
    expect(res.status).toBe(201);
    const analysis = res.body.data.analysis;
    for (const key of ["overallScore", "skillsScore", "experienceScore", "projectsScore", "keywordsScore", "atsScore"]) {
      expect(analysis[key]).toBeGreaterThanOrEqual(0);
      expect(analysis[key]).toBeLessThanOrEqual(100);
    }
    expect(Array.isArray(analysis.strengths)).toBe(true);
    expect(await prisma.resumeAnalysis.count({ where: { resumeId: resume.id } })).toBe(1);
  });

  it("GET returns the LATEST analysis after several runs", async () => {
    await post(`/api/ai/resume-analysis/${resume.id}`);
    const second = await post(`/api/ai/resume-analysis/${resume.id}`);
    const latest = await get(`/api/ai/resume-analysis/${resume.id}`);
    expect(latest.body.data.analysis.id).toBe(second.body.data.analysis.id);
  });

  it("explains when a resume has no text to analyse", async () => {
    const res = await post(`/api/ai/resume-analysis/${emptyResume.id}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no extracted text/);
  });

  it("returns 404 for an unknown resume", async () => {
    expect((await post("/api/ai/resume-analysis/nope")).status).toBe(404);
  });
});

describe("job match", () => {
  it("lists the resumes and the applications that have a job description", async () => {
    const res = await get("/api/ai/job-match/options");
    expect(res.status).toBe(200);
    expect(res.body.data.resumes).toHaveLength(2);
    const applicationIds = res.body.data.applications.map((item: { id: string }) => item.id);
    expect(applicationIds).toContain(application.id);
    expect(applicationIds).not.toContain(noJobApplication.id);
  });

  it("matches the resume's skills against the job's", async () => {
    const res = await post("/api/ai/job-match", { resumeId: resume.id, applicationId: application.id });
    expect(res.status).toBe(201);
    expect(res.body.data.match.matchedSkills.sort()).toEqual(["react", "typescript"]);
    expect(res.body.data.match.missingSkills.sort()).toEqual(["aws", "docker"]);
    expect(res.body.data.match.matchScore).toBe(50);
  });

  it("GET returns the saved match", async () => {
    const res = await get(`/api/ai/job-match/${resume.id}/${application.id}`);
    expect(res.body.data.match.matchScore).toBe(50);
  });

  it.each([
    ["no ids", {}],
    ["only a resume", { resumeId: "x" }],
  ])("returns 400 for %s", async (_label, body) => {
    expect((await post("/api/ai/job-match", body)).status).toBe(400);
  });

  it("explains a missing job description and a resume with no text", async () => {
    const noJob = await post("/api/ai/job-match", { resumeId: resume.id, applicationId: noJobApplication.id });
    expect(noJob.status).toBe(400);
    expect(noJob.body.message).toMatch(/no job description/);

    const noText = await post("/api/ai/job-match", { resumeId: emptyResume.id, applicationId: application.id });
    expect(noText.status).toBe(400);
    expect(noText.body.message).toMatch(/no extracted text/);
  });
});

describe("resume tailoring", () => {
  it("only uses skills and lines that are really in the resume", async () => {
    const res = await post("/api/ai/resume-tailor", { resumeId: resume.id, applicationId: application.id });
    expect(res.status).toBe(201);
    const { tailoring } = res.body.data;
    expect(tailoring.skills.sort()).toEqual(["react", "typescript"]);
    expect(tailoring.bullets.length).toBeGreaterThan(0);
    for (const bullet of tailoring.bullets) expect(RESUME_TEXT).toContain(bullet);
    expect(tailoring.summary).not.toMatch(/docker|aws/i); // wanted by the job, absent from the resume
  });

  it("GET returns it back", async () => {
    const res = await get(`/api/ai/resume-tailor/${resume.id}/${application.id}`);
    expect(res.body.data.tailoring.skills).toHaveLength(2);
  });

  it("explains a missing job description", async () => {
    const res = await post("/api/ai/resume-tailor", { resumeId: resume.id, applicationId: noJobApplication.id });
    expect(res.status).toBe(400);
  });
});

describe("interview preparation and practice", () => {
  let questions: { id: string; category: string; question: string }[];

  it("generates a stored set of questions in the five categories, in a stable order", async () => {
    const res = await post("/api/ai/interview-questions", { resumeId: resume.id, applicationId: application.id });
    expect(res.status).toBe(201);
    questions = res.body.data.interviewSet.questions;
    expect(new Set(questions.map((question) => question.category))).toEqual(
      new Set(["HR", "TECHNICAL", "BEHAVIORAL", "PROJECT", "ROLE_SPECIFIC"])
    );
    const orders = res.body.data.interviewSet.questions.map((question: { sortOrder: number }) => question.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("GET returns the latest set", async () => {
    const res = await get(`/api/ai/interview-questions/${resume.id}/${application.id}`);
    expect(res.body.data.interviewSet.questions).toHaveLength(questions.length);
  });

  it("checks an answer, stores the attempt, and its counts agree", async () => {
    const behavioural = questions.find((question) => question.category === "BEHAVIORAL")!;
    const res = await post("/api/ai/practice/attempts", { questionId: behavioural.id, answer: "I fixed it." });
    expect(res.status).toBe(201);
    const { attempt } = res.body.data;
    expect(attempt.failedChecks).toContain("ENOUGH_DETAIL");
    expect(attempt.passedCount + attempt.failedChecks.length).toBe(attempt.totalCount);
    expect(attempt.wordCount).toBe(3);
  });

  it("lists attempts newest first", async () => {
    const behavioural = questions.find((question) => question.category === "BEHAVIORAL")!;
    await post("/api/ai/practice/attempts", { questionId: behavioural.id, answer: "I fixed it again, with more detail this time." });
    const res = await get(`/api/ai/practice/questions/${behavioural.id}/attempts`);
    expect(res.body.data.attempts).toHaveLength(2);
    expect(res.body.data.attempts[0].answer).toMatch(/again/);
  });

  it("rejects an empty answer, an over-long answer and an unknown question", async () => {
    const technical = questions.find((question) => question.category === "TECHNICAL")!;
    const empty = await post("/api/ai/practice/attempts", { questionId: technical.id, answer: "   " });
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe("Please write an answer first.");

    const long = await post("/api/ai/practice/attempts", { questionId: technical.id, answer: "x".repeat(5001) });
    expect(long.status).toBe(400);
    expect(long.body.message).toMatch(/too long/);

    expect((await post("/api/ai/practice/attempts", { questionId: "nope", answer: "I did a thing." })).status).toBe(404);
    expect((await post("/api/ai/practice/attempts", { answer: "no question id" })).status).toBe(400);
  });

  it("reports a weak area only when the same check is missed on 3+ different questions of a category", async () => {
    const empty = await createUser("weak");
    const weakResume = await createResumeRow(empty.id);
    const weakApplication = await createApplicationRow(empty.id);
    const set = await api()
      .post("/api/ai/interview-questions")
      .set("Cookie", empty.cookie)
      .send({ resumeId: weakResume.id, applicationId: weakApplication.id });
    const behavioural = (set.body.data.interviewSet.questions as { id: string; category: string }[]).filter(
      (question) => question.category === "BEHAVIORAL"
    );
    expect(behavioural.length).toBeGreaterThanOrEqual(3);

    const answer = (index: number) => api().post("/api/ai/practice/attempts").set("Cookie", empty.cookie).send({ questionId: behavioural[index].id, answer: "I did it." });
    const weakAreas = () => api().get("/api/ai/practice/weak-areas").set("Cookie", empty.cookie);

    await answer(0);
    await answer(1);
    expect((await weakAreas()).body.data.weakAreas.weakChecks).toEqual([]); // two questions are not enough evidence

    await answer(2);
    const result = (await weakAreas()).body.data.weakAreas;
    expect(result.questionsPracticed).toBe(3);
    const enoughDetail = result.weakChecks.find((weak: { checkKey: string }) => weak.checkKey === "ENOUGH_DETAIL");
    expect(enoughDetail).toMatchObject({ category: "BEHAVIORAL", missed: 3, outOf: 3, label: "Enough detail" });
  });

  it("counts only the LATEST attempt per question, so improving an answer removes the weakness", async () => {
    const fresh = await createUser("retry");
    const freshResume = await createResumeRow(fresh.id);
    const freshApplication = await createApplicationRow(fresh.id);
    const set = await api().post("/api/ai/interview-questions").set("Cookie", fresh.cookie).send({ resumeId: freshResume.id, applicationId: freshApplication.id });
    const behavioural = (set.body.data.interviewSet.questions as { id: string; category: string }[]).filter((question) => question.category === "BEHAVIORAL");

    const send = (id: string, text: string) => api().post("/api/ai/practice/attempts").set("Cookie", fresh.cookie).send({ questionId: id, answer: text });
    const good =
      "When our team had a tight deadline last month, I was responsible for the checkout page. I decided to split the work, " +
      "wrote the tests first and fixed the slow query using React and 3 profiling runs. As a result the page loaded 40% faster " +
      "and I learned to measure before optimizing, which I now do on every project I join.";

    for (let i = 0; i < 3; i++) await send(behavioural[i].id, "I did it.");
    const before = (await api().get("/api/ai/practice/weak-areas").set("Cookie", fresh.cookie)).body.data.weakAreas;
    expect(before.weakChecks.some((weak: { checkKey: string }) => weak.checkKey === "ENOUGH_DETAIL")).toBe(true);

    await send(behavioural[0].id, good);
    await send(behavioural[1].id, good);
    const after = (await api().get("/api/ai/practice/weak-areas").set("Cookie", fresh.cookie)).body.data.weakAreas;
    expect(after.weakChecks.some((weak: { checkKey: string }) => weak.checkKey === "ENOUGH_DETAIL")).toBe(false);
    expect(after.questionsPracticed).toBe(3);
  });
});