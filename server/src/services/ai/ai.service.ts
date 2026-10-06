import { MockAIProvider } from "./providers/mock.provider";
import { validateAnalysisResult, validateJobMatchResult } from "./validateAnalysis";
import type { AIProvider, ResumeAnalysisResult, JobMatchResult } from "./providers/types";

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