import { describe, it, expect, beforeAll } from "vitest";
import prisma from "../../src/config/db";
import { api } from "../helpers/api";
import { createUser, useCleanDatabase, type TestUser } from "../helpers/db";

useCleanDatabase();

let user: TestUser;
let other: TestUser;
beforeAll(async () => {
  user = await createUser("owner");
  other = await createUser("other");
});

const create = (body: object, as = () => user) => api().post("/api/applications").set("Cookie", as().cookie).send(body);

describe("POST /api/applications", () => {
  it("creates an application owned by the signed-in user, defaulting to SAVED", async () => {
    const res = await create({ company: "Acme", position: "Frontend Developer" });
    expect(res.status).toBe(201);
    expect(res.body.data.application).toMatchObject({ company: "Acme", position: "Frontend Developer", status: "SAVED", userId: user.id });
  });

  it("stores the optional fields, turning empty strings into null", async () => {
    const res = await create({
      company: "Globex",
      position: "Developer",
      status: "APPLIED",
      location: "Bengaluru",
      salary: "",
      jobUrl: "https://example.com/job",
      jobDescription: "Build things with React.",
      applicationDate: "2026-10-01",
      notes: "Referred by a friend",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.application).toMatchObject({
      status: "APPLIED",
      location: "Bengaluru",
      salary: null,
      jobUrl: "https://example.com/job",
      notes: "Referred by a friend",
    });
    expect(res.body.data.application.applicationDate).toMatch(/^2026-10-01/);
  });

  it("ignores a userId sent in the body: the owner is always the signed-in user", async () => {
    const res = await create({ company: "Sneaky", position: "Dev", userId: other.id });
    expect(res.status).toBe(201);
    expect(res.body.data.application.userId).toBe(user.id);
  });

  it("records the first status-history row, written together with the application", async () => {
    const res = await create({ company: "History Inc", position: "Dev", status: "APPLIED" });
    const events = await prisma.applicationStatusEvent.findMany({ where: { applicationId: res.body.data.application.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: null, toStatus: "APPLIED" });
  });

  it.each([
    ["a missing company", { position: "Dev" }, "Company is required."],
    ["a blank position", { company: "A", position: "  " }, "Position is required."],
    ["an invalid status", { company: "A", position: "B", status: "HIRED" }, "Invalid status value."],
  ])("returns 400 for %s", async (_label, body, message) => {
    const res = await create(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
  });
});

describe("GET /api/applications", () => {
  it("lists only the signed-in user's applications, newest first", async () => {
    await create({ company: "Other Person's Co", position: "Dev" }, () => other);
    const res = await api().get("/api/applications").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    const list = res.body.data.applications as { userId: string; createdAt: string }[];
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.every((application) => application.userId === user.id)).toBe(true);
    const times = list.map((application) => Date.parse(application.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("returns an empty list for a new user", async () => {
    const fresh = await createUser("fresh");
    const res = await api().get("/api/applications").set("Cookie", fresh.cookie);
    expect(res.body.data.applications).toEqual([]);
  });
});

describe("GET /api/applications/:id", () => {
  it("returns one application", async () => {
    const created = await create({ company: "Single", position: "Dev" });
    const res = await api().get(`/api/applications/${created.body.data.application.id}`).set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.application.company).toBe("Single");
  });

  it("returns 404 for an id that does not exist", async () => {
    const res = await api().get("/api/applications/00000000-0000-0000-0000-000000000000").set("Cookie", user.cookie);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Application not found.");
  });
});

describe("PUT /api/applications/:id", () => {
  it("updates the fields that were sent and leaves the rest alone", async () => {
    const created = await create({ company: "Before", position: "Dev", location: "Remote" });
    const id = created.body.data.application.id;
    const res = await api().put(`/api/applications/${id}`).set("Cookie", user.cookie).send({ company: "After", position: "Dev" });
    expect(res.status).toBe(200);
    expect(res.body.data.application).toMatchObject({ company: "After", location: "Remote" });
  });

  it("validates input on update too", async () => {
    const created = await create({ company: "Valid", position: "Dev" });
    const res = await api().put(`/api/applications/${created.body.data.application.id}`).set("Cookie", user.cookie).send({ company: "", position: "Dev" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when updating something that does not exist", async () => {
    const res = await api().put("/api/applications/nope").set("Cookie", user.cookie).send({ company: "A", position: "B" });
    expect(res.status).toBe(404);
  });
});

describe("status history", () => {
  it("adds one event per REAL status change, with where it came from and where it went", async () => {
    const created = await create({ company: "Journey", position: "Dev", status: "SAVED" });
    const id = created.body.data.application.id;

    await api().put(`/api/applications/${id}`).set("Cookie", user.cookie).send({ company: "Journey", position: "Dev", status: "APPLIED" });
    await api().put(`/api/applications/${id}`).set("Cookie", user.cookie).send({ company: "Journey", position: "Dev", status: "INTERVIEW" });

    const events = await prisma.applicationStatusEvent.findMany({ where: { applicationId: id }, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => [event.fromStatus, event.toStatus])).toEqual([
      [null, "SAVED"],
      ["SAVED", "APPLIED"],
      ["APPLIED", "INTERVIEW"],
    ]);
  });

  it("adds nothing when the form is saved again with the same status", async () => {
    const created = await create({ company: "Same", position: "Dev", status: "APPLIED" });
    const id = created.body.data.application.id;
    await api().put(`/api/applications/${id}`).set("Cookie", user.cookie).send({ company: "Same Co", position: "Dev", status: "APPLIED" });
    expect(await prisma.applicationStatusEvent.count({ where: { applicationId: id } })).toBe(1);
  });
});

describe("DELETE /api/applications/:id", () => {
  it("deletes it, and its history goes with it (cascade)", async () => {
    const created = await create({ company: "Doomed", position: "Dev", status: "APPLIED" });
    const id = created.body.data.application.id;
    const res = await api().delete(`/api/applications/${id}`).set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(await prisma.application.count({ where: { id } })).toBe(0);
    expect(await prisma.applicationStatusEvent.count({ where: { applicationId: id } })).toBe(0);
  });

  it("returns 404 the second time", async () => {
    const created = await create({ company: "Twice", position: "Dev" });
    const id = created.body.data.application.id;
    await api().delete(`/api/applications/${id}`).set("Cookie", user.cookie);
    expect((await api().delete(`/api/applications/${id}`).set("Cookie", user.cookie)).status).toBe(404);
  });
});