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

export interface JobMatchResult {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  relevantExperience: string[];
  potentialGaps: string[];
  recommendations: string[];
}

export interface AIProvider {
  analyzeResume(resumeText: string): Promise<ResumeAnalysisResult>;
  matchResumeToJob(resumeText: string, jobDescription: string): Promise<JobMatchResult>;
}