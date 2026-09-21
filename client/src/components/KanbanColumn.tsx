import type { Application, ApplicationStatus } from "../types/application.types";
import { ApplicationCard } from "./ApplicationCard";

interface KanbanColumnProps {
  status: ApplicationStatus;
  applications: Application[];
  onCardClick: (application: Application) => void;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function KanbanColumn({ status, applications, onCardClick }: KanbanColumnProps) {
  return (
    <div className="bg-slate-900 rounded-lg p-3 min-w-[260px] w-[260px] flex-shrink-0">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm text-slate-300">{STATUS_LABELS[status]}</h3>
        <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full text-slate-400">
          {applications.length}
        </span>
      </div>
      <div className="space-y-2">
        {applications.map((app) => (
          <ApplicationCard key={app.id} application={app} onClick={() => onCardClick(app)} />
        ))}
        {applications.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-4">Empty</p>
        )}
      </div>
    </div>
  );
}