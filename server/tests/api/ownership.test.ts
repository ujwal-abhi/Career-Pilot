import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import prisma from "../../src/config/db";
import { env } from "../../src/config/env";
import { api } from "../helpers/api";
import { createUser, daysFromNow, hoursFromNow, useCleanDatabase, type TestUser } from "../helpers/db";
import { createApplicationRow, createResumeRow } from "../helpers/factories";

useCleanDatabase();

// IDOR ("insecure direct object reference"): user B learns the id of one of user A's records
// and tries to read or change it. Every query in the app is scoped by userId, so each of
// these must answer 404 (as if the record did not exist) and leave A's data untouched.

let alice: TestUser;
let bob: TestUser;
let aliceApplication: { id: string };
let aliceResume: { id: string; storedName: string };
let aliceReminder: { id: string };
let aliceInterview: { id: string };
let aliceQuestion: { id: string };
let aliceApplicationUntouchedSnapshot: string;

beforeAll(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");

  aliceApplication = await createApplicationRow(alice.id, { company: "Alice Corp", status: "APPLIED" });
  aliceResume = await createResumeRow(alice.id, { isDefault: true });
  await fs.writeFile(path.join(env.uploadDir, aliceResume.storedName), "%PDF-1.4 alice");

  aliceReminder = await prisma.reminder.create({ data: { userId: alice.id, title: "Alice reminder", dueAt: daysFromNow(2) } });
  aliceInterview = await prisma.interview.create({
    data: { applicationId: aliceApplication.id, title: "Alice interview", scheduledAt: hoursFromNow(30) },
  });

  const set = await api()
    .post("/api/ai/interview-questions")
    .set("Cookie", alice.cookie)
    .send({ resumeId: aliceResume.id, applicationId: aliceApplication.id });
  aliceQuestion = set.body.data.interviewSet.questions[0];

  aliceApplicationUntouchedSnapshot = JSON.stringify(await prisma.application.findUniqueOrThrow({ where: { id: aliceApplication.id } }));
});

const asBob = (method: "get" | "post" | "put" | "patch" | "delete", url: string, body?: object) => {
  const request = api()[method](url).set("Cookie", bob.cookie);
  return body ? request.send(body) : request;
};

describe("applications", () => {
  it("Bob cannot read Alice's application", async () => {
    expect((await asBob("get", `/api/applications/${aliceApplication.id}`)).status).toBe(404);
  });

  it("Bob cannot change it, and it is left exactly as it was", async () => {
    const res = await asBob("put", `/api/applications/${aliceApplication.id}`, { company: "Hacked", position: "Hacked", status: "REJECTED" });
    expect(res.status).toBe(404);
    const now = JSON.stringify(await prisma.application.findUniqueOrThrow({ where: { id: aliceApplication.id } }));
    expect(now).toBe(aliceApplicationUntouchedSnapshot);
  });

  it("Bob cannot delete it", async () => {
    expect((await asBob("delete", `/api/applications/${aliceApplication.id}`)).status).toBe(404);
    expect(await prisma.application.count({ where: { id: aliceApplication.id } })).toBe(1);
  });

  it("Bob's list and dashboard do not include it", async () => {
    const list = await asBob("get", "/api/applications");
    expect(list.body.data.applications).toEqual([]);
    const dashboard = await asBob("get", "/api/dashboard");
    expect(dashboard.body.data.totalApplications).toBe(0);
  });
});

describe("resumes and files", () => {
  it("Bob cannot download, delete, or make Alice's resume his default", async () => {
    expect((await asBob("get", `/api/resumes/${aliceResume.id}/download`)).status).toBe(404);
    expect((await asBob("delete", `/api/resumes/${aliceResume.id}`)).status).toBe(404);
    expect((await asBob("put", `/api/resumes/${aliceResume.id}/default`)).status).toBe(404);
  });

  it("Alice's resume and file are still there afterwards", async () => {
    expect(await prisma.resume.count({ where: { id: aliceResume.id } })).toBe(1);
    await expect(fs.access(path.join(env.uploadDir, aliceResume.storedName))).resolves.toBeUndefined();
  });

  it("Bob's resume list is empty", async () => {
    expect((await asBob("get", "/api/resumes")).body.data.resumes).toEqual([]);
  });
});

describe("AI features", () => {
  const bobsOwn: { resume?: { id: string }; application?: { id: string } } = {};
  beforeAll(async () => {
    bobsOwn.resume = await createResumeRow(bob.id);
    bobsOwn.application = await createApplicationRow(bob.id);
  });

  it("Bob cannot analyse or read the analysis of Alice's resume", async () => {
    expect((await asBob("post", `/api/ai/resume-analysis/${aliceResume.id}`)).status).toBe(404);
    expect((await asBob("get", `/api/ai/resume-analysis/${aliceResume.id}`)).status).toBe(404);
  });

  it.each([
    ["job-match", "/api/ai/job-match"],
    ["resume-tailor", "/api/ai/resume-tailor"],
    ["interview-questions", "/api/ai/interview-questions"],
  ])("%s: Bob cannot combine his own data with Alice's resume or application", async (_name, url) => {
    const aliceResumeBobApplication = await asBob("post", url, { resumeId: aliceResume.id, applicationId: bobsOwn.application!.id });
    expect(aliceResumeBobApplication.status).toBe(404);
    expect(aliceResumeBobApplication.body.message).toBe("Resume not found.");

    const bobResumeAliceApplication = await asBob("post", url, { resumeId: bobsOwn.resume!.id, applicationId: aliceApplication.id });
    expect(bobResumeAliceApplication.status).toBe(404);
    expect(bobResumeAliceApplication.body.message).toBe("Application not found.");
  });

  it("Bob cannot read saved results through the GET routes either", async () => {
    for (const name of ["job-match", "resume-tailor", "interview-questions"]) {
      const res = await asBob("get", `/api/ai/${name}/${aliceResume.id}/${aliceApplication.id}`);
      expect(res.status).toBe(404);
    }
  });

  it("Bob cannot answer, or list attempts for, Alice's practice question", async () => {
    const answer = await asBob("post", "/api/ai/practice/attempts", { questionId: aliceQuestion.id, answer: "I would do this and that." });
    expect(answer.status).toBe(404);
    expect(await prisma.practiceAttempt.count({ where: { questionId: aliceQuestion.id } })).toBe(0);
    expect((await asBob("get", `/api/ai/practice/questions/${aliceQuestion.id}/attempts`)).status).toBe(404);
  });
});

describe("reminders", () => {
  it("Bob cannot complete or delete Alice's reminder", async () => {
    expect((await asBob("patch", `/api/reminders/${aliceReminder.id}/completed`, { completed: true })).status).toBe(404);
    expect((await asBob("delete", `/api/reminders/${aliceReminder.id}`)).status).toBe(404);
    const stored = await prisma.reminder.findUniqueOrThrow({ where: { id: aliceReminder.id } });
    expect(stored.completedAt).toBeNull();
  });

  it("Bob cannot attach a reminder to Alice's application", async () => {
    const res = await asBob("post", "/api/reminders", { title: "Sneaky", dueAt: daysFromNow(1).toISOString(), applicationId: aliceApplication.id });
    expect(res.status).toBe(404);
    expect(await prisma.reminder.count({ where: { title: "Sneaky" } })).toBe(0);
  });

  it("Bob's reminder list is empty", async () => {
    expect((await asBob("get", "/api/reminders")).body.data.reminders).toEqual([]);
  });
});

describe("interviews", () => {
  it("Bob cannot schedule an interview on Alice's application", async () => {
    const res = await asBob("post", "/api/interviews", {
      applicationId: aliceApplication.id,
      title: "Sneaky",
      scheduledAt: hoursFromNow(5).toISOString(),
    });
    expect(res.status).toBe(404);
    expect(await prisma.interview.count({ where: { title: "Sneaky" } })).toBe(0);
  });

  it("Bob cannot edit or delete Alice's interview", async () => {
    const edit = await asBob("put", `/api/interviews/${aliceInterview.id}`, { title: "Hacked", scheduledAt: hoursFromNow(9).toISOString() });
    expect(edit.status).toBe(404);
    expect((await asBob("delete", `/api/interviews/${aliceInterview.id}`)).status).toBe(404);
    const stored = await prisma.interview.findUniqueOrThrow({ where: { id: aliceInterview.id } });
    expect(stored.title).toBe("Alice interview");
  });

  it("Bob's interview list is empty", async () => {
    expect((await asBob("get", "/api/interviews")).body.data.interviews).toEqual([]);
  });
});

describe("notifications", () => {
  it("Bob cannot snooze a follow-up on Alice's application", async () => {
    const res = await asBob("post", `/api/notifications/follow-ups/${aliceApplication.id}/snooze`);
    expect(res.status).toBe(404);
    const stored = await prisma.application.findUniqueOrThrow({ where: { id: aliceApplication.id } });
    expect(stored.followUpSnoozedUntil).toBeNull();
  });
});