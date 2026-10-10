import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import * as jobMatchService from "../services/jobMatchService";
import * as interviewPrepService from "../services/interviewPrepService";
import type { MatchOptionResume, MatchOptionApplication } from "../types/jobMatch.types";
import type { InterviewSet, QuestionCategory } from "../types/interviewPrep.types";

const CATEGORY_ORDER: QuestionCategory[] = [
  "HR",
  "TECHNICAL",
  "BEHAVIORAL",
  "PROJECT",
  "ROLE_SPECIFIC",
];

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  HR: "HR",
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  PROJECT: "Project",
  ROLE_SPECIFIC: "Role-specific",
};

export function InterviewPrepPage() {
  const [resumes, setResumes] = useState<MatchOptionResume[]>([]);
  const [applications, setApplications] = useState<MatchOptionApplication[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [interviewSet, setInterviewSet] = useState<InterviewSet | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    if (!selectedResumeId || !selectedApplicationId) {
      setInterviewSet(null);
      return;
    }
    interviewPrepService
      .getInterviewPrep(selectedResumeId, selectedApplicationId)
      .then((res) => setInterviewSet(res.interviewSet))
      .catch(() => setInterviewSet(null));
  }, [selectedResumeId, selectedApplicationId]);

  async function handleGenerate() {
    setError(null);
    setIsRunning(true);
    try {
      const res = await interviewPrepService.runInterviewPrep(
        selectedResumeId,
        selectedApplicationId
      );
      setInterviewSet(res.interviewSet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate questions.");
    } finally {
      setIsRunning(false);
    }
  }

  const canRun = Boolean(selectedResumeId && selectedApplicationId) && !isRunning;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">Interview Prep</h1>
        <p className="text-sm text-slate-500 mb-6">
          Questions are built from your resume and the job description. Answer structures are
          general guidance, so adapt them to your real experience.
        </p>

        {isLoadingOptions && <p className="text-slate-400">Loading...</p>}

        {!isLoadingOptions && resumes.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
            <p className="text-slate-300">Upload a resume first to prepare for an interview.</p>
          </div>
        )}

        {!isLoadingOptions && resumes.length > 0 && applications.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
            <p className="text-slate-300 mb-1">No applications with a job description yet.</p>
            <p className="text-slate-500 text-sm">
              Add a job description when creating or editing an application to prepare for it.
            </p>
          </div>
        )}

        {!isLoadingOptions && resumes.length > 0 && applications.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

            <button
              onClick={handleGenerate}
              disabled={!canRun}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50 mb-6"
            >
              {isRunning ? "Generating..." : interviewSet ? "Regenerate" : "Generate Questions"}
            </button>

            {error && (
              <div className="rounded bg-red-900/30 border border-red-700 p-4 text-red-300 mb-4">
                {error}
              </div>
            )}

            {interviewSet && (
              <div className="space-y-8">
                {CATEGORY_ORDER.map((category) => {
                  const categoryQuestions = interviewSet.questions.filter(
                    (q) => q.category === category
                  );
                  if (categoryQuestions.length === 0) return null;

                  return (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">
                        {CATEGORY_LABELS[category]}{" "}
                        <span className="text-slate-500 font-normal">
                          ({categoryQuestions.length})
                        </span>
                      </h3>
                      <ul className="space-y-2">
                        {categoryQuestions.map((q) => (
                          <li
                            key={q.id}
                            className="bg-slate-800 border border-slate-700 rounded p-3"
                          >
                            <p className="text-sm text-slate-200">{q.question}</p>
                            <details className="mt-2">
                              <summary className="text-xs text-blue-400 cursor-pointer">
                                Suggested answer structure
                              </summary>
                              <p className="text-sm text-slate-400 mt-1">{q.answerStructure}</p>
                            </details>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

                {interviewSet.notes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-yellow-400 mb-1">Notes</h3>
                    <ul className="text-sm text-slate-400 list-disc list-inside space-y-0.5">
                      {interviewSet.notes.map((note, i) => (
                        <li key={i}>{note}</li>
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