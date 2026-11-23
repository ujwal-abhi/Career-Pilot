import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SLOW_AFTER_MS,
  installSlowRequestTracking,
  isApiRequest,
  isServerSlow,
  subscribe,
  trackRequest,
} from "../../src/utils/slowRequests";

// A promise the test settles by hand, standing in for a request that is still waiting.
function pending() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("isApiRequest", () => {
  it("recognises our API calls, whether relative or absolute, as text, URL or Request", () => {
    expect(isApiRequest("/api/applications")).toBe(true);
    expect(isApiRequest("https://careerpilot.example.com/api/auth/me")).toBe(true);
    expect(isApiRequest(new URL("https://careerpilot.example.com/api/dashboard"))).toBe(true);
    expect(isApiRequest(new Request("https://careerpilot.example.com/api/resumes"))).toBe(true);
  });

  it("ignores everything else", () => {
    expect(isApiRequest("/assets/index-abc123.js")).toBe(false);
    expect(isApiRequest("https://fonts.googleapis.com/css2?family=Inter")).toBe(false);
    expect(isApiRequest("/applications")).toBe(false);
  });
});

describe("trackRequest", () => {
  it("does not flag a request that answers quickly", async () => {
    const request = pending();
    const tracked = trackRequest(request.promise);

    vi.advanceTimersByTime(SLOW_AFTER_MS - 1);
    expect(isServerSlow()).toBe(false);

    request.resolve("ok");
    await tracked;
    vi.advanceTimersByTime(SLOW_AFTER_MS * 2);
    expect(isServerSlow()).toBe(false); // the timer was cancelled, so it never fires later
  });

  it("flags a request that is still waiting after the delay, and clears the flag when it answers", async () => {
    const request = pending();
    const tracked = trackRequest(request.promise);

    vi.advanceTimersByTime(SLOW_AFTER_MS);
    expect(isServerSlow()).toBe(true);

    request.resolve("ok");
    await tracked;
    expect(isServerSlow()).toBe(false);
  });

  it("hands back the same result to the caller", async () => {
    const request = pending();
    const tracked = trackRequest(request.promise);
    request.resolve("the response");
    await expect(tracked).resolves.toBe("the response");
  });

  it("clears the flag when a slow request fails, and the caller still sees the error", async () => {
    const request = pending();
    const tracked = trackRequest(request.promise);
    const outcome = expect(tracked).rejects.toThrow("network down");

    vi.advanceTimersByTime(SLOW_AFTER_MS);
    expect(isServerSlow()).toBe(true);

    request.reject(new Error("network down"));
    await outcome;
    expect(isServerSlow()).toBe(false);
  });

  it("stays flagged until every slow request is done", async () => {
    const first = pending();
    const second = pending();
    const trackedFirst = trackRequest(first.promise);
    const trackedSecond = trackRequest(second.promise);

    vi.advanceTimersByTime(SLOW_AFTER_MS);
    expect(isServerSlow()).toBe(true);

    first.resolve("a");
    await trackedFirst;
    expect(isServerSlow()).toBe(true);

    second.resolve("b");
    await trackedSecond;
    expect(isServerSlow()).toBe(false);
  });
});

describe("subscribe", () => {
  it("tells listeners when the state changes, and stops after unsubscribing", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    const request = pending();
    const tracked = trackRequest(request.promise);
    vi.advanceTimersByTime(SLOW_AFTER_MS);
    expect(listener).toHaveBeenCalledTimes(1); // became slow

    request.resolve("ok");
    await tracked;
    expect(listener).toHaveBeenCalledTimes(2); // no longer slow

    unsubscribe();
    const next = pending();
    const trackedNext = trackRequest(next.promise);
    vi.advanceTimersByTime(SLOW_AFTER_MS);
    next.resolve("ok");
    await trackedNext;
    expect(listener).toHaveBeenCalledTimes(2); // unchanged
  });
});

describe("installSlowRequestTracking", () => {
  const originalFetch = window.fetch;
  afterEach(() => {
    window.fetch = originalFetch;
  });

  it("times calls to our API but leaves other requests alone", async () => {
    const api = pending();
    const other = pending();
    const fakeFetch = vi.fn((input: RequestInfo | URL) =>
      (String(input).includes("/api/") ? api.promise : other.promise).then((body) => new Response(body))
    );
    window.fetch = fakeFetch as unknown as typeof fetch;
    const uninstall = installSlowRequestTracking();

    const otherCall = window.fetch("https://example.com/image.png");
    vi.advanceTimersByTime(SLOW_AFTER_MS);
    expect(isServerSlow()).toBe(false); // not our API

    const apiCall = window.fetch("/api/applications");
    vi.advanceTimersByTime(SLOW_AFTER_MS);
    expect(isServerSlow()).toBe(true);

    api.resolve("applications");
    other.resolve("image");
    expect(await (await apiCall).text()).toBe("applications");
    await otherCall;
    expect(isServerSlow()).toBe(false);
    expect(fakeFetch).toHaveBeenCalledTimes(2);

    uninstall();
    expect(window.fetch).toBe(fakeFetch);
  });
});