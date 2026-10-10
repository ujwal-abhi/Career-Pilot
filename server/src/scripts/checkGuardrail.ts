import { validateTailoringResult } from "../services/ai/validateAnalysis";

const resumeText = `Skills: React, TypeScript, Git
- Built a dashboard in React that reduced load time by 30%`;

// Pretend a real LLM returned this. Several items are invented.
const fakeLlmOutput = {
  summary: "Seeking a Frontend role, bringing skills in React and Kubernetes.",
  skills: ["react", "kubernetes", "typescript"],
  bullets: [
    "Built a dashboard in React that reduced load time by 30%",
    "Led a team of 12 engineers to deliver a 300% revenue increase",
    "Deployed services on Kubernetes",
  ],
  notes: [],
};

console.log(validateTailoringResult(fakeLlmOutput, resumeText));