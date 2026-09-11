import { useAuth } from "../context/AuthContext";

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        <button onClick={() => logout()} className="rounded bg-slate-700 px-4 py-2 text-sm">
          Log out
        </button>
      </div>
      <p className="text-slate-400">Your real dashboard arrives in Phase 4.</p>
    </div>
  );
}