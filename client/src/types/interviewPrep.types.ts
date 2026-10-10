export type QuestionCategory =
  | "HR"
  | "TECHNICAL"
  | "BEHAVIORAL"
  | "PROJECT"
  | "ROLE_SPECIFIC";

export interface InterviewQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  answerStructure: string;
  sortOrder: number;
}

export interface InterviewSet {
  id: string;
  resumeId: string;
  applicationId: string;
  notes: string[];
  questions: InterviewQuestion[];
  createdAt: string;
}