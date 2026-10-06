import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import * as jobMatchService from "../services/jobMatchService";
import type { JobMatch, MatchOptionResume, MatchOptionApplication } from "../types/jobMatch.types";

export function JobMatchPage() {
  const [resumes, setResumes] = useState<MatchOptionResume[]>([]);
  const [applications, setApplications] = useState<MatchOptionApplication[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [match, setMatch] = useState<JobMatch | null>(null);
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
      setMatch(null);
      return;
    }
    jobMatchService
      .getJobMatch(selectedResumeId, selectedApplicationId)
      .then((res) => setMatch(res.match))
      .catch(() => setMatch(null));
  }, [selectedResumeId, selectedApplicationId]);

  async function handleRunMatch() {
    setError(null);
    setIsRunning(true);
    try {
      const res = await jobMatchService.runJobMatch(selectedResumeId, selectedApplicationId);
      setMatch(res.match);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match analysis failed.");
    } finally {
      setIsRunning(false);
    }
  }

  const canRun = Boolean(selectedResumeId && selectedApplicationId) && !isRunning;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">Job Match Analysis</h1>

        {isLoadingOptions && <p className="text-slate-400">Loading...</p>}

        {!isLoadingOptions && resumes.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
            <p className="text-slate-300">Upload a resume first to run a match analysis.</p>
          </div>
        )}

        {!isLoadingOptions && resumes.length > 0 && applications.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
            <p className="text-slate-300 mb-1">No applications with a job description yet.</p>
            <p className="text-slate-500 text-sm">
              Add a job description when creating or editing an application to match against it.
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
              onClick={handleRunMatch}
              disabled={!canRun}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50 mb-6"
            >
              {isRunning ? "Analyzing..." : match ? "Re-run Match" : "Run Match Analysis"}
            </button>

            {error && (
              <div className="rounded bg-red-900/30 border border-red-700 p-4 text-red-300 mb-4">
                {error}
              </div>
            )}

            {match && (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <p className="text-4xl font-bold">{match.matchScore}%</p>
                  <p className="text-sm text-slate-400">Match Score</p>
                  <p className="text-xs text-slate-600 mt-1">AI-assisted estimate based on keyword overlap</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-green-400 mb-1">Matched Skills</h3>
                    {match.matchedSkills.length === 0 ? (
                      <p className="text-sm text-slate-500">None detected.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {match.matchedSkills.map((skill) => (
                          <span key={skill} className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-400 mb-1">Missing Skills</h3>
                    {match.missingSkills.length === 0 ? (
                      <p className="text-sm text-slate-500">None detected.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {match.missingSkills.map((skill) => (
                          <span key={skill} className="text-xs bg-red-900/40 text-red-300 px-2 py-0.5 rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {match.relevantExperience.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">Relevant Experience</h3>
                    <ul className="text-sm text-slate-400 list-disc list-inside space-y-0.5">
                      {match.relevantExperience.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {match.potentialGaps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-yellow-400 mb-1">Potential Gaps</h3>
                    <ul className="text-sm text-slate-400 list-disc list-inside space-y-0.5">
                      {match.potentialGaps.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {match.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-blue-400 mb-1">Recommendations</h3>
                    <ul className="text-sm text-slate-400 list-disc list-inside space-y-0.5">
                      {match.recommendations.map((item, i) => (
                        <li key={i}>{item}</li>
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