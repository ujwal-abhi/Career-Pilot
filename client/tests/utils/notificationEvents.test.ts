import { describe, expect, it, vi } from "vitest";
import { NOTIFICATIONS_REFRESH_EVENT, requestNotificationRefresh } from "../../src/utils/notificationEvents";

describe("requestNotificationRefresh", () => {
  it("fires the refresh event on window, once per call", () => {
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, listener);

    requestNotificationRefresh();
    expect(listener).toHaveBeenCalledTimes(1);
    requestNotificationRefresh();
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, listener);
    requestNotificationRefresh();
    expect(listener).toHaveBeenCalledTimes(2); // nobody is listening any more
  });

  it("uses an event name that is namespaced to the app", () => {
    expect(NOTIFICATIONS_REFRESH_EVENT).toBe("careerpilot:notifications-refresh");
  });
});