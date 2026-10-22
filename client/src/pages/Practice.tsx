import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import * as jobMatchService from "../services/jobMatchService";
import * as interviewPrepService from "../services/interviewPrepService";
import * as practiceService from "../services/practiceService";
import type { MatchOptionResume, MatchOptionApplication } from "../types/jobMatch.types";
import type {
  InterviewSet,
  InterviewQuestion,
  QuestionCategory,
} from "../types/interviewPrep.types";
import type { PracticeAttempt, WeakAreas } from "../types/practice.types";

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  HR: "HR",
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  PROJECT: "Project",
  ROLE_SPECIFIC: "Role-specific",
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function PracticePage() {
  const [resumes, setResumes] = useState<MatchOptionResume[]>([]);
  const [applications, setApplications] = useState<MatchOptionApplication[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [interviewSet, setInterviewSet] = useState<InterviewSet | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [weakAreas, setWeakAreas] = useState<WeakAreas | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadWeakAreas() {
    practiceService
      .getWeakAreas()
      .then((res) => setWeakAreas(res.weakAreas))
      .catch(() => setWeakAreas(null));
  }

  useEffect(() => {
    jobMatchService
      .getMatchOptions()
      .then((res) => {
        setResumes(res.resumes);
        setApplications(res.applications);
        const defaultResume = res.resumes.find((r) => r.isDefault);
        if (defaultResume) setSelectedResumeId(defaultResume.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoadingOptions(false));
    loadWeakAreas();
  }, []);

  useEffect(() => {
    setSelectedQuestion(null);
    if (!selectedResumeId || !selectedApplicationId) {
      setInterviewSet(null);
      return;
    }
    interviewPrepService
      .getInterviewPrep(selectedResumeId, selectedApplicationId)
      .then((res) => setInterviewSet(res.interviewSet))
      .catch(() => setInterviewSet(null));
  }, [selectedResumeId, selectedApplicationId]);

  useEffect(() => {
    setAnswer("");
    setAttempts([]);
    setError(null);
    if (!selectedQuestion) return;
    practiceService
      .getAttempts(selectedQuestion.id)
      .then((res) => setAttempts(res.attempts))
      .catch(() => setAttempts([]));
  }, [selectedQuestion]);

  async function handleSubmit() {
    if (!selectedQuestion) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await practiceService.submitAttempt(selectedQuestion.id, answer);
      setAttempts((previous) => [res.attempt, ...previous]);
      loadWeakAreas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check your answer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const latest = attempts[0];
  const olderAttempts = attempts.slice(1);
  const words = countWords(answer);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">Interview Practice</h1>
        <p className="text-sm text-slate-500 mb-6">
          Feedback here is a structural check, not a judgement of whether your answer is good. It
          looks at length, specifics, and whether your answer covers the parts the question needs.
          Use it as a checklist, and trust your own judgment too.
        </p>

        {weakAreas && weakAreas.questionsPracticed > 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 mb-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-2">
              Your practice so far ({weakAreas.questionsPracticed} question
              {weakAreas.questionsPracticed === 1 ? "" : "s"})
            </h2>
            <ul className="text-sm text-slate-400 space-y-0.5 mb-2">
              {weakAreas.categories.map((c) => (
                <li key={c.category}>
                  {CATEGORY_LABELS[c.category]}: {c.questionsPracticed} practiced, {c.passRate}% of
                  checks met
                </li>
              ))}
            </ul>
            {weakAreas.weakChecks.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-yellow-400 mb-1">Worth working on</h3>
                <ul className="text-sm text-slate-400 list-disc list-inside space-y-0.5">
                  {weakAreas.weakChecks.map((w) => (
                    <li key={`${w.category}-${w.checkKey}`}>
                      {w.label}: missed in {w.missed} of {w.outOf}{" "}
                      {CATEGORY_LABELS[w.category].toLowerCase()} answers
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Weak areas show up once you've practiced at least 3 questions in a category and
                missed the same check twice. It uses your latest attempt on each question.
              </p>
            )}
          </div>
        )}

        {isLoadingOptions && <p className="text-slate-400">Loading...</p>}

        {!isLoadingOptions && resumes.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
            <p className="text-slate-300">Upload a resume first to practice.</p>
          </div>
        )}

        {!isLoadingOptions && resumes.length > 0 && applications.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
            <p className="text-slate-300 mb-1">No applications with a job description yet.</p>
            <p className="text-slate-500 text-sm">
              Add a job description to an application, then generate questions on the Interview
              Prep page.
            </p>
          </div>
        )}

        {!isLoadingOptions && resumes.length > 0 && applications.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Resume</label>
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2"
                >
                  <option value="">Select a resume</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fileName}
                      {r.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Application</label>
                <select
                  value={selectedApplicationId}
                  onChange={(e) => setSelectedApplicationId(e.target.value)}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2"
                >
                  <option value="">Select an application</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.position} — {a.company}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedResumeId && selectedApplicationId && !interviewSet && (
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
                <p className="text-slate-300 mb-2">No questions for this pair yet.</p>
                <Link to="/interview-prep" className="text-sm text-blue-400 hover:text-blue-300">
                  Generate them on the Interview Prep page
                </Link>
              </div>
            )}

            {interviewSet && !selectedQuestion && (
              <div>
                <h2 className="text-sm font-semibold text-slate-300 mb-2">
                  Pick a question to practice
                </h2>
                <ul className="space-y-2">
                  {interviewSet.questions.map((q) => (
                    <li key={q.id}>
                      <button
                        onClick={() => setSelectedQuestion(q)}
                        className="w-full text-left bg-slate-800 border border-slate-700 hover:border-slate-500 rounded p-3"
                      >
                        <span className="text-xs text-blue-400">
                          {CATEGORY_LABELS[q.category]}
                        </span>
                        <p className="text-sm text-slate-200">{q.question}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedQuestion && (
              <div className="space-y-5">
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  &larr; All questions
                </button>

                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <span className="text-xs text-blue-400">
                    {CATEGORY_LABELS[selectedQuestion.category]}
                  </span>
                  <p className="text-slate-200 mb-2">{selectedQuestion.question}</p>
                  <details>
                    <summary className="text-xs text-blue-400 cursor-pointer">
                      Suggested answer structure
                    </summary>
                    <p className="text-sm text-slate-400 mt-1">
                      {selectedQuestion.answerStructure}
                    </p>
                  </details>
                </div>

                <div>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer as you would say it out loud..."
                    className="w-full h-48 rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-500">{words} words</span>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || answer.trim().length === 0}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      {isSubmitting ? "Checking..." : "Check my answer"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded bg-red-900/30 border border-red-700 p-4 text-red-300">
                    {error}
                  </div>
                )}

                {latest && (
                  <div className="bg-slate-800 border border-slate-700 rounded p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-semibold text-slate-300">
                        Latest feedback ({new Date(latest.createdAt).toLocaleString()})
                      </h3>
                      <span className="text-sm text-slate-400">
                        {latest.passedCount} of {latest.totalCount} checks met
                      </span>
                    </div>

                    {latest.strengths.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-green-400 mb-1">Went well</h4>
                        <ul className="text-sm text-slate-300 list-disc list-inside space-y-0.5">
                          {latest.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {latest.improvements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-400 mb-1">
                          To improve
                        </h4>
                        <ul className="text-sm text-slate-300 list-disc list-inside space-y-0.5">
                          {latest.improvements.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {latest.improvements.length === 0 && (
                      <p className="text-sm text-slate-400">
                        Every check was met. A real interviewer may still ask follow-ups, so
                        practice saying it out loud.
                      </p>
                    )}

                    {latest.notes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-blue-400 mb-1">A note</h4>
                        <ul className="text-sm text-slate-400 list-disc list-inside space-y-0.5">
                          {latest.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {olderAttempts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">
                      Earlier attempts ({olderAttempts.length})
                    </h3>
                    <ul className="space-y-2">
                      {olderAttempts.map((a) => (
                        <li key={a.id} className="bg-slate-800 border border-slate-700 rounded p-3">
                          <details>
                            <summary className="text-sm text-slate-300 cursor-pointer">
                              {new Date(a.createdAt).toLocaleString()} — {a.passedCount} of{" "}
                              {a.totalCount} checks met, {a.wordCount} words
                            </summary>
                            <p className="text-sm text-slate-400 mt-2 whitespace-pre-wrap">
                              {a.answer}
                            </p>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}