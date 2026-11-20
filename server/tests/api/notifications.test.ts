import { describe, it, expect } from "vitest";
import prisma from "../../src/config/db";
import { AUTH_COOKIE_NAME } from "../../src/config/cookie";
import { api } from "../helpers/api";
import { createUser, daysFromNow, hoursFromNow, useCleanDatabase } from "../helpers/db";
import { createApplicationRow } from "../helpers/factories";

useCleanDatabase();

interface Item {
  id: string;
  type: string;
  title: string;
  detail: string;
  snoozable: boolean;
  applicationId: string | null;
}

describe("GET /api/notifications", () => {
  it("returns nothing for a user with nothing going on", async () => {
    const user = await createUser("note");
    const res = await api().get("/api/notifications").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], total: 0 });
  });

  it("shows what needs attention, most urgent first, and leaves out what does not", async () => {
    const user = await createUser("note");

    // Reminders
    const overdue = await prisma.reminder.create({ data: { userId: user.id, title: "Overdue task", dueAt: hoursFromNow(-2) } });
    const dueSoon = await prisma.reminder.create({ data: { userId: user.id, title: "Soon task", dueAt: hoursFromNow(3) } });
    await prisma.reminder.create({ data: { userId: user.id, title: "Too far away", dueAt: daysFromNow(3) } });
    await prisma.reminder.create({
      data: { userId: user.id, title: "Already done", dueAt: hoursFromNow(-2), completedAt: new Date() },
    });

    // An application with an upcoming interview is not "quiet", however old it is.
    const interviewing = await createApplicationRow(user.id, {
      company: "Busy Co",
      status: "INTERVIEW",
      applicationDate: daysFromNow(-20),
      statusEventAt: daysFromNow(-20),
    });
    const soon = await prisma.interview.create({
      data: { applicationId: interviewing.id, title: "Technical round", scheduledAt: hoursFromNow(10) },
    });
    await prisma.interview.create({
      data: { applicationId: interviewing.id, title: "Far away", scheduledAt: hoursFromNow(100) },
    });
    await prisma.interview.create({
      data: { applicationId: interviewing.id, title: "Already happened", scheduledAt: hoursFromNow(-5) },
    });

    // Follow-ups
    const quiet = await createApplicationRow(user.id, {
      company: "Quiet Co",
      status: "APPLIED",
      applicationDate: daysFromNow(-10),
      statusEventAt: daysFromNow(-10),
    });
    await createApplicationRow(user.id, {
      company: "Recent Co",
      status: "APPLIED",
      applicationDate: daysFromNow(-2),
      statusEventAt: daysFromNow(-2),
    });
    await createApplicationRow(user.id, { company: "Saved Co", status: "SAVED", applicationDate: daysFromNow(-30), statusEventAt: daysFromNow(-30) });
    await createApplicationRow(user.id, { company: "Offer Co", status: "OFFER", applicationDate: daysFromNow(-30), statusEventAt: daysFromNow(-30) });

    const res = await api().get("/api/notifications").set("Cookie", user.cookie);
    expect(res.status).toBe(200);

    const items = res.body.data.items as Item[];
    expect(items.map((item) => item.id)).toEqual([
      `reminder:${overdue.id}`,
      `interview:${soon.id}`,
      `reminder:${dueSoon.id}`,
      `followup:${quiet.id}`,
    ]);
    expect(items.map((item) => item.type)).toEqual(["REMINDER_OVERDUE", "INTERVIEW_SOON", "REMINDER_DUE", "FOLLOW_UP"]);
    expect(res.body.data.total).toBe(4);

    expect(items[1].title).toBe("Technical round at Busy Co");
    expect(items[1].detail).toBe("Frontend Developer (Video)");
    expect(items[3].title).toBe("Follow up with Quiet Co");
    expect(items[3].detail).toMatch(/no update for 10 days/);
    expect(items.map((item) => item.snoozable)).toEqual([false, false, false, true]);
  });

  it("caps the list at 20 but still reports the real total", async () => {
    const user = await createUser("note");
    await prisma.reminder.createMany({
      data: Array.from({ length: 25 }, (_value, index) => ({
        userId: user.id,
        title: `Overdue ${index}`,
        dueAt: hoursFromNow(-(index + 1)),
      })),
    });
    const res = await api().get("/api/notifications").set("Cookie", user.cookie);
    expect(res.body.data.items).toHaveLength(20);
    expect(res.body.data.total).toBe(25);
  });

  it("never includes another user's reminders, interviews or applications", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    await prisma.reminder.create({ data: { userId: alice.id, title: "Alice overdue", dueAt: hoursFromNow(-3) } });
    const application = await createApplicationRow(alice.id, {
      status: "APPLIED",
      applicationDate: daysFromNow(-12),
      statusEventAt: daysFromNow(-12),
    });
    await prisma.interview.create({ data: { applicationId: application.id, title: "Alice interview", scheduledAt: hoursFromNow(5) } });

    const res = await api().get("/api/notifications").set("Cookie", bob.cookie);
    expect(res.body.data).toEqual({ items: [], total: 0 });
  });

  it("requires a login", async () => {
    expect((await api().get("/api/notifications")).status).toBe(401);
    const res = await api().get("/api/notifications").set("Cookie", `${AUTH_COOKIE_NAME}=not-a-real-token`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/notifications/follow-ups/:applicationId/snooze", () => {
  async function quietApplication() {
    const user = await createUser("snooze");
    const application = await createApplicationRow(user.id, {
      company: "Quiet Co",
      status: "APPLIED",
      applicationDate: daysFromNow(-10),
      statusEventAt: daysFromNow(-10),
    });
    return { user, application };
  }

  it("hides the follow-up for about 7 days", async () => {
    const { user, application } = await quietApplication();

    const before = await api().get("/api/notifications").set("Cookie", user.cookie);
    expect((before.body.data.items as Item[]).map((item) => item.id)).toContain(`followup:${application.id}`);

    const res = await api()
      .post(`/api/notifications/follow-ups/${application.id}/snooze`)
      .set("Cookie", user.cookie);
    expect(res.status).toBe(200);

    const until = new Date(res.body.data.snoozedUntil).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(until - (Date.now() + sevenDays))).toBeLessThan(60 * 1000);

    const stored = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(stored.followUpSnoozedUntil?.getTime()).toBe(until);

    const after = await api().get("/api/notifications").set("Cookie", user.cookie);
    expect(after.body.data.items).toEqual([]);
  });

  it("brings the follow-up back once the snooze has run out", async () => {
    const { user, application } = await quietApplication();
    await prisma.application.update({ where: { id: application.id }, data: { followUpSnoozedUntil: hoursFromNow(-1) } });
    const res = await api().get("/api/notifications").set("Cookie", user.cookie);
    expect((res.body.data.items as Item[]).map((item) => item.id)).toEqual([`followup:${application.id}`]);
  });

  it("returns 404 for an unknown application", async () => {
    const user = await createUser("snooze");
    const res = await api().post("/api/notifications/follow-ups/nope/snooze").set("Cookie", user.cookie);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Application not found.");
  });

  it("requires a login", async () => {
    expect((await api().post("/api/notifications/follow-ups/x/snooze")).status).toBe(401);
  });
});