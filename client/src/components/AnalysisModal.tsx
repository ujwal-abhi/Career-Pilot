import { useEffect, useState } from "react";
import * as analysisService from "../services/analysisService";
import type { ResumeAnalysis } from "../types/analysis.types";

interface AnalysisModalProps {
  resumeId: string;
  resumeName: string;
  onClose: () => void;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{value}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function AnalysisModal({ resumeId, resumeName, onClose }: AnalysisModalProps) {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analysisService
      .getAnalysis(resumeId)
      .then((res) => setAnalysis(res.analysis))
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }, [resumeId]);

  async function handleRunAnalysis() {
    setError(null);
    setIsRunning(true);
    try {
      const res = await analysisService.runAnalysis(resumeId);
      setAnalysis(res.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold">Resume Analysis</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">
            &times;
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">{resumeName}</p>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {isLoading && <p className="text-slate-400">Loading...</p>}

        {!isLoading && !analysis && (
          <div className="text-center py-6">
            <p className="text-slate-300 mb-4">No analysis yet for this resume.</p>
            <button
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isRunning ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>
        )}

        {!isLoading && analysis && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-4xl font-bold">{analysis.overallScore}</p>
              <p className="text-sm text-slate-400">Overall Score</p>
              <p className="text-xs text-slate-600 mt-1">AI-assisted estimate, not an exact measurement</p>
            </div>

            <div className="space-y-3">
              <ScoreBar label="Skills" value={analysis.skillsScore} />
              <ScoreBar label="Experience" value={analysis.experienceScore} />
              <ScoreBar label="Projects" value={analysis.projectsScore} />
              <ScoreBar label="Keywords" value={analysis.keywordsScore} />
              <ScoreBar label="ATS Readiness" value={analysis.atsScore} />
            </div>

            {analysis.strengths.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-400 mb-1">Strengths</h3>
                <ul className="text-sm text-slate-300 list-disc list-inside space-y-0.5">
                  {analysis.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.improvements.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-yellow-400 mb-1">Suggested Improvements</h3>
                <ul className="text-sm text-slate-300 list-disc list-inside space-y-0.5">
                  {analysis.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className="w-full rounded bg-slate-700 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isRunning ? "Re-analyzing..." : "Re-analyze"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}