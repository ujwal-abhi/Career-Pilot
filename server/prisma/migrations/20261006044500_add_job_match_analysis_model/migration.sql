-- CreateTable
CREATE TABLE "JobMatchAnalysis" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "matchedSkills" TEXT[],
    "missingSkills" TEXT[],
    "relevantExperience" TEXT[],
    "potentialGaps" TEXT[],
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMatchAnalysis_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobMatchAnalysis" ADD CONSTRAINT "JobMatchAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatchAnalysis" ADD CONSTRAINT "JobMatchAnalysis_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
