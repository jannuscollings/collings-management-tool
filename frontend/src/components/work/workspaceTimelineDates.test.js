import { dayNumber, itemPlacement, timelineStart } from "./workspaceTimelineDates";

test("date-only positions include both endpoints and stay stable around DST", () => {
  const today = dayNumber("2026-10-01");
  const start = timelineStart(today);
  expect(start).toBe(dayNumber("2026-09-21"));
  expect(itemPlacement({ start_date: "2026-10-01", due_date: "2026-10-03" }, start)).toEqual({ first: 10, span: 3, dueOnly: false });
  expect(itemPlacement({ start_date: "2026-10-01", due_date: "2026-10-01" }, start)).toEqual({ first: 10, span: 1, dueOnly: false });
  expect(itemPlacement({ start_date: null, due_date: "2026-10-01" }, start)).toEqual({ first: 10, span: 1, dueOnly: true });
  expect(dayNumber("2026-03-09") - dayNumber("2026-03-08")).toBe(1);
});

test("window navigation and out-of-window placement keep items accessible", () => {
  const today = dayNumber("2026-10-01");
  const start = timelineStart(today);
  expect(timelineStart(today, 1) - start).toBe(42);
  expect(itemPlacement({ start_date: null, due_date: null }, start)).toBe("unscheduled");
  expect(itemPlacement({ start_date: null, due_date: "2026-12-01" }, start)).toBe("outside");
  expect(itemPlacement({ start_date: "2026-09-18", due_date: "2026-09-22" }, start)).toEqual({ first: 0, span: 2, dueOnly: false });
});
