import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import DueDate, { dueState } from "./DueDate";

test("due states use exclusive calendar-day boundaries and ignore done or undated work", () => {
  const item = (due_date, status = "new") => ({ due_date, status });
  const today = "2026-09-29";
  expect(dueState(item("2026-09-28"), today)).toBe("overdue");
  expect(dueState(item(today), today)).toBe("today");
  expect(dueState(item("2026-09-30"), today)).toBe("soon");
  expect(dueState(item("2026-10-02"), today)).toBe("soon");
  expect(dueState(item("2026-10-03"), today)).toBeNull();
  expect(dueState(item("2026-09-28", "done"), today)).toBeNull();
  expect(dueState(item(null), today)).toBeNull();
});

test("due treatment is compact and keeps the date visible", () => {
  render(<DueDate item={{ due_date: "2026-09-29", status: "new" }} today="2026-09-29" prefix="Due " />);
  expect(screen.getByText("Due 2026-09-29")).toBeInTheDocument();
  expect(screen.getByText("· Due today")).toHaveClass("text-[10px]");
});
