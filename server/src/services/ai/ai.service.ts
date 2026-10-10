import { MockAIProvider } from "./providers/mock.provider";
import {
  validateAnalysisResult,
  validateJobMatchResult,
  validateTailoringResult,
  validateInterviewResult,
} from "./validateAnalysis";
import type {
  AIProvider,
  ResumeAnalysisResult,
  JobMatchResult,
  TailoringResult,
  InterviewQuestionsResult,
} from "./providers/types";

const provider: AIProvider = new MockAIProvider();

export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  const rawResult = await provider.analyzeResume(resumeText);
  return validateAnalysisResult(rawResult);
}

export async function matchResumeToJobText(
  resumeText: string,
  jobDescription: string
): Promise<JobMatchResult> {
  const rawResult = await provider.matchResumeToJob(resumeText, jobDescription);
  return validateJobMatchResult(rawResult);
}

export async function tailorResumeText(
  resumeText: string,
  jobDescription: string,
  targetPosition: string
): Promise<TailoringResult> {
  const rawResult = await provider.tailorResume(resumeText, jobDescription, targetPosition);
  // The grounding check needs the ORIGINAL resume text, so it runs here, outside the provider.
  return validateTailoringResult(rawResult, resumeText);
}

export async function generateInterviewQuestionsText(
  resumeText: string,
  jobDescription: string,
  targetPosition: string,
  company: string
): Promise<InterviewQuestionsResult> {
  const rawResult = await provider.generateInterviewQuestions(
    resumeText,
    jobDescription,
    targetPosition,
    company
  );
  return validateInterviewResult(
    rawResult,
    resumeText,
    jobDescription,
    `${targetPosition} ${company}`
  );
}