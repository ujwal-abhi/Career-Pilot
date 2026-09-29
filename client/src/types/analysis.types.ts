export interface ResumeAnalysis {
  id: string;
  resumeId: string;
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  projectsScore: number;
  keywordsScore: number;
  atsScore: number;
  strengths: string[];
  improvements: string[];
  createdAt: string;
}