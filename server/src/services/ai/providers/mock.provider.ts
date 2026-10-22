import type {
  AIProvider,
  ResumeAnalysisResult,
  JobMatchResult,
  TailoringResult,
  InterviewQuestionsResult,
  InterviewQuestionItem,
  AnswerFeedbackInput,
  AnswerFeedbackResult,
} from "./types";
import { containsTerm, findSkills, displayName } from "../skills";
import { ACTION_VERBS, extractBullets, splitSentences } from "../text";
import { evaluateAnswer as evaluateAnswerRules } from "../answerEvaluation";

const SECTION_HEADERS = ["experience", "education", "skills", "projects", "summary"];

// Words that suggest a job-description sentence describes a responsibility.
const RESPONSIBILITY_CUE =
  /\b(responsible|you will|you'll|own|build|design|develop|collaborate|manage|lead|maintain|ship)\b/i;

const STAR_STRUCTURE =
  "STAR: Situation (brief context), Task (what you were responsible for), Action (what you specifically did, say 'I' rather than 'we'), Result (the outcome, with numbers only if you honestly have them). If you don't have a work example, a school or personal project is fine.";

function countMatches(text: string, terms: string[]): number {
  return terms.filter((term) => containsTerm(text, term)).length;
}

function scaleScore(matchCount: number, maxExpected: number): number {
  const raw = Math.round((matchCount / maxExpected) * 100);
  return Math.min(100, Math.max(40, raw)); // floor of 40 so a thin resume isn't a brutal 0
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export class MockAIProvider implements AIProvider {
  async analyzeResume(resumeText: string): Promise<ResumeAnalysisResult> {
    const skillMatches = findSkills(resumeText).length;
    const keywordMatches = countMatches(resumeText, ACTION_VERBS);
    const sectionMatches = countMatches(resumeText, SECTION_HEADERS);
    const hasYearRange = /20\d{2}/.test(resumeText);
    const hasProjectMention = /project/i.test(resumeText);
    const wordCount = resumeText.trim().split(/\s+/).length;

    const skillsScore = scaleScore(skillMatches, 8);
    const keywordsScore = scaleScore(keywordMatches, 6);
    const experienceScore = scaleScore(
      (hasYearRange ? 1 : 0) + countMatches(resumeText, ["experience", "worked", "internship"]),
      3
    );
    const projectsScore = hasProjectMention
      ? scaleScore(countMatches(resumeText, ["project"]) + 1, 2)
      : 40;
    const atsScore = scaleScore(
      sectionMatches + (wordCount > 150 && wordCount < 1200 ? 1 : 0),
      6
    );

    const overallScore = Math.round(
      (skillsScore + experienceScore + projectsScore + keywordsScore + atsScore) / 5
    );

    const strengths: string[] = [];
    const improvements: string[] = [];

    if (skillsScore >= 70) strengths.push("Strong presence of relevant technical skills.");
    else improvements.push("Consider explicitly listing more relevant technical skills.");

    if (keywordsScore >= 70) strengths.push("Good use of strong action verbs describing your work.");
    else improvements.push('Try starting bullet points with action verbs like "built", "led", or "improved".');

    if (hasYearRange) strengths.push("Clear timeline of experience with dates.");
    else improvements.push("Add clear date ranges for your work experience.");

    if (atsScore >= 70) strengths.push("Resume structure includes standard sections, which helps ATS parsing.");
    else improvements.push("Add clearly labeled sections (Experience, Education, Skills, Projects) to improve ATS readability.");

    return {
      overallScore,
      skillsScore,
      experienceScore,
      projectsScore,
      keywordsScore,
      atsScore,
      strengths,
      improvements,
    };
  }

  async matchResumeToJob(resumeText: string, jobDescription: string): Promise<JobMatchResult> {
    const jobSkills = findSkills(jobDescription);
    const resumeSkills = findSkills(resumeText);

    const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
    const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));

    const matchScore =
      jobSkills.length > 0
        ? Math.round((matchedSkills.length / jobSkills.length) * 100)
        : 50; // the job description didn't mention any skill we recognize, so overlap can't be scored meaningfully

    const relevantExperience: string[] = [];
    const potentialGaps: string[] = [];
    const recommendations: string[] = [];

    if (matchedSkills.length > 0) {
      relevantExperience.push(
        `Your resume shows experience with ${matchedSkills.slice(0, 5).join(", ")}, which this role asks for.`
      );
    } else {
      relevantExperience.push(
        "No direct skill keyword overlap was detected between your resume and this job description."
      );
    }

    if (missingSkills.length > 0) {
      potentialGaps.push(
        `This role mentions ${missingSkills.join(", ")}, which weren't found in your resume.`
      );
      recommendations.push(
        `Consider adding or highlighting experience with: ${missingSkills.join(", ")}.`
      );
    } else if (jobSkills.length > 0) {
      recommendations.push("Your resume already covers every specific skill this job description mentions.");
    }

    if (matchScore < 50) {
      recommendations.push(
        "This may be a stretch role based on keyword overlap alone. Use your own judgment alongside this score."
      );
    }

    return {
      matchScore,
      matchedSkills,
      missingSkills,
      relevantExperience,
      potentialGaps,
      recommendations,
    };
  }

  async tailorResume(
    resumeText: string,
    jobDescription: string,
    targetPosition: string
  ): Promise<TailoringResult> {
    const jobSkills = findSkills(jobDescription);
    const resumeSkills = findSkills(resumeText);

    // Only skills present in BOTH the resume and the job description.
    const skills = jobSkills.filter((skill) => resumeSkills.includes(skill));

    const notes: string[] = [];

    let summary = "";
    if (skills.length > 0) {
      summary = `Seeking a ${targetPosition} role, bringing skills in ${formatList(skills.slice(0, 5))}.`;
    } else {
      notes.push(
        "No skills from this job description were found in your resume, so no summary or skills list could be built without inventing something."
      );
    }

    // Existing resume lines, ranked by how many of the job's skills they mention.
    const bullets = extractBullets(resumeText)
      .map((text) => ({
        text,
        score: findSkills(text).filter((skill) => jobSkills.includes(skill)).length,
      }))
      .filter((bullet) => bullet.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((bullet) => bullet.text);

    if (bullets.length === 0 && skills.length > 0) {
      notes.push(
        "None of your bullet points mention skills from this job description (or your PDF's bullet lines couldn't be detected. Wrapped or unusually formatted lines can hide them)."
      );
    }

    return { summary, skills, bullets, notes };
  }

  async generateInterviewQuestions(
    resumeText: string,
    jobDescription: string,
    targetPosition: string,
    company: string
  ): Promise<InterviewQuestionsResult> {
    const jobSkills = findSkills(jobDescription);
    const resumeSkills = findSkills(resumeText);
    const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
    const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));

    const questions: InterviewQuestionItem[] = [];
    const notes: string[] = [];

    // ---- HR: generic, assume nothing about your experience ----
    questions.push(
      {
        category: "HR",
        question: "Tell me about yourself.",
        answerStructure:
          "Present, past, future: start with what you do now, connect it to the experience or projects that got you here, then say why this role is the logical next step. Keep it under two minutes.",
      },
      {
        category: "HR",
        question: `Why are you interested in the ${targetPosition} role at ${company}?`,
        answerStructure:
          "Three parts: what attracts you about the role itself, what you know about the company (research it first), and how your background fits. Be specific rather than flattering.",
      },
      {
        category: "HR",
        question: "What are you looking for in your next role?",
        answerStructure:
          "Name two or three things that matter to you (learning, ownership, team, impact) and tie each one back to something this role offers.",
      },
      {
        category: "HR",
        question: "What questions do you have for us?",
        answerStructure:
          "Prepare two or three genuine questions about the team, how success is measured, or what the first months look like. Avoid asking about things easily found online.",
      }
    );

    // ---- Technical: skills on BOTH sides get a "you used it" question;
    //      skills only in the job get a "how would you ramp up" question ----
    for (const skill of matchedSkills.slice(0, 4)) {
      questions.push({
        category: "TECHNICAL",
        question: `You've listed ${displayName(skill)} on your resume. Can you describe a situation where you used it, and why it was a good fit?`,
        answerStructure:
          "Say what it is in one sentence, describe one real situation where you used it, explain why it fit, and mention one trade-off or something you would do differently.",
      });
    }

    for (const skill of missingSkills.slice(0, 2)) {
      questions.push({
        category: "TECHNICAL",
        question: `This role involves ${displayName(skill)}. How familiar are you with it, and if it's new to you, how would you get up to speed?`,
        answerStructure:
          "Be honest about your current level. Mention the closest related experience you do have, then give a concrete plan for getting productive (documentation, a small project, who you would ask).",
      });
    }

    questions.push({
      category: "TECHNICAL",
      question: "How do you approach debugging a problem you haven't seen before?",
      answerStructure:
        "Reproduce it, narrow down where it happens, form a hypothesis, test it, fix it, then add a check so it doesn't come back.",
    });

    if (jobSkills.length === 0) {
      notes.push(
        "This job description doesn't mention any skills this app recognizes, so the technical questions are generic."
      );
    }

    // ---- Behavioral: standard STAR-style questions ----
    const behavioralQuestions = [
      "Tell me about a time you had to deliver something under a tight deadline.",
      "Tell me about a time you disagreed with a teammate. How did you handle it?",
      "Tell me about a mistake you made and what you learned from it.",
      "Tell me about a time you had to learn something new quickly.",
    ];
    for (const question of behavioralQuestions) {
      questions.push({ category: "BEHAVIORAL", question, answerStructure: STAR_STRUCTURE });
    }

    // ---- Project: quotes YOUR OWN resume lines, so it cannot invent a project ----
    const projectBullets = extractBullets(resumeText)
      .map((text) => ({
        text,
        score: findSkills(text).filter((skill) => jobSkills.includes(skill)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const bullet of projectBullets) {
      questions.push({
        category: "PROJECT",
        question: `Your resume says: "${bullet.text}" Can you walk me through what you personally did and the result?`,
        answerStructure:
          "Context and goal, then your specific role, the key decisions and trade-offs, the result, and what you would improve. Only claim what you actually did, and be ready for follow-up questions on any detail.",
      });
    }

    if (projectBullets.length === 0) {
      notes.push(
        "No project questions were generated because no bullet-style lines were detected in your resume PDF."
      );
    }

    // ---- Role-specific: built from the job description itself ----
    questions.push({
      category: "ROLE_SPECIFIC",
      question: `What would you focus on in your first 30 days as a ${targetPosition} at ${company}?`,
      answerStructure:
        "Learn, then deliver: spend the first weeks understanding the codebase, team, and priorities, agree on a small first deliverable, and say how you would check you're on track.",
    });

    const jobSentences = splitSentences(jobDescription)
      .filter((sentence) => {
        const wordCount = sentence.split(/\s+/).length;
        return (
          wordCount >= 6 &&
          wordCount <= 35 &&
          (findSkills(sentence).length > 0 || RESPONSIBILITY_CUE.test(sentence))
        );
      })
      .slice(0, 2);

    for (const sentence of jobSentences) {
      questions.push({
        category: "ROLE_SPECIFIC",
        question: `The job description mentions: "${sentence}" How would you approach this?`,
        answerStructure:
          "Restate the requirement in your own words, describe how you would break it down, name the first concrete step, and say how you would know it worked. If it's new to you, say so and explain how you would ramp up.",
      });
    }

    return { questions, notes };
  }

  async evaluateAnswer(input: AnswerFeedbackInput): Promise<AnswerFeedbackResult> {
    return evaluateAnswerRules(input);
  }
}