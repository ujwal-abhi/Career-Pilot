import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const linkClass = (path: string) =>
    `px-3 py-2 rounded text-sm ${
      location.pathname === path ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
    }`;

  return (
    <nav className="flex justify-between items-center px-8 py-4 border-b border-slate-800">
      <div className="flex items-center gap-6">
        <span className="font-bold text-lg">CareerPilot</span>
        <Link to="/dashboard" className={linkClass("/dashboard")}>
          Dashboard
        </Link>
        <Link to="/applications" className={linkClass("/applications")}>
          Applications
        </Link>
        <Link to="/resumes" className={linkClass("/resumes")}>
          Resumes
        </Link>
        <Link to="/job-match" className={linkClass("/job-match")}>
          Job Match
        </Link>
        <Link to="/tailor" className={linkClass("/tailor")}>
          Tailor
        </Link>
        <Link to="/interview-prep" className={linkClass("/interview-prep")}>
          Interview Prep
        </Link>
        <Link to="/practice" className={linkClass("/practice")}>
          Practice
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-400">{user?.name}</span>
        <button onClick={() => logout()} className="rounded bg-slate-700 px-4 py-2 text-sm">
          Log out
        </button>
      </div>
    </nav>
  );
}