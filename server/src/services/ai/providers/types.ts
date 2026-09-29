export interface ResumeAnalysisResult {
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  projectsScore: number;
  keywordsScore: number;
  atsScore: number;
  strengths: string[];
  improvements: string[];
}

export interface AIProvider {
  analyzeResume(resumeText: string): Promise<ResumeAnalysisResult>;
}