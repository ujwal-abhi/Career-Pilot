// The bell in the navbar and the Schedule page are separate components. When the Schedule
// page changes something (a new interview, a finished reminder), it fires this event and
// the bell reloads, so the badge never shows stale numbers.
export const NOTIFICATIONS_REFRESH_EVENT = "careerpilot:notifications-refresh";

export function requestNotificationRefresh() {
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}