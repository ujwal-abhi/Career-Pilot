import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlowServerNotice } from "../../src/components/SlowServerNotice";
import { SLOW_AFTER_MS, trackRequest } from "../../src/utils/slowRequests";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SlowServerNotice", () => {
  it("shows nothing while the server answers normally", () => {
    render(<SlowServerNotice />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("appears when a request is slow and disappears when it finishes", async () => {
    render(<SlowServerNotice />);

    let finish!: (value: string) => void;
    const slow = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const tracked = trackRequest(slow);

    act(() => {
      vi.advanceTimersByTime(SLOW_AFTER_MS);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Waking up the server");
    expect(screen.getByRole("status")).toHaveTextContent("free hosting");

    await act(async () => {
      finish("done");
      await tracked;
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});