import { useSyncExternalStore } from "react";
import { isServerSlow, subscribe } from "../utils/slowRequests";

// A small message at the bottom of the screen while the server is slow to answer. It appears
// by itself and disappears by itself; nothing else in the app needs to know about it.
export function SlowServerNotice() {
  const isSlow = useSyncExternalStore(subscribe, isServerSlow);
  if (!isSlow) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-amber-500/40 bg-slate-800 px-4 py-3 text-sm shadow-lg"
    >
      <p className="font-semibold text-amber-300">Waking up the server…</p>
      <p className="mt-1 text-slate-300">
        This demo runs on free hosting that sleeps when idle, so the first request can take up to a minute. Thanks for
        waiting.
      </p>
    </div>
  );
}