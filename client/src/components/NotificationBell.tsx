import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getNotifications, snoozeFollowUp } from "../services/notificationService";
import type { AppNotification, NotificationType } from "../types/schedule.types";
import { formatDateTime, formatRelative } from "../utils/datetime";
import { NOTIFICATIONS_REFRESH_EVENT } from "../utils/notificationEvents";

// Every notification carries a text label, never just a color, so meaning does not depend
// on being able to tell red from yellow.
const TYPE_STYLES: Record<NotificationType, { label: string; className: string }> = {
  REMINDER_OVERDUE: { label: "Overdue", className: "bg-red-900/50 text-red-300" },
  INTERVIEW_SOON: { label: "Interview", className: "bg-blue-900/50 text-blue-300" },
  REMINDER_DUE: { label: "Due soon", className: "bg-yellow-900/50 text-yellow-300" },
  FOLLOW_UP: { label: "Follow up", className: "bg-slate-700 text-slate-300" },
};

function timeText(notification: AppNotification): string {
  if (notification.type === "INTERVIEW_SOON") {
    return `${formatDateTime(notification.at)} (${formatRelative(notification.at)})`;
  }
  if (notification.type === "FOLLOW_UP") return "";
  return `Due ${formatRelative(notification.at)}`;
}

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getNotifications()
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setHasLoaded(true));
  }, []);

  // Load when the navbar appears (every page has one), and whenever the Schedule page
  // announces that something changed.
  useEffect(() => {
    load();
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, load);
    return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, load);
  }, [load]);

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  function toggle() {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) load(); // always show fresh numbers when it is opened
  }

  async function handleSnooze(applicationId: string) {
    try {
      await snoozeFollowUp(applicationId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not snooze.");
    }
  }

  return (
    // No "relative" here on purpose: the dropdown positions itself against the <nav>
    // (which is relative), so it stays on screen even when the navbar wraps onto
    // several rows on a narrow window.
    <div ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={total > 0 ? `Notifications, ${total} need attention` : "Notifications"}
        className="relative rounded p-2 text-slate-400 hover:text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-4 top-full z-50 mt-1 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-700 bg-slate-800 shadow-xl sm:right-8"
        >
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <p className="font-semibold">Needs your attention</p>
            <Link to="/schedule" onClick={() => setIsOpen(false)} className="text-xs text-blue-400 hover:underline">
              Open schedule
            </Link>
          </div>

          {error && <p className="px-4 py-3 text-sm text-red-300">{error}</p>}

          {!error && items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              {hasLoaded ? "You're all caught up." : "Loading..."}
            </p>
          )}

          {items.length > 0 && (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((notification) => {
                const style = TYPE_STYLES[notification.type];
                const time = timeText(notification);
                return (
                  <li key={notification.id} className="border-b border-slate-700/60 px-4 py-3 last:border-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${style.className}`}>
                        {style.label}
                      </span>
                      {time && <span className="text-xs text-slate-500">{time}</span>}
                    </div>
                    <Link
                      to={notification.href}
                      onClick={() => setIsOpen(false)}
                      className="font-medium hover:underline"
                    >
                      {notification.title}
                    </Link>
                    <p className="text-sm text-slate-400">{notification.detail}</p>
                    {notification.snoozable && notification.applicationId && (
                      <button
                        type="button"
                        onClick={() => handleSnooze(notification.applicationId as string)}
                        className="mt-1 text-xs text-slate-400 underline hover:text-white"
                      >
                        Snooze for 7 days
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {total > items.length && (
            <p className="border-t border-slate-700 px-4 py-2 text-xs text-slate-500">
              Showing {items.length} of {total}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}