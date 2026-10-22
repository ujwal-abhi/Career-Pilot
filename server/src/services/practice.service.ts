import prisma from "../config/db";
import { evaluateAnswerText } from "./ai/ai.service";
import { CHECK_LABELS } from "./ai/answerEvaluation";

const MAX_ANSWER_LENGTH = 5000;
const MIN_QUESTIONS_FOR_WEAK_AREAS = 3; // per category
const MIN_MISSES_FOR_WEAK_AREA = 2;

// A question belongs to you if its set's resume belongs to you.
async function findOwnedQuestion(userId: string, questionId: string) {
  const question = await prisma.interviewQuestion.findFirst({
    where: { id: questionId, interviewSet: { resume: { userId } } },
    include: {
      interviewSet: { include: { resume: { select: { extractedText: true } } } },
    },
  });
  if (!question) {
    throw new Error("QUESTION_NOT_FOUND");
  }
  return question;
}

export async function submitAttempt(userId: string, questionId: string, rawAnswer: unknown) {
  const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";
  if (answer.length === 0) {
    throw new Error("EMPTY_ANSWER");
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    throw new Error("ANSWER_TOO_LONG");
  }

  const question = await findOwnedQuestion(userId, questionId);
  const resumeText = question.interviewSet.resume.extractedText ?? "";

  const feedback = await evaluateAnswerText({
    category: question.category,
    question: question.question,
    answer,
    resumeText,
  });

  const wordCount = answer.split(/\s+/).filter(Boolean).length;

  return prisma.practiceAttempt.create({
    data: {
      userId,
      questionId,
      answer,
      wordCount,
      ...feedback,
    },
  });
}

export async function listAttempts(userId: string, questionId: string) {
  await findOwnedQuestion(userId, questionId);
  return prisma.practiceAttempt.findMany({
    where: { userId, questionId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

interface CategoryTotals {
  questions: number;
  passed: number;
  total: number;
  misses: Map<string, number>;
}

export async function getWeakAreas(userId: string) {
  const attempts = await prisma.practiceAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      questionId: true,
      failedChecks: true,
      passedCount: true,
      totalCount: true,
      question: { select: { category: true } },
    },
  });

  // Keep only the NEWEST attempt per question, so retrying a question to improve
  // replaces the old result instead of piling up.
  const latestPerQuestion = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!latestPerQuestion.has(attempt.questionId)) {
      latestPerQuestion.set(attempt.questionId, attempt);
    }
  }

  const byCategory = new Map<string, CategoryTotals>();
  for (const attempt of latestPerQuestion.values()) {
    const category = attempt.question.category;
    const totals = byCategory.get(category) ?? {
      questions: 0,
      passed: 0,
      total: 0,
      misses: new Map<string, number>(),
    };
    totals.questions += 1;
    totals.passed += attempt.passedCount;
    totals.total += attempt.totalCount;
    for (const key of attempt.failedChecks) {
      totals.misses.set(key, (totals.misses.get(key) ?? 0) + 1);
    }
    byCategory.set(category, totals);
  }

  const categories = Array.from(byCategory.entries()).map(([category, totals]) => ({
    category,
    questionsPracticed: totals.questions,
    passRate: totals.total > 0 ? Math.round((totals.passed / totals.total) * 100) : 0,
  }));

  const weakChecks: {
    category: string;
    checkKey: string;
    label: string;
    missed: number;
    outOf: number;
  }[] = [];

  for (const [category, totals] of byCategory.entries()) {
    if (totals.questions < MIN_QUESTIONS_FOR_WEAK_AREAS) continue;
    for (const [checkKey, missed] of totals.misses.entries()) {
      if (missed < MIN_MISSES_FOR_WEAK_AREA) continue;
      weakChecks.push({
        category,
        checkKey,
        label: CHECK_LABELS[checkKey] ?? checkKey,
        missed,
        outOf: totals.questions,
      });
    }
  }

  weakChecks.sort((a, b) => b.missed / b.outOf - a.missed / a.outOf || b.missed - a.missed);

  return {
    questionsPracticed: latestPerQuestion.size,
    categories,
    weakChecks: weakChecks.slice(0, 5),
  };
}