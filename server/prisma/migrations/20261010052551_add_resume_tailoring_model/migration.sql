-- CreateTable
CREATE TABLE "ResumeTailoring" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "skills" TEXT[],
    "bullets" TEXT[],
    "notes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeTailoring_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ResumeTailoring" ADD CONSTRAINT "ResumeTailoring_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeTailoring" ADD CONSTRAINT "ResumeTailoring_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
