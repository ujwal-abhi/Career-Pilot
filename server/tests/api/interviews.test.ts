import { describe, it, expect } from "vitest";
import prisma from "../../src/config/db";
import { AUTH_COOKIE_NAME } from "../../src/config/cookie";
import { api } from "../helpers/api";
import { createUser, hoursFromNow, useCleanDatabase } from "../helpers/db";
import { createApplicationRow } from "../helpers/factories";

useCleanDatabase();

const TITLE_REQUIRED = 'Title is required (for example, "Technical round 1").';

function interviewBody(applicationId: string, extra: Record<string, unknown> = {}) {
  return { applicationId, title: "Technical round 1", scheduledAt: hoursFromNow(48).toISOString(), ...extra };
}

describe("POST /api/interviews", () => {
  it("schedules an interview with sensible defaults", async () => {
    const user = await createUser("int");
    const application = await createApplicationRow(user.id, { company: "Globex", position: "Engineer" });
    const scheduledAt = hoursFromNow(72);

    const res = await api()
      .post("/api/interviews")
      .set("Cookie", user.cookie)
      .send({ applicationId: application.id, title: "  Phone screen  ", scheduledAt: scheduledAt.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.data.interview).toMatchObject({
      applicationId: application.id,
      title: "Phone screen",
      format: "VIDEO", // the default when none is given
      location: null,
      notes: null,
      application: { id: application.id, company: "Globex", position: "Engineer" },
    });
    expect(new Date(res.body.data.interview.scheduledAt).getTime()).toBe(scheduledAt.getTime());
  });

  it("keeps the format, location and notes, trimmed", async () => {
    const user = await createUser("int");
    const application = await createApplicationRow(user.id);
    const res = await api()
      .post("/api/interviews")
      .set("Cookie", user.cookie)
      .send(interviewBody(application.id, { format: "ONSITE", location: "  HQ, floor 3  ", notes: "  Bring a laptop  " }));
    expect(res.status).toBe(201);
    expect(res.body.data.interview).toMatchObject({ format: "ONSITE", location: "HQ, floor 3", notes: "Bring a laptop" });
  });

  it("stores blank location and notes as null", async () => {
    const user = await createUser("int");
    const application = await createApplicationRow(user.id);
    const res = await api()
      .post("/api/interviews")
      .set("Cookie", user.cookie)
      .send(interviewBody(application.id, { location: "   ", notes: "" }));
    expect(res.status).toBe(201);
    expect(res.body.data.interview.location).toBeNull();
    expect(res.body.data.interview.notes).toBeNull();
  });

  it("returns 404 for an application that does not exist", async () => {
    const user = await createUser("int");
    const res = await api().post("/api/interviews").set("Cookie", user.cookie).send(interviewBody("does-not-exist"));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Application not found.");
  });

  it.each([
    ["no application", { applicationId: undefined }, "Choose which application this interview is for."],
    ["a blank application id", { applicationId: "  " }, "Choose which application this interview is for."],
    ["no title", { title: undefined }, TITLE_REQUIRED],
    ["a blank title", { title: "   " }, TITLE_REQUIRED],
    ["a title over 120 characters", { title: "x".repeat(121) }, "Title must be 120 characters or fewer."],
    ["an unknown format", { format: "HOLOGRAM" }, "Invalid interview format."],
    ["a lower-case format", { format: "video" }, "Invalid interview format."],
    ["no date", { scheduledAt: undefined }, "Choose a valid date and time for the interview."],
    ["a date with no time zone", { scheduledAt: "2030-06-01T09:00" }, "Choose a valid date and time for the interview."],
    ["a date before the year 2000", { scheduledAt: "1999-01-01T00:00:00Z" }, "Choose a valid date and time for the interview."],
    ["a location that is not text", { location: 5 }, "Location must be text."],
    ["a location over 300 characters", { location: "x".repeat(301) }, "Location must be 300 characters or fewer."],
    ["notes that are not text", { notes: { a: 1 } }, "Notes must be text."],
    ["notes over 2000 characters", { notes: "x".repeat(2001) }, "Notes must be 2000 characters or fewer."],
  ])("rejects %s and saves nothing", async (_label, override, message) => {
    const user = await createUser("int");
    const application = await createApplicationRow(user.id);
    const res = await api()
      .post("/api/interviews")
      .set("Cookie", user.cookie)
      .send(interviewBody(application.id, override));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message });
    expect(await prisma.interview.count({ where: { applicationId: application.id } })).toBe(0);
  });
});

describe("GET /api/interviews", () => {
  it("lists only the user's interviews, soonest first, with the application summary", async () => {
    const user = await createUser("int");
    const other = await createUser("other");
    const application = await createApplicationRow(user.id, { company: "Initech", position: "Dev" });
    const otherApplication = await createApplicationRow(other.id);

    await prisma.interview.createMany({
      data: [
        { applicationId: application.id, title: "Third", scheduledAt: hoursFromNow(90) },
        { applicationId: application.id, title: "First", scheduledAt: hoursFromNow(-5) }, // past ones are still listed
        { applicationId: application.id, title: "Second", scheduledAt: hoursFromNow(10) },
        { applicationId: otherApplication.id, title: "Not mine", scheduledAt: hoursFromNow(20) },
      ],
    });

    const res = await api().get("/api/interviews").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    const interviews = res.body.data.interviews as { title: string; application: { company: string; position: string } }[];
    expect(interviews.map((interview) => interview.title)).toEqual(["First", "Second", "Third"]);
    expect(interviews[0].application).toMatchObject({ company: "Initech", position: "Dev" });
  });

  it("returns an empty list when there are none", async () => {
    const user = await createUser("int");
    const res = await api().get("/api/interviews").set("Cookie", user.cookie);
    expect(res.body.data.interviews).toEqual([]);
  });
});

describe("PUT /api/interviews/:id", () => {
  it("updates the details but never moves the interview to another application", async () => {
    const user = await createUser("int");
    const application = await createApplicationRow(user.id, { company: "First Co" });
    const otherApplication = await createApplicationRow(user.id, { company: "Second Co" });
    const created = await api().post("/api/interviews").set("Cookie", user.cookie).send(interviewBody(application.id));
    const id = created.body.data.interview.id as string;
    const newTime = hoursFromNow(200);

    const res = await api()
      .put(`/api/interviews/${id}`)
      .set("Cookie", user.cookie)
      .send({
        title: "Final round",
        format: "ONSITE",
        scheduledAt: newTime.toISOString(),
        location: "HQ",
        notes: "Bring ID",
        applicationId: otherApplication.id, // must be ignored
      });

    expect(res.status).toBe(200);
    expect(res.body.data.interview).toMatchObject({ id, title: "Final round", format: "ONSITE", location: "HQ", notes: "Bring ID" });
    expect(new Date(res.body.data.interview.scheduledAt).getTime()).toBe(newTime.getTime());
    expect(res.body.data.interview.application.company).toBe("First Co");
    expect((await prisma.interview.findUniqueOrThrow({ where: { id } })).applicationId).toBe(application.id);
  });

  it("applies the same validation as creating, and leaves the interview unchanged", async () => {
    const user = await createUser("int");
    const application = await createApplicationRow(user.id);
    const created = await api().post("/api/interviews").set("Cookie", user.cookie).send(interviewBody(application.id));
    const id = created.body.data.interview.id as string;

    const res = await api()
      .put(`/api/interviews/${id}`)
      .set("Cookie", user.cookie)
      .send({ title: "", scheduledAt: hoursFromNow(5).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(TITLE_REQUIRED);
    expect((await prisma.interview.findUniqueOrThrow({ where: { id } })).title).toBe("Technical round 1");
  });

  it("returns 404 for an unknown interview", async () => {
    const user = await createUser("int");
    const res = await api()
      .put("/api/interviews/nope")
      .set("Cookie", user.cookie)
      .send({ title: "x", scheduledAt: hoursFromNow(5).toISOString() });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Interview not found.");
  });
});

describe("DELETE /api/interviews/:id", () => {
  it("deletes the interview, and a second delete is a 404", async () => {
    const user = await createUser("int");
    const application = await createApplicationRow(user.id);
    const interview = await prisma.interview.create({
      data: { applicationId: application.id, title: "Delete me", scheduledAt: hoursFromNow(5) },
    });

    const first = await api().delete(`/api/interviews/${interview.id}`).set("Cookie", user.cookie);
    expect(first.status).toBe(200);
    expect(first.body.data.message).toBe("Interview deleted.");
    expect(await prisma.interview.count({ where: { id: interview.id } })).toBe(0);

    const second = await api().delete(`/api/interviews/${interview.id}`).set("Cookie", user.cookie);
    expect(second.status).toBe(404);
    expect(second.body.message).toBe("Interview not found.");
  });

  it("is removed automatically when its application is deleted", async () => {
    const user = await createUser("int");
    const application = await createApplicationRow(user.id);
    const interview = await prisma.interview.create({
      data: { applicationId: application.id, title: "Tied", scheduledAt: hoursFromNow(5) },
    });
    const res = await api().delete(`/api/applications/${application.id}`).set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(await prisma.interview.count({ where: { id: interview.id } })).toBe(0);
  });
});

describe("authentication", () => {
  it.each([
    ["get", "/api/interviews"],
    ["post", "/api/interviews"],
    ["put", "/api/interviews/x"],
    ["delete", "/api/interviews/x"],
  ] as const)("%s %s requires a login", async (method, url) => {
    expect((await api()[method](url)).status).toBe(401);
  });

  it("rejects a token that is not valid", async () => {
    const res = await api().get("/api/interviews").set("Cookie", `${AUTH_COOKIE_NAME}=not-a-real-token`);
    expect(res.status).toBe(401);
  });
});