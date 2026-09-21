import { useState, type FormEvent } from "react";
import type { Application, ApplicationInput, ApplicationStatus } from "../types/application.types";
import { APPLICATION_STATUSES } from "../types/application.types";

interface ApplicationFormModalProps {
  initialData?: Application;
  onSubmit: (input: ApplicationInput) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
}

export function ApplicationFormModal({
  initialData,
  onSubmit,
  onClose,
  onDelete,
}: ApplicationFormModalProps) {
  const [company, setCompany] = useState(initialData?.company ?? "");
  const [position, setPosition] = useState(initialData?.position ?? "");
  const [status, setStatus] = useState<ApplicationStatus>(initialData?.status ?? "SAVED");
  const [jobUrl, setJobUrl] = useState(initialData?.jobUrl ?? "");
  const [salary, setSalary] = useState(initialData?.salary ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [jobDescription, setJobDescription] = useState(initialData?.jobDescription ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        company,
        position,
        status,
        jobUrl: jobUrl || undefined,
        salary: salary || undefined,
        location: location || undefined,
        jobDescription: jobDescription || undefined,
        notes: notes || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {initialData ? "Edit Application" : "Add Application"}
        </h2>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Company *"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
            required
          />
          <input
            type="text"
            placeholder="Position *"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
            required
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="url"
            placeholder="Job URL"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Salary"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
            />
          </div>
          <textarea
            placeholder="Job description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 h-20"
          />
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 h-16"
          />
          <div className="flex gap-3 pt-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 font-medium"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded bg-slate-700 py-2 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded bg-blue-600 py-2 font-medium disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}