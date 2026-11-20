import { describe, it, expect } from "vitest";
import prisma from "../../src/config/db";
import { api } from "../helpers/api";
import { createUser, daysFromNow, hoursFromNow, useCleanDatabase } from "../helpers/db";
import { createApplicationRow } from "../helpers/factories";

useCleanDatabase();

const ALL_STATUSES = ["APPLIED", "INTERVIEW", "OFFER", "REJECTED", "SAVED", "SCREENING", "WITHDRAWN"];

describe("GET /api/dashboard", () => {
  it("returns zeros, not missing keys, for a user with no applications", async () => {
    const user = await createUser("dash");
    const res = await api().get("/api/dashboard").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.totalApplications).toBe(0);
    expect(Object.keys(res.body.data.statusCounts).sort()).toEqual(ALL_STATUSES);
    expect(Object.values(res.body.data.statusCounts).every((count) => count === 0)).toBe(true);
    expect(res.body.data.recentApplications).toEqual([]);
    expect(res.body.data.upcomingInterviews).toEqual([]);
  });

  it("counts applications by status, for this user only", async () => {
    const user = await createUser("dash");
    const other = await createUser("other");
    for (const status of ["SAVED", "APPLIED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "REJECTED", "REJECTED"] as const) {
      await createApplicationRow(user.id, { status });
    }
    await createApplicationRow(other.id, { status: "APPLIED" });

    const res = await api().get("/api/dashboard").set("Cookie", user.cookie);
    expect(res.body.data.totalApplications).toBe(8);
    expect(res.body.data.statusCounts).toEqual({
      SAVED: 1,
      APPLIED: 2,
      SCREENING: 0,
      INTERVIEW: 1,
      OFFER: 1,
      REJECTED: 3,
      WITHDRAWN: 0,
    });
  });

  it("lists the 5 newest applications, newest first, with only the summary fields", async () => {
    const user = await createUser("dash");
    for (let index = 1; index <= 7; index += 1) {
      await createApplicationRow(user.id, { company: `Company ${index}`, createdAt: daysFromNow(-(10 - index)) });
    }

    const res = await api().get("/api/dashboard").set("Cookie", user.cookie);
    const recent = res.body.data.recentApplications as Record<string, unknown>[];
    expect(recent.map((application) => application.company)).toEqual([
      "Company 7",
      "Company 6",
      "Company 5",
      "Company 4",
      "Company 3",
    ]);
    expect(Object.keys(recent[0]).sort()).toEqual(["company", "createdAt", "id", "position", "status"]);
    expect(res.body.data.totalApplications).toBe(7); // the total is not capped at 5
  });

  it("lists upcoming interviews only: future, soonest first, at most 5, this user's only", async () => {
    const user = await createUser("dash");
    const other = await createUser("other");
    const application = await createApplicationRow(user.id, { company: "Globex", position: "Engineer" });
    const otherApplication = await createApplicationRow(other.id);

    await prisma.interview.createMany({
      data: [
        { applicationId: application.id, title: "Past", scheduledAt: hoursFromNow(-3) },
        ...[60, 10, 40, 20, 50, 30, 70].map((hours) => ({
          applicationId: application.id,
          title: `In ${hours}h`,
          scheduledAt: hoursFromNow(hours),
        })),
        { applicationId: otherApplication.id, title: "Not mine", scheduledAt: hoursFromNow(1) },
      ],
    });

    const res = await api().get("/api/dashboard").set("Cookie", user.cookie);
    const upcoming = res.body.data.upcomingInterviews as { title: string }[];
    expect(upcoming.map((interview) => interview.title)).toEqual(["In 10h", "In 20h", "In 30h", "In 40h", "In 50h"]);
    expect(Object.keys(res.body.data.upcomingInterviews[0]).sort()).toEqual(["application", "format", "id", "scheduledAt", "title"]);
    expect(res.body.data.upcomingInterviews[0].application).toEqual({
      id: application.id,
      company: "Globex",
      position: "Engineer",
    });
  });

  it("requires a login", async () => {
    expect((await api().get("/api/dashboard")).status).toBe(401);
  });
});