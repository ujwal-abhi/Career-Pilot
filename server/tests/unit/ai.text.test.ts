import { describe, it, expect } from "vitest";
import { containsTerm, findSkills, displayName } from "../../src/services/ai/skills";
import { extractBullets, splitSentences } from "../../src/services/ai/text";

describe("containsTerm (whole-word skill matching)", () => {
  it("does not find java inside javascript", () => {
    expect(containsTerm("I write JavaScript every day", "java")).toBe(false);
    expect(containsTerm("I write Java every day", "java")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(containsTerm("REACT and Node", "react")).toBe(true);
  });

  it("lets REST API match REST APIs", () => {
    expect(containsTerm("Designed REST APIs for billing", "rest api")).toBe(true);
  });

  it("handles terms with punctuation: next.js and ci/cd", () => {
    expect(containsTerm("Built with Next.js", "next.js")).toBe(true);
    expect(containsTerm("Set up CI/CD pipelines", "ci/cd")).toBe(true);
    expect(containsTerm("Built with nextxjs", "next.js")).toBe(false);
  });

  it("does not match inside a longer word", () => {
    expect(containsTerm("reactive programming", "react")).toBe(false);
    expect(containsTerm("sqlite", "sql")).toBe(false);
  });

  it("matches at the start, end and next to punctuation", () => {
    expect(containsTerm("react", "react")).toBe(true);
    expect(containsTerm("Skills: React, Node.", "react")).toBe(true);
    expect(containsTerm("Skills: React, Node.", "node")).toBe(true);
  });
});

describe("findSkills / displayName", () => {
  it("finds every known skill mentioned, once each", () => {
    expect(findSkills("React and TypeScript with PostgreSQL, React again")).toEqual(["typescript", "react", "postgresql"]);
  });

  it("finds nothing in text with no skills", () => {
    expect(findSkills("I like hiking and cooking")).toEqual([]);
  });

  it("shows readable names, and passes unknown skills through", () => {
    expect(displayName("javascript")).toBe("JavaScript");
    expect(displayName("rest api")).toBe("REST APIs");
    expect(displayName("rust")).toBe("rust");
  });
});

describe("extractBullets", () => {
  const resume = [
    "EXPERIENCE",
    "• Built a dashboard with React and TypeScript for 200 users",
    "- Reduced page load time by 40% after moving to code splitting",
    "Led a team of three developers on the checkout redesign",
    "Skills: React, Node",
    "Too short bullet",
    "• Built a dashboard with React and TypeScript for 200 users",
    "",
    "Went to the store on Sunday and bought some milk today",
  ].join("\n");

  it("keeps lines that start with a bullet or an action verb, as written, without the marker", () => {
    expect(extractBullets(resume)).toEqual([
      "Built a dashboard with React and TypeScript for 200 users",
      "Reduced page load time by 40% after moving to code splitting",
      "Led a team of three developers on the checkout redesign",
    ]);
  });

  it("drops headings, short lines, duplicates and ordinary sentences", () => {
    const bullets = extractBullets(resume);
    expect(bullets).not.toContain("EXPERIENCE");
    expect(bullets.filter((line) => line.startsWith("Built a dashboard"))).toHaveLength(1);
    expect(bullets.some((line) => line.includes("milk"))).toBe(false);
  });

  it("handles Windows line endings", () => {
    expect(extractBullets("• Built a small internal tool used by the whole team\r\n• Improved the build time of the main app a lot")).toHaveLength(2);
  });

  it("returns an empty list for empty text", () => {
    expect(extractBullets("")).toEqual([]);
  });
});

describe("splitSentences", () => {
  it("splits on sentence ends and line breaks, and strips bullet markers", () => {
    expect(splitSentences("We build apps. You will help!\n• Write tests\n- Review code")).toEqual([
      "We build apps.",
      "You will help!",
      "Write tests",
      "Review code",
    ]);
  });

  it("does not split inside next.js or 3.5", () => {
    expect(splitSentences("We use Next.js and version 3.5 daily.")).toEqual(["We use Next.js and version 3.5 daily."]);
  });
});