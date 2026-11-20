import { randomUUID } from "node:crypto";
import prisma from "../../src/config/db";
import type { ApplicationStatus } from "../../src/generated/prisma/client";

// Writes rows straight to the database. Much faster than going through the API, and it keeps a
// test focused on the one thing it is about.

export const RESUME_TEXT = [
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

export const JOB_DESCRIPTION =
  "We are hiring a frontend developer. You will build user interfaces with React and TypeScript. " +
  "Experience with Docker and AWS is a plus. You will collaborate with designers and ship features weekly.";

export function createResumeRow(userId: string, overrides: { extractedText?: string | null; isDefault?: boolean; fileName?: string } = {}) {
  return prisma.resume.create({
    data: {
      userId,
      fileName: overrides.fileName ?? "resume.pdf",
      storedName: `${randomUUID()}.pdf`,
      fileSize: 1234,
      extractedText: overrides.extractedText === undefined ? RESUME_TEXT : overrides.extractedText,
      isDefault: overrides.isDefault ?? false,
    },
  });
}

export function createApplicationRow(
  userId: string,
  overrides: {
    company?: string;
    position?: string;
    status?: ApplicationStatus;
    jobDescription?: string | null;
    createdAt?: Date;
    applicationDate?: Date | null;
    followUpSnoozedUntil?: Date | null;
    statusEventAt?: Date; // when the application reached its status
  } = {}
) {
  const status = overrides.status ?? "SAVED";
  return prisma.application.create({
    data: {
      userId,
      company: overrides.company ?? "Acme",
      position: overrides.position ?? "Frontend Developer",
      status,
      jobDescription: overrides.jobDescription === undefined ? JOB_DESCRIPTION : overrides.jobDescription,
      ...(overrides.createdAt && { createdAt: overrides.createdAt }),
      applicationDate: overrides.applicationDate ?? null,
      followUpSnoozedUntil: overrides.followUpSnoozedUntil ?? null,
      statusEvents: {
        create: { fromStatus: null, toStatus: status, ...(overrides.statusEventAt && { createdAt: overrides.statusEventAt }) },
      },
    },
  });
}