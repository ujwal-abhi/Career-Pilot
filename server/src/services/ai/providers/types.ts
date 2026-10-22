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

export interface TailoringResult {
  summary: string;
  skills: string[];
  bullets: string[];
  notes: string[];
}

export type QuestionCategory =
  | "HR"
  | "TECHNICAL"
  | "BEHAVIORAL"
  | "PROJECT"
  | "ROLE_SPECIFIC";

export interface InterviewQuestionItem {
  category: QuestionCategory;
  question: string;
  answerStructure: string;
}

export interface InterviewQuestionsResult {
  questions: InterviewQuestionItem[];
  notes: string[];
}

export interface AnswerFeedbackInput {
  category: QuestionCategory;
  question: string;
  answer: string;
  resumeText: string;
}

export interface AnswerFeedbackResult {
  strengths: string[];
  improvements: string[];
  failedChecks: string[];
  passedCount: number;
  totalCount: number;
  notes: string[];
}

export interface AIProvider {
  analyzeResume(resumeText: string): Promise<ResumeAnalysisResult>;
  matchResumeToJob(resumeText: string, jobDescription: string): Promise<JobMatchResult>;
  tailorResume(
    resumeText: string,
    jobDescription: string,
    targetPosition: string
  ): Promise<TailoringResult>;
  generateInterviewQuestions(
    resumeText: string,
    jobDescription: string,
    targetPosition: string,
    company: string
  ): Promise<InterviewQuestionsResult>;
  evaluateAnswer(input: AnswerFeedbackInput): Promise<AnswerFeedbackResult>;
}