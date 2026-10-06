export interface JobMatch {
  id: string;
  resumeId: string;
  applicationId: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  relevantExperience: string[];
  potentialGaps: string[];
  recommendations: string[];
  createdAt: string;
}

export interface MatchOptionResume {
  id: string;
  fileName: string;
  isDefault: boolean;
}

export interface MatchOptionApplication {
  id: string;
  company: string;
  position: string;
}