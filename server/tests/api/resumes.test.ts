import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import prisma from "../../src/config/db";
import { env } from "../../src/config/env";
import { api } from "../helpers/api";
import { createUser, listUploadedFiles, useCleanDatabase, type TestUser } from "../helpers/db";
import { makePdf } from "../helpers/pdf";

useCleanDatabase();

let user: TestUser;
beforeAll(async () => {
  user = await createUser("uploader");
});

const pdf = makePdf(["Jane Doe", "Built dashboards with React and TypeScript"]);

const upload = (file: Buffer, filename = "My Resume.pdf", contentType = "application/pdf", as = () => user) =>
  api().post("/api/resumes").set("Cookie", as().cookie).attach("resume", file, { filename, contentType });

// supertest only buffers text and JSON by default; this reads a download as raw bytes.
function binary(response: unknown, callback: (error: Error | null, body: Buffer) => void) {
  const stream = response as NodeJS.ReadableStream; // supertest types this as a Response, but it is the raw stream
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  stream.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("POST /api/resumes", () => {
  it("accepts a real PDF, extracts its text, and makes the first resume the default", async () => {
    const res = await upload(pdf);
    expect(res.status).toBe(201);
    expect(res.body.data.resume).toMatchObject({ fileName: "My Resume.pdf", isDefault: true, fileSize: pdf.length });

    const stored = await prisma.resume.findUniqueOrThrow({ where: { id: res.body.data.resume.id } });
    expect(stored.extractedText).toContain("React");
    expect(stored.userId).toBe(user.id);
  });

  it("does not expose the stored file name or the extracted text in the response", async () => {
    const res = await upload(pdf, "another.pdf");
    expect(res.body.data.resume).not.toHaveProperty("storedName");
    expect(res.body.data.resume).not.toHaveProperty("extractedText");
  });

  it("does not make later uploads the default", async () => {
    const res = await upload(pdf, "third.pdf");
    expect(res.body.data.resume.isDefault).toBe(false);
  });

  it("stores the file under a random <uuid>.pdf name, never the name the user chose", async () => {
    const res = await upload(pdf, "shell.php.pdf");
    const stored = await prisma.resume.findUniqueOrThrow({ where: { id: res.body.data.resume.id } });
    expect(stored.storedName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(await listUploadedFiles()).toContain(stored.storedName);
    expect(stored.fileName).toBe("shell.php.pdf"); // the original name is kept only for display
  });

  it("rejects a file that CLAIMS to be a PDF but is not, and leaves no file behind", async () => {
    const before = await listUploadedFiles();
    const res = await upload(Buffer.from("<html><script>alert(1)</script></html>"), "evil.pdf");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("That file is not a valid PDF.");
    expect(await listUploadedFiles()).toEqual(before);
  });

  it("rejects a file that is not declared as a PDF", async () => {
    const res = await upload(pdf, "notes.txt", "text/plain");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Only PDF files are allowed.");
  });

  it("rejects a request with no file", async () => {
    const res = await api().post("/api/resumes").set("Cookie", user.cookie);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No file was uploaded.");
  });

  it("rejects a file over 5 MB", async () => {
    const huge = Buffer.concat([pdf, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(huge, "huge.pdf");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("File is too large (max 5MB).");
  });

  it("still saves the resume when the PDF text cannot be read, with no extracted text", async () => {
    // Starts like a PDF (passes the signature check) but is not parseable.
    const res = await upload(Buffer.from("%PDF-1.4\nthis is not really a pdf body"), "broken.pdf");
    expect(res.status).toBe(201);
    const stored = await prisma.resume.findUniqueOrThrow({ where: { id: res.body.data.resume.id } });
    expect(stored.extractedText ?? "").toBe("");
  });
});

describe("GET /api/resumes", () => {
  it("lists only this user's resumes with safe fields only", async () => {
    const stranger = await createUser("stranger");
    await upload(pdf, "stranger.pdf", "application/pdf", () => stranger);

    const res = await api().get("/api/resumes").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    const names = (res.body.data.resumes as { fileName: string }[]).map((resume) => resume.fileName);
    expect(names).toContain("My Resume.pdf");
    expect(names).not.toContain("stranger.pdf");
    for (const resume of res.body.data.resumes) {
      expect(Object.keys(resume).sort()).toEqual(["createdAt", "fileName", "fileSize", "id", "isDefault", "updatedAt"]);
    }
  });
});

describe("GET /api/resumes/:id/download", () => {
  it("returns the exact bytes that were uploaded, as an attachment with the original name", async () => {
    const uploaded = await upload(pdf, "Download Me.pdf");
    const res = await api()
      .get(`/api/resumes/${uploaded.body.data.resume.id}/download`)
      .set("Cookie", user.cookie)
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    expect(res.headers["content-disposition"]).toContain("Download Me.pdf");
    expect(Buffer.compare(res.body as Buffer, pdf)).toBe(0);
  });

  it("cannot be used to climb out of the upload folder through the file name", async () => {
    const uploaded = await upload(pdf, "../../secret.pdf");
    const res = await api()
      .get(`/api/resumes/${uploaded.body.data.resume.id}/download`)
      .set("Cookie", user.cookie)
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).not.toMatch(/\.\.\//);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await api().get("/api/resumes/nope/download").set("Cookie", user.cookie);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/resumes/:id/default", () => {
  it("makes exactly one resume the default", async () => {
    const solo = await createUser("defaults");
    const first = await upload(pdf, "first.pdf", "application/pdf", () => solo);
    const second = await upload(pdf, "second.pdf", "application/pdf", () => solo);

    const res = await api().put(`/api/resumes/${second.body.data.resume.id}/default`).set("Cookie", solo.cookie);
    expect(res.status).toBe(200);

    const rows = await prisma.resume.findMany({ where: { userId: solo.id } });
    expect(rows.filter((row) => row.isDefault).map((row) => row.id)).toEqual([second.body.data.resume.id]);
    expect(rows.find((row) => row.id === first.body.data.resume.id)?.isDefault).toBe(false);
  });
});

describe("DELETE /api/resumes/:id", () => {
  it("removes the database row AND the file on disk", async () => {
    const uploaded = await upload(pdf, "temporary.pdf");
    const id = uploaded.body.data.resume.id;
    const { storedName } = await prisma.resume.findUniqueOrThrow({ where: { id } });
    await expect(fs.access(path.join(env.uploadDir, storedName))).resolves.toBeUndefined();

    const res = await api().delete(`/api/resumes/${id}`).set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(await prisma.resume.count({ where: { id } })).toBe(0);
    await expect(fs.access(path.join(env.uploadDir, storedName))).rejects.toThrow();
  });

  it("still deletes the row when the file is already gone", async () => {
    const uploaded = await upload(pdf, "ghost.pdf");
    const id = uploaded.body.data.resume.id;
    const { storedName } = await prisma.resume.findUniqueOrThrow({ where: { id } });
    await fs.unlink(path.join(env.uploadDir, storedName));
    expect((await api().delete(`/api/resumes/${id}`).set("Cookie", user.cookie)).status).toBe(200);
  });

  it("returns 404 for an unknown id", async () => {
    expect((await api().delete("/api/resumes/nope").set("Cookie", user.cookie)).status).toBe(404);
  });
});