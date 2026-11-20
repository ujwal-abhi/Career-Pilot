import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "../../src/components/NotificationBell";
import { getNotifications, snoozeFollowUp } from "../../src/services/notificationService";
import type { AppNotification } from "../../src/types/schedule.types";
import { requestNotificationRefresh } from "../../src/utils/notificationEvents";

// The component talks to the server only through this service, so the tests replace it.
// What is under test is the component: what it shows and what it does when clicked.
vi.mock("../../src/services/notificationService", () => ({
  getNotifications: vi.fn(),
  snoozeFollowUp: vi.fn(),
}));

const mockedGet = vi.mocked(getNotifications);
const mockedSnooze = vi.mocked(snoozeFollowUp);

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "reminder:1",
    type: "REMINDER_OVERDUE",
    title: "Send thank-you note",
    detail: "Reminder for Acme",
    at: hoursFromNow(-2),
    href: "/schedule",
    applicationId: null,
    snoozable: false,
    ...overrides,
  };
}

const interview = notification({
  id: "interview:1",
  type: "INTERVIEW_SOON",
  title: "Technical round at Acme",
  detail: "Frontend Developer (Video)",
  at: hoursFromNow(10),
});

const followUp = notification({
  id: "followup:app-1",
  type: "FOLLOW_UP",
  title: "Follow up with Globex",
  detail: "Engineer: applied, no update for 10 days",
  href: "/applications",
  applicationId: "app-1",
  snoozable: true,
});

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );
}

const bell = (name: RegExp | string) => screen.findByRole("button", { name });

beforeEach(() => {
  mockedGet.mockReset();
  mockedSnooze.mockReset();
});

describe("the badge", () => {
  it("shows how many things need attention", async () => {
    mockedGet.mockResolvedValue({ items: [notification(), interview, followUp], total: 3 });
    renderBell();
    expect(await bell("Notifications, 3 need attention")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the number at 9+", async () => {
    mockedGet.mockResolvedValue({ items: [notification()], total: 12 });
    renderBell();
    expect(await bell("Notifications, 12 need attention")).toBeInTheDocument();
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("is hidden when there is nothing to do", async () => {
    mockedGet.mockResolvedValue({ items: [], total: 0 });
    renderBell();
    const button = await bell("Notifications");
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(button).toHaveAccessibleName("Notifications");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("opening and closing", () => {
  it("is closed to start with, and opens on click", async () => {
    mockedGet.mockResolvedValue({ items: [notification()], total: 1 });
    const user = userEvent.setup();
    renderBell();

    const button = await bell(/Notifications/);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    mockedGet.mockResolvedValue({ items: [notification()], total: 1 });
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell(/Notifications/));
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("closes when the person clicks elsewhere on the page", async () => {
    mockedGet.mockResolvedValue({ items: [notification()], total: 1 });
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell(/Notifications/));

    await user.click(document.body);
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("loads fresh numbers every time it is opened", async () => {
    mockedGet.mockResolvedValue({ items: [], total: 0 });
    const user = userEvent.setup();
    renderBell();
    const button = await bell("Notifications");
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));

    await user.click(button);
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
  });
});

describe("the list", () => {
  it("labels each notification with text, not just a colour, and links it to where it belongs", async () => {
    mockedGet.mockResolvedValue({ items: [notification(), interview, followUp], total: 3 });
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell(/Notifications/));

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Interview")).toBeInTheDocument();
    expect(screen.getByText("Follow up")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Send thank-you note" })).toHaveAttribute("href", "/schedule");
    expect(screen.getByRole("link", { name: "Technical round at Acme" })).toHaveAttribute("href", "/schedule");
    expect(screen.getByRole("link", { name: "Follow up with Globex" })).toHaveAttribute("href", "/applications");
    expect(screen.getByText("Frontend Developer (Video)")).toBeInTheDocument();
  });

  it("says so when there is nothing to do", async () => {
    mockedGet.mockResolvedValue({ items: [], total: 0 });
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell("Notifications"));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
  });

  it("says Loading... until the first answer arrives", async () => {
    mockedGet.mockReturnValue(new Promise(() => {})); // never answers
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell("Notifications"));
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("says how many are hidden when the server capped the list", async () => {
    mockedGet.mockResolvedValue({ items: [notification(), interview], total: 31 });
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell(/Notifications/));
    expect(screen.getByText("Showing 2 of 31.")).toBeInTheDocument();
  });

  it("shows the server's error message instead of the list when loading fails", async () => {
    mockedGet.mockRejectedValue(new Error("Could not load notifications."));
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell("Notifications"));
    expect(await screen.findByText("Could not load notifications.")).toBeInTheDocument();
    expect(screen.queryByText("You're all caught up.")).not.toBeInTheDocument();
  });
});

describe("snoozing a follow-up", () => {
  it("offers Snooze only on notifications that can be snoozed", async () => {
    mockedGet.mockResolvedValue({ items: [notification(), interview, followUp], total: 3 });
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell(/Notifications/));
    expect(screen.getAllByRole("button", { name: "Snooze for 7 days" })).toHaveLength(1);
  });

  it("snoozes that application, then reloads the list", async () => {
    // Opening the bell also reloads, so switch on "has it been snoozed yet?" rather than on call order.
    let snoozed = false;
    mockedGet.mockImplementation(async () => (snoozed ? { items: [], total: 0 } : { items: [followUp], total: 1 }));
    mockedSnooze.mockImplementation(async () => {
      snoozed = true;
      return { snoozedUntil: hoursFromNow(168) };
    });
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell(/Notifications/));
    await user.click(await screen.findByRole("button", { name: "Snooze for 7 days" }));

    expect(mockedSnooze).toHaveBeenCalledExactlyOnceWith("app-1");
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Follow up with Globex" })).not.toBeInTheDocument();
  });

  it("shows an error when snoozing fails", async () => {
    mockedGet.mockResolvedValue({ items: [followUp], total: 1 });
    mockedSnooze.mockRejectedValue(new Error("Could not snooze the follow-up."));
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell(/Notifications/));
    await user.click(await screen.findByRole("button", { name: "Snooze for 7 days" }));
    expect(await screen.findByText("Could not snooze the follow-up.")).toBeInTheDocument();
  });
});

describe("staying up to date", () => {
  it("reloads when another part of the app says something changed", async () => {
    mockedGet.mockResolvedValueOnce({ items: [], total: 0 });
    mockedGet.mockResolvedValue({ items: [notification()], total: 1 });
    renderBell();
    await bell("Notifications");
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));

    requestNotificationRefresh(); // e.g. the Schedule page just saved a reminder
    expect(await bell("Notifications, 1 need attention")).toBeInTheDocument();
  });

  it("stops listening once it is removed from the page", async () => {
    mockedGet.mockResolvedValue({ items: [], total: 0 });
    const { unmount } = renderBell();
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    unmount();

    requestNotificationRefresh();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});