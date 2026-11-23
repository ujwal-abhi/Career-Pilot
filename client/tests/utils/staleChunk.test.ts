import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELOAD_COOLDOWN_MS, installStaleChunkReload, shouldReload } from "../../src/utils/staleChunk";

describe("shouldReload", () => {
  it("reloads when it has not reloaded before", () => {
    expect(shouldReload(1_000_000, null)).toBe(true);
  });

  it("does not reload again inside the cooldown, so a failing reload cannot loop forever", () => {
    expect(shouldReload(1_000_000 + RELOAD_COOLDOWN_MS, 1_000_000)).toBe(false);
  });

  it("reloads again once the cooldown has passed", () => {
    expect(shouldReload(1_000_001 + RELOAD_COOLDOWN_MS, 1_000_000)).toBe(true);
  });
});

describe("installStaleChunkReload", () => {
  const reload = vi.fn();
  let uninstall: () => void;

  // Vite fires this event on window when a page file fails to download.
  const fail = () => {
    const event = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    sessionStorage.clear();
    reload.mockClear();
    uninstall = installStaleChunkReload(reload);
  });
  afterEach(() => {
    uninstall();
    vi.useRealTimers();
  });

  it("reloads the page and marks the error as handled", () => {
    const event = fail();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not reload a second time straight away, and lets the error through", () => {
    fail();
    const second = fail();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });

  it("reloads again after the cooldown", () => {
    fail();
    vi.setSystemTime(Date.now() + RELOAD_COOLDOWN_MS + 1);
    fail();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload when browser storage is blocked, because a loop could not be prevented", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const event = fail();
    expect(reload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("stops listening after uninstall", () => {
    uninstall();
    fail();
    expect(reload).not.toHaveBeenCalled();
  });
});