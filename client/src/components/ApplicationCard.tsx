import type { Application } from "../types/application.types";

interface ApplicationCardProps {
  application: Application;
  onClick: () => void;
}

export function ApplicationCard({ application, onClick }: ApplicationCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-slate-500 transition-colors"
    >
      <p className="font-medium">{application.position}</p>
      <p className="text-sm text-slate-400">{application.company}</p>
      {application.location && (
        <p className="text-xs text-slate-500 mt-1">{application.location}</p>
      )}
    </button>
  );
}