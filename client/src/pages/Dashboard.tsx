import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getDashboardStats } from "../services/dashboardService";
import { StatCard } from "../components/StatCard";
import type { DashboardStats } from "../types/application.types";

export function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        <button onClick={() => logout()} className="rounded bg-slate-700 px-4 py-2 text-sm">
          Log out
        </button>
      </div>

      {isLoading && <p className="text-slate-400">Loading dashboard...</p>}

      {error && (
        <div className="rounded bg-red-900/30 border border-red-700 p-4 text-red-300">
          {error}
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Applications" value={stats.totalApplications} />
            <StatCard
              label="Interviews"
              value={stats.statusCounts.INTERVIEW}
              accentClassName="text-yellow-400"
            />
            <StatCard
              label="Offers"
              value={stats.statusCounts.OFFER}
              accentClassName="text-green-400"
            />
            <StatCard
              label="Rejected"
              value={stats.statusCounts.REJECTED}
              accentClassName="text-red-400"
            />
          </div>

          <h2 className="text-lg font-semibold mb-3">Recent Applications</h2>
          {stats.recentApplications.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
              <p className="text-slate-300 mb-1">No applications yet.</p>
              <p className="text-slate-500 text-sm">
                Start tracking your first job application. (Coming in the next step!)
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700 rounded-lg border border-slate-700 overflow-hidden">
              {stats.recentApplications.map((app) => (
                <li
                  key={app.id}
                  className="flex justify-between items-center bg-slate-800 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{app.position}</p>
                    <p className="text-sm text-slate-400">{app.company}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wide bg-slate-700 px-2 py-1 rounded">
                    {app.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}