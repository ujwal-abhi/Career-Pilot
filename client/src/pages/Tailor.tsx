import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import * as jobMatchService from "../services/jobMatchService";
import * as tailoringService from "../services/tailoringService";
import type { MatchOptionResume, MatchOptionApplication } from "../types/jobMatch.types";
import type { Tailoring } from "../types/tailoring.types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable in some browser contexts — nothing useful to do.
    }
  }

  return (
    <button onClick={handleCopy} className="text-xs text-slate-400 hover:text-white">
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function TailorPage() {
  const [resumes, setResumes] = useState<MatchOptionResume[]>([]);
  const [applications, setApplications] = useState<MatchOptionApplication[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [tailoring, setTailoring] = useState<Tailoring | null>(null);
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
      setTailoring(null);
      return;
    }
    tailoringService
      .getTailoring(selectedResumeId, selectedApplicationId)
      .then((res) => setTailoring(res.tailoring))
      .catch(() => setTailoring(null));
  }, [selectedResumeId, selectedApplicationId]);

  async function handleGenerate() {
    setError(null);
    setIsRunning(true);
    try {
      const res = await tailoringService.runTailoring(selectedResumeId, selectedApplicationId);
      setTailoring(res.tailoring);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tailoring failed.");
    } finally {
      setIsRunning(false);
    }
  }

  const canRun = Boolean(selectedResumeId && selectedApplicationId) && !isRunning;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">Resume Tailoring</h1>
        <p className="text-sm text-slate-500 mb-6">
          Built only from content already in your resume. Bullets are your existing lines, ranked by
          relevance to the job, and are not reworded. Always review before using.
        </p>

        {isLoadingOptions && <p className="text-slate-400">Loading...</p>}

        {!isLoadingOptions && resumes.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
            <p className="text-slate-300">Upload a resume first to tailor it.</p>
          </div>
        )}

        {!isLoadingOptions && resumes.length > 0 && applications.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
            <p className="text-slate-300 mb-1">No applications with a job description yet.</p>
            <p className="text-slate-500 text-sm">
              Add a job description when creating or editing an application to tailor against it.
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
              {isRunning ? "Generating..." : tailoring ? "Regenerate" : "Generate Tailored Content"}
            </button>

            {error && (
              <div className="rounded bg-red-900/30 border border-red-700 p-4 text-red-300 mb-4">
                {error}
              </div>
            )}

            {tailoring && (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-semibold text-slate-300">Professional Summary</h3>
                    {tailoring.summary && <CopyButton text={tailoring.summary} />}
                  </div>
                  {tailoring.summary ? (
                    <p className="text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded p-3">
                      {tailoring.summary}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">Nothing could be generated safely.</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-semibold text-slate-300">Relevant Skills</h3>
                    {tailoring.skills.length > 0 && <CopyButton text={tailoring.skills.join(", ")} />}
                  </div>
                  {tailoring.skills.length === 0 ? (
                    <p className="text-sm text-slate-500">None found in both your resume and this job.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {tailoring.skills.map((skill) => (
                        <span key={skill} className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-1">
                    Your Most Relevant Bullet Points
                  </h3>
                  {tailoring.bullets.length === 0 ? (
                    <p className="text-sm text-slate-500">No matching bullet points found.</p>
                  ) : (
                    <ul className="space-y-2">
                      {tailoring.bullets.map((bullet, i) => (
                        <li
                          key={i}
                          className="flex justify-between gap-3 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded p-3"
                        >
                          <span>{bullet}</span>
                          <CopyButton text={bullet} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {tailoring.notes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-yellow-400 mb-1">Notes</h3>
                    <ul className="text-sm text-slate-400 list-disc list-inside space-y-0.5">
                      {tailoring.notes.map((note, i) => (
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