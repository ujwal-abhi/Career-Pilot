import type { QuestionCategory } from "./interviewPrep.types";

export interface PracticeAttempt {
  id: string;
  questionId: string;
  answer: string;
  wordCount: number;
  strengths: string[];
  improvements: string[];
  notes: string[];
  failedChecks: string[];
  passedCount: number;
  totalCount: number;
  createdAt: string;
}

export interface WeakAreas {
  questionsPracticed: number;
  categories: {
    category: QuestionCategory;
    questionsPracticed: number;
    passRate: number;
  }[];
  weakChecks: {
    category: QuestionCategory;
    checkKey: string;
    label: string;
    missed: number;
    outOf: number;
  }[];
}