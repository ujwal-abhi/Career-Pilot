// Notices when the server is slow to answer, so the app can say why instead of looking frozen.
//
// Why: on free hosting the server goes to sleep when nobody uses it, and the next request has
// to wait for it to wake up, which can take up to a minute. Without a message that wait looks
// like a broken app.
//
// How: window.fetch is wrapped once (installSlowRequestTracking). Every request to our API is
// timed; if one is still waiting after SLOW_AFTER_MS, "slow" turns on, and it turns off again
// when no slow request is left. A small component (SlowServerNotice) shows the message.
// Wrapping fetch in one place means the 13 service files do not need to change.

export const SLOW_AFTER_MS = 4000;

type Listener = () => void;

const listeners = new Set<Listener>();
let slowCount = 0; // requests that are still waiting AND have waited longer than SLOW_AFTER_MS

function notify() {
  listeners.forEach((listener) => listener());
}

// The two functions React's useSyncExternalStore needs.
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isServerSlow(): boolean {
  return slowCount > 0;
}

// Only our own API calls count; a slow font or image elsewhere is not "the server waking up".
export function isApiRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/api/");
}

// Watches a request without changing it: the caller gets the very same promise back, with the
// same result or the same error.
export function trackRequest<T>(request: Promise<T>): Promise<T> {
  let counted = false;
  const timer = setTimeout(() => {
    counted = true;
    slowCount += 1;
    notify();
  }, SLOW_AFTER_MS);

  const finish = () => {
    clearTimeout(timer);
    if (counted) {
      slowCount -= 1;
      notify();
    }
  };
  request.then(finish, finish); // handles both outcomes, so it never reports an unhandled rejection

  return request;
}

// Wraps window.fetch. Returns a function that puts the original back (used by the tests).
export function installSlowRequestTracking(): () => void {
  const originalFetch = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const request = originalFetch.call(window, input, init);
    return isApiRequest(input) ? trackRequest(request) : request;
  };
  return () => {
    window.fetch = originalFetch;
  };
}