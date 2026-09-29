import { MockAIProvider } from "./providers/mock.provider";
import { validateAnalysisResult } from "./validateAnalysis";
import type { AIProvider, ResumeAnalysisResult } from "./providers/types";

// Provider selection lives in exactly one place. Swapping to a real LLM later
// means adding a new class that implements AIProvider and changing this one line —
// nothing else in the app needs to know or care which provider is active.
const provider: AIProvider = new MockAIProvider();

export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  const rawResult = await provider.analyzeResume(resumeText);
  return validateAnalysisResult(rawResult);
}