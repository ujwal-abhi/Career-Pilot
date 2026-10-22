import type { AnswerFeedbackInput, AnswerFeedbackResult } from "./providers/types";
import { containsTerm, findSkills, displayName } from "./skills";
import { ACTION_VERBS } from "./text";

// Human-readable names for every check. The keys are also stored on each attempt
// (as "failedChecks"), which is what lets us spot weak areas across attempts.
export const CHECK_LABELS: Record<string, string> = {
  ENOUGH_DETAIL: "Enough detail",
  CONCISE: "Concise answer",
  FIRST_PERSON: 'Says what you did ("I")',
  SPECIFICS: "Concrete specifics",
  STAR_SITUATION: "Sets the scene (situation)",
  STAR_TASK: "States your goal or responsibility (task)",
  STAR_ACTION: "Describes your actions",
  STAR_RESULT: "Describes the result or lesson",
  NAMES_TECHNOLOGY: "Names the technology",
  TRADEOFFS: "Gives reasons or trade-offs",
  RAMP_UP_PLAN: "Gives a concrete learning plan",
  LOOKS_FORWARD: "Connects to the role or your goals",
  ASKS_QUESTIONS: "Asks real questions",
  ORDERED_STEPS: "Walks through steps in order",
};

interface Check {
  key: string;
  passed: boolean;
  strength: string;
  improvement: string;
}

const MIN_WORDS = 40;
const MIN_WORDS_FOR_QUESTIONS_ANSWER = 10;
const MAX_WORDS = 300;

const EXTRA_ACTION_CUES = [
  "decided", "chose", "wrote", "fixed", "asked", "talked", "proposed", "tested",
  "planned", "organized", "organised", "reviewed", "learned", "started", "split",
  "refactored", "debugged", "presented", "explained", "set up", "rewrote", "broke down",
];

const RESULT_CUES = [
  "result", "resulted", "outcome", "as a result", "in the end", "ended up",
  "which led", "led to", "learned", "lesson", "takeaway", "went on to", "thanks to",
];

const RAMP_UP_CUES = [
  "documentation", "docs", "tutorial", "course", "small project", "side project",
  "prototype", "practice", "mentor", "pair", "ask", "read", "hands-on", "sandbox",
  "build", "experiment", "official guide",
];

const ORDER_CUES = [
  "first", "then", "next", "after that", "finally", "step", "start by", "begin by",
  "second", "third", "before", "plan", "prioritize", "prioritise", "break down",
  "measure", "verify", "check",
];

const SITUATION_PATTERN =
  /\b(when|while|during|at the time|last (year|semester|summer|month)|once|back then|internship|college|university|class|course|deadline|our team|my team|the team|project|client|company)\b/i;
const TASK_PATTERN =
  /\b(responsible|my role|my task|my job|goal|needed to|need to|had to|was asked|was assigned|objective|supposed to|aimed to|tasked|owned)\b/i;
const TRADEOFF_PATTERN =
  /\b(trade-?offs?|because|instead of|rather than|however|downside|drawbacks?|alternatives?|chose|compared (to|with)|versus|so that)\b/i;
const FORWARD_PATTERN =
  /\b(role|team|company|opportunit\w*|looking for|want to|excited|interested|grow|learn|contribute|next step|mission|product)\b/i;
const FIRST_PERSON_PATTERN = /\bi\b|\bi['\u2019](m|ve|d|ll)\b/i;

function countCues(text: string, cues: string[]): number {
  return cues.filter((cue) => containsTerm(text, cue)).length;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function evaluateAnswer(input: AnswerFeedbackInput): AnswerFeedbackResult {
  const { category, question, answer, resumeText } = input;
  const words = wordCount(answer);

  const isAskQuestionsPrompt = /what questions do you have/i.test(question);
  const isRampUpPrompt = /get up to speed|new to you/i.test(question);
  const minWords = isAskQuestionsPrompt ? MIN_WORDS_FOR_QUESTIONS_ANSWER : MIN_WORDS;

  const checks: Check[] = [];

  // ---- Checks that apply to every answer ----
  checks.push({
    key: "ENOUGH_DETAIL",
    passed: words >= minWords,
    strength: "You gave enough detail to work with.",
    improvement: `Your answer is quite short (${words} words). Aim for roughly 80 to 200 words so you have room for context, what you did, and the outcome.`,
  });

  checks.push({
    key: "CONCISE",
    passed: words <= MAX_WORDS,
    strength: "Your answer is a good length to say out loud.",
    improvement: `Your answer is long (${words} words). In an interview, aim for about two minutes, which is roughly 200 to 250 words. Cut background that doesn't support your point.`,
  });

  if (!isAskQuestionsPrompt) {
    checks.push({
      key: "FIRST_PERSON",
      passed: FIRST_PERSON_PATTERN.test(answer),
      strength: "You spoke about your own actions.",
      improvement:
        'Say what you personally did ("I built...", "I decided...") rather than only "we". Interviewers are assessing you, and can follow up on any detail.',
    });
  }

  if (category !== "HR") {
    checks.push({
      key: "SPECIFICS",
      passed: /\d/.test(answer) || findSkills(answer).length > 0,
      strength: "You included concrete specifics.",
      improvement:
        "Add a concrete detail: a tool you used, a number, or a named example. Only include numbers you can honestly stand behind.",
    });
  }

  // ---- Behavioral and project answers: STAR structure ----
  if (category === "BEHAVIORAL" || category === "PROJECT") {
    checks.push({
      key: "STAR_SITUATION",
      passed: SITUATION_PATTERN.test(answer),
      strength: "You set the scene before diving in.",
      improvement:
        "Open with the situation in a sentence or two: where it happened and what was going on.",
    });
    checks.push({
      key: "STAR_TASK",
      passed: TASK_PATTERN.test(answer),
      strength: "You made your goal or responsibility clear.",
      improvement:
        "State what you were responsible for or trying to achieve, so the interviewer knows what 'success' meant.",
    });
    checks.push({
      key: "STAR_ACTION",
      passed: countCues(answer, [...ACTION_VERBS, ...EXTRA_ACTION_CUES]) > 0,
      strength: "You described concrete actions you took.",
      improvement:
        "Spend most of your answer on the steps you took, using action verbs like built, decided, tested, or fixed.",
    });
    checks.push({
      key: "STAR_RESULT",
      passed: countCues(answer, RESULT_CUES) > 0 || /\d+\s?%/.test(answer),
      strength: "You closed with a result or lesson.",
      improvement:
        "End with the outcome or what you learned. If you don't have a measurable result, a lesson learned works well.",
    });
  }

  // ---- Technical answers ----
  if (category === "TECHNICAL") {
    const questionSkills = findSkills(question);
    if (questionSkills.length > 0) {
      const named = questionSkills.map(displayName).join(" or ");
      checks.push({
        key: "NAMES_TECHNOLOGY",
        passed: questionSkills.some((skill) => containsTerm(answer, skill)),
        strength: "You named the technology you were asked about.",
        improvement: `Name ${named} explicitly in your answer so it's clear what you're talking about.`,
      });
    }

    if (isRampUpPrompt) {
      checks.push({
        key: "RAMP_UP_PLAN",
        passed: countCues(answer, RAMP_UP_CUES) >= 2,
        strength: "You gave a concrete plan for getting up to speed.",
        improvement:
          "Be specific about how you would learn it: for example, read the official documentation, build a small project, and ask a teammate to review it.",
      });
    } else {
      checks.push({
        key: "TRADEOFFS",
        passed: TRADEOFF_PATTERN.test(answer),
        strength: "You explained your reasoning or a trade-off.",
        improvement:
          "Explain why you made that choice and mention one trade-off or alternative. That's usually what the follow-up question will be.",
      });
    }
  }

  // ---- HR answers ----
  if (category === "HR") {
    if (isAskQuestionsPrompt) {
      checks.push({
        key: "ASKS_QUESTIONS",
        passed: (answer.match(/\?/g) ?? []).length >= 2,
        strength: "You came with real questions.",
        improvement:
          "Write at least two genuine questions, such as how success is measured or what the first months look like.",
      });
    } else if (/interested in|next role/i.test(question)) {
      checks.push({
        key: "LOOKS_FORWARD",
        passed: FORWARD_PATTERN.test(answer),
        strength: "You connected your answer to the role or your goals.",
        improvement:
          "Tie your answer to the role itself: what attracts you to it, and how it fits what you want to do next.",
      });
    }
  }

  // ---- Role-specific answers ----
  if (category === "ROLE_SPECIFIC") {
    checks.push({
      key: "ORDERED_STEPS",
      passed: countCues(answer, ORDER_CUES) >= 2,
      strength: "You laid out your approach in a clear order.",
      improvement:
        "Walk through your approach in order: what you would do first, what comes next, and how you would know it worked.",
    });
  }

  const failed = checks.filter((check) => !check.passed);
  const passed = checks.filter((check) => check.passed);

  // ---- Honesty note (not scored): skills mentioned that aren't on the resume ----
  const notes: string[] = [];
  const unlisted = findSkills(answer).filter((skill) => !containsTerm(resumeText, skill));
  if (unlisted.length > 0) {
    notes.push(
      `Your answer mentions ${unlisted.map(displayName).join(", ")}, which isn't on your resume. That's fine if you're describing how you'd learn it. If it could sound like experience you haven't had, make that clear, because interviewers often follow up on exactly this.`
    );
  }

  return {
    strengths: passed.slice(0, 3).map((check) => check.strength),
    improvements: failed.slice(0, 5).map((check) => check.improvement),
    failedChecks: failed.map((check) => check.key),
    passedCount: passed.length,
    totalCount: checks.length,
    notes,
  };
}