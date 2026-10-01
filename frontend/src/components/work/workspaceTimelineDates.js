const DAY_MS = 24 * 60 * 60 * 1000;

// Date-only ordinals keep calendar days stable across browser timezones and DST.
export function dayNumber(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function localToday() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

export function timelineStart(today, windowOffset = 0) {
  const weekday = new Date(today * DAY_MS).getUTCDay();
  return today - ((weekday + 6) % 7) - 7 + windowOffset * 42;
}

export function formatDay(day, options) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(new Date(day * DAY_MS));
}

export function itemPlacement(item, start, days = 42) {
  const due = dayNumber(item.due_date);
  const from = dayNumber(item.start_date);
  if (due === null) return "unscheduled";
  if (due < start || (from ?? due) >= start + days) return "outside";
  const first = Math.max(from ?? due, start);
  const last = Math.min(due, start + days - 1);
  return { first: first - start, span: last - first + 1, dueOnly: from === null };
}
