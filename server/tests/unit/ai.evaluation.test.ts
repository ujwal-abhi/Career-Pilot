import { describe, it, expect } from "vitest";
import { evaluateAnswer } from "../../src/services/ai/answerEvaluation";
import type { AnswerFeedbackInput } from "../../src/services/ai/providers/types";

const resumeText = "Built a React and TypeScript dashboard. Skills: React, TypeScript, Node.";

function evaluate(overrides: Partial<AnswerFeedbackInput>) {
  return evaluateAnswer({
    category: "BEHAVIORAL",
    question: "Tell me about a time you solved a hard problem.",
    answer: "",
    resumeText,
    ...overrides,
  });
}

// An answer long enough (40+ words) to pass the length check, so other checks can be isolated.
const filler = "and then we kept going for a while because the work was interesting and the team was supportive ".repeat(3);

describe("checks that apply to every answer", () => {
  it("flags a too-short answer (ENOUGH_DETAIL) and passes a long enough one", () => {
    expect(evaluate({ answer: "I fixed it." }).failedChecks).toContain("ENOUGH_DETAIL");
    expect(evaluate({ answer: `I fixed it ${filler}` }).failedChecks).not.toContain("ENOUGH_DETAIL");
  });

  it("flags an answer over 300 words (CONCISE)", () => {
    const long = "word ".repeat(301);
    expect(evaluate({ answer: `I ${long}` }).failedChecks).toContain("CONCISE");
    expect(evaluate({ answer: `I ${"word ".repeat(100)}` }).failedChecks).not.toContain("CONCISE");
  });

  it("requires first person (FIRST_PERSON): \"I\" or \"I'm\" passes, \"we\" alone does not", () => {
    expect(evaluate({ answer: `We shipped it ${filler}` }).failedChecks).toContain("FIRST_PERSON");
    expect(evaluate({ answer: `I shipped it ${filler}` }).failedChecks).not.toContain("FIRST_PERSON");
    expect(evaluate({ answer: `I'm sure we shipped it ${filler}` }).failedChecks).not.toContain("FIRST_PERSON");
  });

  it("does not treat the letter i inside a word as first person", () => {
    expect(evaluate({ answer: `Teams shipped it with their skill ${filler}` }).failedChecks).toContain("FIRST_PERSON");
  });
});

describe("SPECIFICS", () => {
  it("passes with a number or a known skill, fails with neither", () => {
    expect(evaluate({ answer: `I improved things by 30 ${filler}` }).failedChecks).not.toContain("SPECIFICS");
    expect(evaluate({ answer: `I used React ${filler}` }).failedChecks).not.toContain("SPECIFICS");
    expect(evaluate({ answer: `I helped out ${filler}` }).failedChecks).toContain("SPECIFICS");
  });

  it("is not required for HR questions", () => {
    const result = evaluate({ category: "HR", question: "Tell me about yourself.", answer: `I am a developer ${filler}` });
    expect(result.failedChecks).not.toContain("SPECIFICS");
  });
});

describe("STAR structure for BEHAVIORAL and PROJECT answers", () => {
  const strong =
    "When our team had a deadline last month, I was responsible for the checkout page. " +
    "I decided to split the work, wrote the tests first and fixed the slow query using React and 3 profiling runs. " +
    "As a result the page loaded 40% faster and I learned to measure before optimizing.";

  it("passes all four STAR checks for an answer with situation, task, action and result", () => {
    const result = evaluate({ answer: `${strong} ${filler}` });
    for (const key of ["STAR_SITUATION", "STAR_TASK", "STAR_ACTION", "STAR_RESULT"]) {
      expect(result.failedChecks).not.toContain(key);
    }
  });

  it("flags each missing STAR part", () => {
    const result = evaluate({ answer: `I looked at the thing and it was fine ${filler.replace(/team|project|when|while/gi, "")}` });
    expect(result.failedChecks).toEqual(expect.arrayContaining(["STAR_TASK", "STAR_RESULT"]));
  });

  it("applies the same checks to PROJECT answers, but not to TECHNICAL ones", () => {
    const answer = `I looked at it ${filler}`;
    expect(evaluate({ category: "PROJECT", answer }).failedChecks.some((key) => key.startsWith("STAR_"))).toBe(true);
    expect(
      evaluate({ category: "TECHNICAL", question: "How have you used React?", answer }).failedChecks.some((key) =>
        key.startsWith("STAR_")
      )
    ).toBe(false);
  });
});

describe("TECHNICAL answers", () => {
  it("requires naming the technology the question asks about", () => {
    const question = "How have you used React in a project?";
    expect(evaluate({ category: "TECHNICAL", question, answer: `I built components ${filler}` }).failedChecks).toContain("NAMES_TECHNOLOGY");
    expect(evaluate({ category: "TECHNICAL", question, answer: `I built React components ${filler}` }).failedChecks).not.toContain("NAMES_TECHNOLOGY");
  });

  it("asks for reasons or a trade-off (TRADEOFFS)", () => {
    const question = "How have you used React?";
    expect(evaluate({ category: "TECHNICAL", question, answer: `I used React ${filler}` }).failedChecks).not.toContain("TRADEOFFS"); // "because" is in the filler
    expect(evaluate({ category: "TECHNICAL", question, answer: "I used React for the dashboard. It worked fine and I kept it simple in every way that mattered to the team over a long enough stretch of time to fill the word count minimum here." }).failedChecks).toContain("TRADEOFFS");
  });

  it("asks for a concrete learning plan on a get-up-to-speed question (RAMP_UP_PLAN), instead of trade-offs", () => {
    const question = "How would you get up to speed on Docker, which is new to you?";
    const vague = evaluate({ category: "TECHNICAL", question, answer: `I would learn Docker somehow ${filler}` });
    expect(vague.failedChecks).toContain("RAMP_UP_PLAN");
    expect(vague.failedChecks).not.toContain("TRADEOFFS");

    const concrete = evaluate({
      category: "TECHNICAL",
      question,
      answer: `I would read the documentation, then build a small project with Docker and ask a teammate for a review ${filler}`,
    });
    expect(concrete.failedChecks).not.toContain("RAMP_UP_PLAN");
  });
});

describe("HR and ROLE_SPECIFIC answers", () => {
  it("accepts a short answer to \"What questions do you have for us?\" but wants two real questions", () => {
    const question = "What questions do you have for us?";
    const none = evaluate({ category: "HR", question, answer: "Not really, I think it is all clear to me now." });
    expect(none.failedChecks).toContain("ASKS_QUESTIONS");
    expect(none.failedChecks).not.toContain("ENOUGH_DETAIL"); // 10 words is enough here
    const two = evaluate({ category: "HR", question, answer: "How is success measured here? What do the first three months look like?" });
    expect(two.failedChecks).not.toContain("ASKS_QUESTIONS");
  });

  it("checks that an answer about the role looks forward (LOOKS_FORWARD)", () => {
    const question = "Why are you interested in this role?";
    expect(evaluate({ category: "HR", question, answer: `I am a developer ${"and I like sandwiches ".repeat(10)}` }).failedChecks).toContain("LOOKS_FORWARD");
    expect(evaluate({ category: "HR", question, answer: `I want to grow in this role and contribute to the product ${filler}` }).failedChecks).not.toContain("LOOKS_FORWARD");
  });

  it("wants ordered steps for a ROLE_SPECIFIC answer (ORDERED_STEPS)", () => {
    const question = "How would you debug a slow page?";
    expect(evaluate({ category: "ROLE_SPECIFIC", question, answer: `I would look at it ${filler.replace(/then|first|next/gi, "")}` }).failedChecks).toContain("ORDERED_STEPS");
    expect(evaluate({ category: "ROLE_SPECIFIC", question, answer: `First I would measure, then I would check the network tab ${filler}` }).failedChecks).not.toContain("ORDERED_STEPS");
  });
});

describe("result shape and honesty note", () => {
  it("passedCount + failed checks always equals totalCount", () => {
    const result = evaluate({ answer: `I built it when the team needed a fix ${filler}` });
    expect(result.passedCount + result.failedChecks.length).toBe(result.totalCount);
  });

  it("gives at most 3 strengths and 5 improvements", () => {
    const result = evaluate({ answer: "no" });
    expect(result.strengths.length).toBeLessThanOrEqual(3);
    expect(result.improvements.length).toBeLessThanOrEqual(5);
  });

  it("adds an honesty note (not scored) when the answer mentions a skill that is not on the resume", () => {
    const result = evaluate({ answer: `I used Kubernetes and React ${filler}` });
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toContain("Kubernetes");
    expect(result.notes[0]).not.toContain("React"); // React IS on the resume
  });

  it("adds no note when every skill mentioned is on the resume", () => {
    expect(evaluate({ answer: `I used React ${filler}` }).notes).toEqual([]);
  });
});