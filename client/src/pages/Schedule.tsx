import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { InterviewSection } from "../components/InterviewSection";
import { ReminderSection } from "../components/ReminderSection";
import { getApplications } from "../services/applicationService";
import type { Application } from "../types/application.types";

export function SchedulePage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApplications()
      .then((result) => setApplications(result.applications))
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="mx-auto max-w-6xl p-8">
        <h1 className="mb-1 text-2xl font-bold">Schedule</h1>
        <p className="mb-6 text-slate-400">
          Interviews you have booked and things you need to do. The bell in the top bar tells you
          what needs attention.
        </p>

        {isLoading && <p className="text-slate-400">Loading...</p>}
        {error && (
          <div className="rounded border border-red-700 bg-red-900/30 p-4 text-red-300">{error}</div>
        )}

        {!isLoading && !error && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <InterviewSection applications={applications} />
            <ReminderSection applications={applications} />
          </div>
        )}
      </div>
    </div>
  );
}