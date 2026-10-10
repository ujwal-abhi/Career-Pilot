-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('HR', 'TECHNICAL', 'BEHAVIORAL', 'PROJECT', 'ROLE_SPECIFIC');

-- CreateTable
CREATE TABLE "InterviewSet" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "notes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL,
    "interviewSetId" TEXT NOT NULL,
    "category" "QuestionCategory" NOT NULL,
    "question" TEXT NOT NULL,
    "answerStructure" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InterviewSet" ADD CONSTRAINT "InterviewSet_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSet" ADD CONSTRAINT "InterviewSet_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_interviewSetId_fkey" FOREIGN KEY ("interviewSetId") REFERENCES "InterviewSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
