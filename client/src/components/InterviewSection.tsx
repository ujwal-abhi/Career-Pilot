import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as scheduleService from "../services/scheduleService";
import type { Application } from "../types/application.types";
import { INTERVIEW_FORMATS, type Interview, type InterviewFormat } from "../types/schedule.types";
import {
  defaultLocalInputValue,
  formatDateTime,
  formatRelative,
  fromLocalInputValue,
  toLocalInputValue,
} from "../utils/datetime";
import { asHttpUrl } from "../utils/url";
import { requestNotificationRefresh } from "../utils/notificationEvents";

const FORMAT_LABELS: Record<InterviewFormat, string> = {
  VIDEO: "Video call",
  PHONE: "Phone",
  ONSITE: "On-site",
};

interface InterviewFormProps {
  applications: Application[];
  initialData?: Interview;
  onSubmit: (input: {
    applicationId: string;
    title: string;
    format: InterviewFormat;
    scheduledAt: string;
    location?: string;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

function InterviewForm({ applications, initialData, onSubmit, onCancel }: InterviewFormProps) {
  const [applicationId, setApplicationId] = useState(initialData?.applicationId ?? applications[0]?.id ?? "");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [format, setFormat] = useState<InterviewFormat>(initialData?.format ?? "VIDEO");
  const [when, setWhen] = useState(
    initialData ? toLocalInputValue(initialData.scheduledAt) : defaultLocalInputValue(24)
  );
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // The input holds the person's LOCAL time. Convert to an exact moment before sending.
    const scheduledAt = fromLocalInputValue(when);
    if (!scheduledAt) {
      setError("Choose a date and time.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        applicationId,
        title,
        format,
        scheduledAt,
        location: location || undefined,
        notes: notes || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border border-slate-600 bg-slate-800 p-4">
      <h3 className="font-semibold">{initialData ? "Edit interview" : "Schedule an interview"}</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <label className="block text-sm text-slate-400">
        Application
        <select
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
          disabled={Boolean(initialData)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
          required
        >
          {applications.map((application) => (
            <option key={application.id} value={application.id}>
              {application.company} - {application.position}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-slate-400">
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Technical round 1"
          maxLength={120}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          required
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-400">
          Date and time (your local time)
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white [color-scheme:dark]"
            required
          />
        </label>
        <label className="block text-sm text-slate-400">
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as InterviewFormat)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            {INTERVIEW_FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm text-slate-400">
        Meeting link or address
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={300}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
        />
      </label>

      <label className="block text-sm text-slate-400">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          className="mt-1 h-16 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
        />
      </label>

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 rounded bg-slate-700 py-2 font-medium">
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
  );
}

function InterviewItem({
  interview,
  now,
  onEdit,
  onDelete,
}: {
  interview: Interview;
  now: Date;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const link = interview.location ? asHttpUrl(interview.location) : null;

  return (
    <li className="flex justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="min-w-0">
        <p className="font-medium">{interview.title}</p>
        <p className="text-sm text-slate-400">
          {interview.application.company} - {interview.application.position}
        </p>
        <p className="mt-1 text-sm text-slate-300">
          {formatDateTime(interview.scheduledAt)}{" "}
          <span className="text-slate-500">({formatRelative(interview.scheduledAt, now)})</span>
        </p>
        <p className="mt-1 break-words text-xs text-slate-500">
          {FORMAT_LABELS[interview.format]}
          {interview.location && " - "}
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
              {interview.location}
            </a>
          ) : (
            interview.location
          )}
        </p>
        {interview.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{interview.notes}</p>}
      </div>
      <div className="flex shrink-0 gap-2 self-start">
        <button onClick={onEdit} className="rounded bg-slate-700 px-3 py-1 text-sm">
          Edit
        </button>
        <button
          onClick={onDelete}
          className="rounded border border-red-700 bg-red-900/50 px-3 py-1 text-sm text-red-300"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export function InterviewSection({ applications }: { applications: Application[] }) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Interview | undefined>(undefined);

  function load() {
    scheduleService
      .getInterviews()
      .then((result) => {
        setInterviews(result.interviews);
        setNow(new Date());
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(undefined);
    setIsFormOpen(true);
  }

  function openEdit(interview: Interview) {
    setEditing(interview);
    setIsFormOpen(true);
  }

  async function handleSubmit(input: Parameters<typeof scheduleService.createInterview>[0]) {
    if (editing) {
      // The application cannot be changed after an interview is created.
      await scheduleService.updateInterview(editing.id, {
        title: input.title,
        format: input.format,
        scheduledAt: input.scheduledAt,
        location: input.location,
        notes: input.notes,
      });
    } else {
      await scheduleService.createInterview(input);
    }
    setIsFormOpen(false);
    setEditing(undefined);
    load();
    requestNotificationRefresh();
  }

  async function handleDelete(interview: Interview) {
    if (!window.confirm(`Delete "${interview.title}" at ${interview.application.company}?`)) return;
    try {
      await scheduleService.deleteInterview(interview.id);
      load();
      requestNotificationRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the interview.");
    }
  }

  const upcoming = interviews.filter((item) => new Date(item.scheduledAt) >= now);
  const past = interviews.filter((item) => new Date(item.scheduledAt) < now).reverse();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Interviews</h2>
        {applications.length > 0 && !isFormOpen && (
          <button onClick={openAdd} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium">
            + Schedule interview
          </button>
        )}
      </div>

      {applications.length === 0 && (
        <p className="mb-4 rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-slate-400">
          Interviews belong to an application. Add one on the{" "}
          <Link to="/applications" className="text-blue-400 underline">
            Applications
          </Link>{" "}
          page first.
        </p>
      )}

      {isFormOpen && (
        <InterviewForm
          key={editing?.id ?? "new"}
          applications={applications}
          initialData={editing}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setEditing(undefined);
          }}
        />
      )}

      {isLoading && <p className="text-slate-400">Loading interviews...</p>}
      {error && <div className="mb-3 rounded border border-red-700 bg-red-900/30 p-3 text-red-300">{error}</div>}

      {!isLoading && !error && upcoming.length === 0 && (
        <p className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-slate-400">
          No upcoming interviews.
        </p>
      )}

      {upcoming.length > 0 && (
        <ul className="space-y-3">
          {upcoming.map((interview) => (
            <InterviewItem
              key={interview.id}
              interview={interview}
              now={now}
              onEdit={() => openEdit(interview)}
              onDelete={() => handleDelete(interview)}
            />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-400">Past interviews ({past.length})</summary>
          <ul className="mt-3 space-y-3">
            {past.map((interview) => (
              <InterviewItem
                key={interview.id}
                interview={interview}
                now={now}
                onEdit={() => openEdit(interview)}
                onDelete={() => handleDelete(interview)}
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}