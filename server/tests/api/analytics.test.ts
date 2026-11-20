import { describe, it, expect } from "vitest";
import prisma from "../../src/config/db";
import { api } from "../helpers/api";
import { createUser, daysFromNow, useCleanDatabase } from "../helpers/db";
import { createApplicationRow, createResumeRow } from "../helpers/factories";

useCleanDatabase();

const get = (cookie: string) => api().get("/api/analytics").set("Cookie", cookie);

describe("GET /api/analytics", () => {
  it("returns a complete, empty shape for a user with no data", async () => {
    const user = await createUser("stats");
    const res = await get(user.cookie);
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data.totalApplications).toBe(0);
    expect(data.minSample).toBe(5);
    expect(data.funnel.stages.map((stage: { stage: string }) => stage.stage)).toEqual(["APPLIED", "SCREENING", "INTERVIEW", "OFFER"]);
    expect(data.funnel.stages.every((stage: { reached: number }) => stage.reached === 0)).toBe(true);
    expect(data.funnel.steps).toHaveLength(3);
    expect(data.funnel.steps.every((step: { rate: number | null }) => step.rate === null)).toBe(true);
    expect(data.funnel.weakestStep).toBeNull();
    expect(data.funnel.savedOnlyCount).toBe(0);
    expect(data.funnel.stageUnknownCount).toBe(0);
    expect(data.weeklyApplications).toHaveLength(12);
    expect(data.weeklyApplications.every((week: { count: number }) => week.count === 0)).toBe(true);
    expect(data.matchByStage).toHaveLength(4);
    expect(data.practice.totalAttempts).toBe(0);
    expect(data.practice.weekly).toHaveLength(12);
    expect(data.practice.weekly.every((week: { passRate: number | null }) => week.passRate === null)).toBe(true);
    expect(data.resume).toEqual({ latestScore: null, analyzedAt: null });
  });

  it("builds the funnel from how far each application got", async () => {
    const user = await createUser("stats");
    const statuses = [
      "SAVED",
      "APPLIED",
      "APPLIED",
      "APPLIED",
      "SCREENING",
      "SCREENING",
      "INTERVIEW",
      "OFFER",
    ] as const;
    for (const status of statuses) await createApplicationRow(user.id, { status });

    const { data } = (await get(user.cookie)).body;
    expect(data.totalApplications).toBe(8);
    // Reaching a later stage counts as having reached every earlier one.
    expect(data.funnel.stages.map((stage: { reached: number }) => stage.reached)).toEqual([7, 4, 2, 1]);
    expect(data.funnel.savedOnlyCount).toBe(1);

    const [first, second, third] = data.funnel.steps;
    expect(first).toMatchObject({ from: "APPLIED", to: "SCREENING", reached: 4, of: 7, rate: 57, enoughData: true });
    expect(second).toMatchObject({ from: "SCREENING", to: "INTERVIEW", reached: 2, of: 4, rate: 50, enoughData: false });
    expect(third).toMatchObject({ from: "INTERVIEW", to: "OFFER", reached: 1, of: 2, rate: 50, enoughData: false });

    // Only a step with enough data (5+ applications behind it) may be named as the weakest.
    expect(data.funnel.weakestStep).toEqual(first);
  });

  it("counts a rejected application at the furthest stage it reached, and reports unknown history honestly", async () => {
    const user = await createUser("stats");

    // Reached the interview stage, then was rejected.
    const rejectedLate = await createApplicationRow(user.id, { status: "INTERVIEW" });
    await prisma.application.update({ where: { id: rejectedLate.id }, data: { status: "REJECTED" } });
    await prisma.applicationStatusEvent.create({
      data: { applicationId: rejectedLate.id, fromStatus: "INTERVIEW", toStatus: "REJECTED" },
    });

    // Rejected, and the history never shows a real stage: how far it got is unknown.
    await createApplicationRow(user.id, { status: "REJECTED" });

    const { data } = (await get(user.cookie)).body;
    expect(data.funnel.stages.map((stage: { reached: number }) => stage.reached)).toEqual([1, 1, 1, 0]);
    expect(data.funnel.stageUnknownCount).toBe(1);
    expect(data.funnel.savedOnlyCount).toBe(0);
  });

  it("counts applications sent per week, and not ones that were only saved", async () => {
    const user = await createUser("stats");
    await createApplicationRow(user.id, { status: "APPLIED", applicationDate: new Date() });
    await createApplicationRow(user.id, { status: "APPLIED", applicationDate: daysFromNow(-21) }); // exactly 3 weeks back
    await createApplicationRow(user.id, { status: "SAVED", applicationDate: new Date() });

    const weekly = (await get(user.cookie)).body.data.weeklyApplications as { weekStart: string; count: number }[];
    expect(weekly).toHaveLength(12);
    expect(weekly[11].count).toBe(1); // this week
    expect(weekly[8].count).toBe(1); // 3 weeks ago
    expect(weekly.reduce((sum, week) => sum + week.count, 0)).toBe(2);
    for (const week of weekly) {
      expect(new Date(`${week.weekStart}T00:00:00Z`).getUTCDay()).toBe(1); // every bucket starts on a Monday
    }
  });

  it("averages the job-match score by the stage an application reached", async () => {
    const user = await createUser("stats");
    const resume = await createResumeRow(user.id, { isDefault: true });
    const application = await createApplicationRow(user.id, { status: "INTERVIEW" });

    const match = await api()
      .post("/api/ai/job-match")
      .set("Cookie", user.cookie)
      .send({ resumeId: resume.id, applicationId: application.id });
    expect(match.status).toBe(201);

    const byStage = (await get(user.cookie)).body.data.matchByStage as {
      stage: string;
      applications: number;
      averageScore: number | null;
      lowSample: boolean;
    }[];
    expect(byStage.find((entry) => entry.stage === "INTERVIEW")).toEqual({
      stage: "INTERVIEW",
      applications: 1,
      averageScore: match.body.data.match.matchScore,
      lowSample: true, // one application is far too few to trust
    });
    for (const entry of byStage.filter((item) => item.stage !== "INTERVIEW")) {
      expect(entry).toMatchObject({ applications: 0, averageScore: null });
    }
  });

  it("tracks practice attempts and the latest resume score", async () => {
    const user = await createUser("stats");
    const resume = await createResumeRow(user.id, { isDefault: true });
    const application = await createApplicationRow(user.id);

    const analysis = await api().post(`/api/ai/resume-analysis/${resume.id}`).set("Cookie", user.cookie);
    expect(analysis.status).toBe(201);

    const set = await api()
      .post("/api/ai/interview-questions")
      .set("Cookie", user.cookie)
      .send({ resumeId: resume.id, applicationId: application.id });
    const questionId = set.body.data.interviewSet.questions[0].id as string;
    const attempt = await api()
      .post("/api/ai/practice/attempts")
      .set("Cookie", user.cookie)
      .send({ questionId, answer: "I would start by clarifying the requirements." });
    expect(attempt.status).toBe(201);

    const { data } = (await get(user.cookie)).body;
    expect(data.practice.totalAttempts).toBe(1);
    const thisWeek = data.practice.weekly[11];
    expect(thisWeek.attempts).toBe(1);
    expect(Number.isInteger(thisWeek.passRate)).toBe(true);
    expect(thisWeek.passRate).toBeGreaterThanOrEqual(0);
    expect(thisWeek.passRate).toBeLessThanOrEqual(100);
    expect(data.resume.latestScore).toBe(analysis.body.data.analysis.overallScore);
    expect(typeof data.resume.analyzedAt).toBe("string");
  });

  it("never counts another user's data", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const resume = await createResumeRow(alice.id, { isDefault: true });
    const application = await createApplicationRow(alice.id, { status: "OFFER", applicationDate: new Date() });
    await api().post(`/api/ai/resume-analysis/${resume.id}`).set("Cookie", alice.cookie);
    await api().post("/api/ai/job-match").set("Cookie", alice.cookie).send({ resumeId: resume.id, applicationId: application.id });

    const { data } = (await get(bob.cookie)).body;
    expect(data.totalApplications).toBe(0);
    expect(data.funnel.stages.every((stage: { reached: number }) => stage.reached === 0)).toBe(true);
    expect(data.weeklyApplications.every((week: { count: number }) => week.count === 0)).toBe(true);
    expect(data.matchByStage.every((entry: { applications: number }) => entry.applications === 0)).toBe(true);
    expect(data.resume).toEqual({ latestScore: null, analyzedAt: null });
  });

  it("requires a login", async () => {
    expect((await api().get("/api/analytics")).status).toBe(401);
  });
});