import { useEffect, useState, type FormEvent } from "react";
import * as scheduleService from "../services/scheduleService";
import type { Application } from "../types/application.types";
import type { Reminder } from "../types/schedule.types";
import { defaultLocalInputValue, formatDateTime, fromLocalInputValue } from "../utils/datetime";
import { requestNotificationRefresh } from "../utils/notificationEvents";

function ReminderForm({
  applications,
  onSubmit,
  onCancel,
}: {
  applications: Application[];
  onSubmit: (input: { title: string; dueAt: string; applicationId?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(defaultLocalInputValue(24));
  const [applicationId, setApplicationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const dueAt = fromLocalInputValue(due);
    if (!dueAt) {
      setError("Choose a due date and time.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ title, dueAt, applicationId: applicationId || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border border-slate-600 bg-slate-800 p-4">
      <h3 className="font-semibold">New reminder</h3>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <label className="block text-sm text-slate-400">
        What do you need to do?
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Email the recruiter at Acme"
          maxLength={200}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          required
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-400">
          Due (your local time)
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white [color-scheme:dark]"
            required
          />
        </label>
        <label className="block text-sm text-slate-400">
          Application (optional)
          <select
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">None</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.company} - {application.position}
              </option>
            ))}
          </select>
        </label>
      </div>

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

function ReminderItem({
  reminder,
  now,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  now: Date;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isDone = reminder.completedAt !== null;
  const isOverdue = !isDone && new Date(reminder.dueAt) < now;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3">
      <input
        type="checkbox"
        checked={isDone}
        onChange={onToggle}
        aria-label={isDone ? `Mark "${reminder.title}" as not done` : `Mark "${reminder.title}" as done`}
        className="mt-1 h-4 w-4"
      />
      <div className="min-w-0 flex-1">
        <p className={isDone ? "text-slate-500 line-through" : ""}>{reminder.title}</p>
        <p className="text-xs text-slate-500">
          {isOverdue && <span className="font-semibold text-red-400">Overdue - </span>}
          {formatDateTime(reminder.dueAt)}
          {reminder.application && ` - ${reminder.application.company}`}
        </p>
      </div>
      <button
        onClick={onDelete}
        aria-label={`Delete reminder "${reminder.title}"`}
        className="shrink-0 rounded px-2 py-1 text-sm text-slate-400 hover:text-red-300"
      >
        Delete
      </button>
    </li>
  );
}

export function ReminderSection({ applications }: { applications: Application[] }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  function load() {
    scheduleService
      .getReminders()
      .then((result) => {
        setReminders(result.reminders);
        setNow(new Date());
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(input: { title: string; dueAt: string; applicationId?: string }) {
    await scheduleService.createReminder(input);
    setIsFormOpen(false);
    load();
    requestNotificationRefresh();
  }

  async function handleToggle(reminder: Reminder) {
    try {
      await scheduleService.setReminderCompleted(reminder.id, reminder.completedAt === null);
      load();
      requestNotificationRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the reminder.");
    }
  }

  async function handleDelete(reminder: Reminder) {
    if (!window.confirm(`Delete the reminder "${reminder.title}"?`)) return;
    try {
      await scheduleService.deleteReminder(reminder.id);
      load();
      requestNotificationRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the reminder.");
    }
  }

  const open = reminders.filter((item) => item.completedAt === null);
  const done = reminders.filter((item) => item.completedAt !== null).reverse();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reminders</h2>
        {!isFormOpen && (
          <button onClick={() => setIsFormOpen(true)} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium">
            + Add reminder
          </button>
        )}
      </div>

      {isFormOpen && (
        <ReminderForm applications={applications} onSubmit={handleCreate} onCancel={() => setIsFormOpen(false)} />
      )}

      {isLoading && <p className="text-slate-400">Loading reminders...</p>}
      {error && <div className="mb-3 rounded border border-red-700 bg-red-900/30 p-3 text-red-300">{error}</div>}

      {!isLoading && !error && open.length === 0 && (
        <p className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-slate-400">
          Nothing to do. Add a reminder for follow-ups, thank-you notes or prep.
        </p>
      )}

      {open.length > 0 && (
        <ul className="space-y-2">
          {open.map((reminder) => (
            <ReminderItem
              key={reminder.id}
              reminder={reminder}
              now={now}
              onToggle={() => handleToggle(reminder)}
              onDelete={() => handleDelete(reminder)}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-400">Completed ({done.length})</summary>
          <ul className="mt-3 space-y-2">
            {done.map((reminder) => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                now={now}
                onToggle={() => handleToggle(reminder)}
                onDelete={() => handleDelete(reminder)}
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}