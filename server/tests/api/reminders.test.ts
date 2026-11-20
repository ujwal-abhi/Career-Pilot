import { describe, it, expect } from "vitest";
import prisma from "../../src/config/db";
import { AUTH_COOKIE_NAME } from "../../src/config/cookie";
import { api } from "../helpers/api";
import { createUser, daysFromNow, hoursFromNow, useCleanDatabase } from "../helpers/db";
import { createApplicationRow } from "../helpers/factories";

useCleanDatabase();

const VALID_DUE = "2030-06-01T09:00:00.000Z";

describe("POST /api/reminders", () => {
  it("creates a reminder with a trimmed title and no application", async () => {
    const user = await createUser("rem");
    const due = daysFromNow(3);
    const res = await api()
      .post("/api/reminders")
      .set("Cookie", user.cookie)
      .send({ title: "  Send thank-you note  ", dueAt: due.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reminder).toMatchObject({
      title: "Send thank-you note",
      completedAt: null,
      applicationId: null,
      application: null,
    });
    expect(new Date(res.body.data.reminder.dueAt).getTime()).toBe(due.getTime());
    expect(await prisma.reminder.count({ where: { userId: user.id } })).toBe(1);
  });

  it("stores a due time written with a UTC offset as the same instant", async () => {
    const user = await createUser("rem");
    const res = await api()
      .post("/api/reminders")
      .set("Cookie", user.cookie)
      .send({ title: "Offset", dueAt: "2030-01-01T10:00:00+05:30" });
    expect(res.status).toBe(201);
    expect(res.body.data.reminder.dueAt).toBe("2030-01-01T04:30:00.000Z");
  });

  it("can be tied to one of the user's own applications", async () => {
    const user = await createUser("rem");
    const application = await createApplicationRow(user.id, { company: "Globex", position: "Engineer" });
    const res = await api()
      .post("/api/reminders")
      .set("Cookie", user.cookie)
      .send({ title: "Follow up", dueAt: VALID_DUE, applicationId: application.id });

    expect(res.status).toBe(201);
    expect(res.body.data.reminder.applicationId).toBe(application.id);
    expect(res.body.data.reminder.application).toEqual({ id: application.id, company: "Globex", position: "Engineer" });
  });

  it("returns 404 for an application that does not exist", async () => {
    const user = await createUser("rem");
    const res = await api()
      .post("/api/reminders")
      .set("Cookie", user.cookie)
      .send({ title: "Ghost", dueAt: VALID_DUE, applicationId: "does-not-exist" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Application not found.");
  });

  it.each([
    ["no title", { dueAt: VALID_DUE }, "Title is required."],
    ["a blank title", { title: "   ", dueAt: VALID_DUE }, "Title is required."],
    ["a title that is not text", { title: 42, dueAt: VALID_DUE }, "Title is required."],
    ["a title over 200 characters", { title: "x".repeat(201), dueAt: VALID_DUE }, "Title must be 200 characters or fewer."],
    ["no due date", { title: "No date" }, "Choose a valid due date and time."],
    ["a due date that is not a date", { title: "Bad", dueAt: "not a date" }, "Choose a valid due date and time."],
    ["a due date that is a number", { title: "Bad", dueAt: 5 }, "Choose a valid due date and time."],
    ["a due date with no time zone", { title: "Bad", dueAt: "2030-06-01T09:00" }, "Choose a valid due date and time."],
    ["a due date before the year 2000", { title: "Bad", dueAt: "1999-12-31T23:00:00Z" }, "Choose a valid due date and time."],
    ["a due date after the year 2100", { title: "Bad", dueAt: "2101-01-01T00:00:00Z" }, "Choose a valid due date and time."],
    ["an application id that is not text", { title: "Bad", dueAt: VALID_DUE, applicationId: 123 }, "Invalid application."],
  ])("rejects %s and saves nothing", async (_label, body, message) => {
    const user = await createUser("rem");
    const res = await api().post("/api/reminders").set("Cookie", user.cookie).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message });
    expect(await prisma.reminder.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("GET /api/reminders", () => {
  it("lists only the user's reminders, soonest due first", async () => {
    const user = await createUser("rem");
    const other = await createUser("other");
    const application = await createApplicationRow(user.id, { company: "Initech" });

    await prisma.reminder.createMany({
      data: [
        { userId: user.id, title: "Later", dueAt: daysFromNow(5) },
        { userId: user.id, title: "Earliest", dueAt: daysFromNow(-1), applicationId: application.id },
        { userId: user.id, title: "Middle", dueAt: daysFromNow(1) },
        { userId: other.id, title: "Not mine", dueAt: daysFromNow(2) },
      ],
    });

    const res = await api().get("/api/reminders").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    const reminders = res.body.data.reminders as { title: string; application: { company: string } | null }[];
    expect(reminders.map((reminder) => reminder.title)).toEqual(["Earliest", "Middle", "Later"]);
    expect(reminders[0].application?.company).toBe("Initech");
    expect(reminders[1].application).toBeNull();
  });

  it("returns an empty list for a user with no reminders", async () => {
    const user = await createUser("rem");
    const res = await api().get("/api/reminders").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.reminders).toEqual([]);
  });
});

describe("PATCH /api/reminders/:id/completed", () => {
  it("marks a reminder done and then not done again", async () => {
    const user = await createUser("rem");
    const reminder = await prisma.reminder.create({ data: { userId: user.id, title: "Toggle me", dueAt: hoursFromNow(5) } });

    const done = await api()
      .patch(`/api/reminders/${reminder.id}/completed`)
      .set("Cookie", user.cookie)
      .send({ completed: true });
    expect(done.status).toBe(200);
    expect(typeof done.body.data.reminder.completedAt).toBe("string");
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).completedAt).not.toBeNull();

    const undone = await api()
      .patch(`/api/reminders/${reminder.id}/completed`)
      .set("Cookie", user.cookie)
      .send({ completed: false });
    expect(undone.status).toBe(200);
    expect(undone.body.data.reminder.completedAt).toBeNull();
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).completedAt).toBeNull();
  });

  it.each([
    ["the string 'true'", { completed: "true" }],
    ["a number", { completed: 1 }],
    ["nothing", {}],
  ])("rejects %s instead of a real boolean", async (_label, body) => {
    const user = await createUser("rem");
    const reminder = await prisma.reminder.create({ data: { userId: user.id, title: "Strict", dueAt: hoursFromNow(5) } });
    const res = await api().patch(`/api/reminders/${reminder.id}/completed`).set("Cookie", user.cookie).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("completed must be true or false.");
  });

  it("returns 404 for an unknown reminder", async () => {
    const user = await createUser("rem");
    const res = await api().patch("/api/reminders/nope/completed").set("Cookie", user.cookie).send({ completed: true });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Reminder not found.");
  });
});

describe("DELETE /api/reminders/:id", () => {
  it("deletes the reminder, and a second delete is a 404", async () => {
    const user = await createUser("rem");
    const reminder = await prisma.reminder.create({ data: { userId: user.id, title: "Delete me", dueAt: hoursFromNow(5) } });

    const first = await api().delete(`/api/reminders/${reminder.id}`).set("Cookie", user.cookie);
    expect(first.status).toBe(200);
    expect(first.body.data.message).toBe("Reminder deleted.");
    expect(await prisma.reminder.count({ where: { id: reminder.id } })).toBe(0);

    const second = await api().delete(`/api/reminders/${reminder.id}`).set("Cookie", user.cookie);
    expect(second.status).toBe(404);
    expect(second.body.message).toBe("Reminder not found.");
  });

  it("is removed automatically when its application is deleted", async () => {
    const user = await createUser("rem");
    const application = await createApplicationRow(user.id);
    const reminder = await prisma.reminder.create({
      data: { userId: user.id, applicationId: application.id, title: "Tied", dueAt: hoursFromNow(5) },
    });
    await prisma.application.delete({ where: { id: application.id } });
    expect(await prisma.reminder.count({ where: { id: reminder.id } })).toBe(0);
  });
});

describe("authentication", () => {
  it.each([
    ["get", "/api/reminders"],
    ["post", "/api/reminders"],
    ["patch", "/api/reminders/x/completed"],
    ["delete", "/api/reminders/x"],
  ] as const)("%s %s requires a login", async (method, url) => {
    expect((await api()[method](url)).status).toBe(401);
  });

  it("rejects a token that is not valid", async () => {
    const res = await api().get("/api/reminders").set("Cookie", `${AUTH_COOKIE_NAME}=not-a-real-token`);
    expect(res.status).toBe(401);
  });
});