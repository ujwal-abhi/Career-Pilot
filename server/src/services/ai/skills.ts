export const SKILL_KEYWORDS = [
  "javascript", "typescript", "react", "node", "express", "python", "java",
  "sql", "postgresql", "mongodb", "aws", "docker", "kubernetes", "git",
  "html", "css", "tailwind", "next.js", "rest api", "graphql", "ci/cd",
];

const DISPLAY_NAMES: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  react: "React",
  node: "Node.js",
  express: "Express",
  python: "Python",
  java: "Java",
  sql: "SQL",
  postgresql: "PostgreSQL",
  mongodb: "MongoDB",
  aws: "AWS",
  docker: "Docker",
  kubernetes: "Kubernetes",
  git: "Git",
  html: "HTML",
  css: "CSS",
  tailwind: "Tailwind",
  "next.js": "Next.js",
  "rest api": "REST APIs",
  graphql: "GraphQL",
  "ci/cd": "CI/CD",
};

export function displayName(skill: string): string {
  return DISPLAY_NAMES[skill] ?? skill;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-term match: "java" must NOT match inside "javascript".
// The optional trailing "s" lets "REST API" match "REST APIs".
export function containsTerm(text: string, term: string): boolean {
  const pattern = new RegExp(
    `(?<![a-z0-9])${escapeRegExp(term.toLowerCase())}s?(?![a-z0-9])`
  );
  return pattern.test(text.toLowerCase());
}

export function findSkills(text: string): string[] {
  return SKILL_KEYWORDS.filter((skill) => containsTerm(text, skill));
}