import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import WorkspaceKanban from "./WorkspaceKanban";

jest.mock("../../api/work", () => ({
  WORK_STATUS_OPTIONS: [["new", "New"], ["in_progress", "In progress"], ["review", "Review"], ["done", "Done"]],
}));
jest.mock("./WorkItemDrawer", () => ({
  WorkItemLink: ({ item, children, ...props }) => {
    const MockLink = require("react-router-dom").Link;
    return <MockLink to={`?item=${item.id}`} {...props}>{children}</MockLink>;
  },
}));

test("mobile Kanban keeps four scrolling columns, item opening, and permitted moves", () => {
  const item = { id: 4, reference: "WI-000004", title: "Launch page", status: "new", priority: "high",
    permissions: { edit: true, statuses: ["new", "in_progress"] }, owner_detail: { display_name: "Amy" }, due_date: null };
  const onMoveItem = jest.fn();
  const { container } = render(<MemoryRouter><WorkspaceKanban hasActiveFilters={false} items={[item]} loading={false} onMoveItem={onMoveItem} savingItemIds={new Set()} /></MemoryRouter>);
  const scroller = container.firstChild;
  expect(scroller).toHaveClass("snap-x", "shell:snap-none");
  expect(scroller.firstChild.className).toContain("auto-cols-[minmax(280px,calc(100vw_-_5.5rem))]");
  expect(screen.getAllByRole("region")).toHaveLength(4);
  const newColumn = screen.getByRole("region", { name: "New work items" });
  expect(within(newColumn).getByLabelText("Initials for Amy")).toHaveTextContent("A");
  expect(newColumn).toHaveClass("snap-start");
  expect(within(newColumn).getByRole("link", { name: /Launch page/ })).toHaveAttribute("href", "/?item=4");
  fireEvent.change(within(newColumn).getByRole("combobox", { name: "Move WI-000004" }), { target: { value: "in_progress" } });
  expect(onMoveItem).toHaveBeenCalledWith(item, "in_progress");
  expect(within(newColumn).getByRole("option", { name: "Review" })).toBeDisabled();
  expect(within(newColumn).getByText("Assign an active reviewer to submit for review.")).toBeInTheDocument();
  expect(within(newColumn).queryByRole("option", { name: "Done" })).not.toBeInTheDocument();
});

test("Kanban offers Review as an allowed move when a reviewer is assigned", () => {
  const item = { id: 5, reference: "WI-000005", title: "Campaign", status: "in_progress", priority: "medium",
    permissions: { statuses: ["new", "in_progress", "review"] }, reviewer: 7 };
  const onMoveItem = jest.fn();
  render(<MemoryRouter><WorkspaceKanban hasActiveFilters={false} items={[item]} loading={false} onMoveItem={onMoveItem} savingItemIds={new Set()} /></MemoryRouter>);
  const column = screen.getByRole("region", { name: "In progress work items" });
  const select = within(column).getByRole("combobox", { name: "Move WI-000005" });
  expect(within(select).getByRole("option", { name: "Review" })).toBeEnabled();
  fireEvent.change(select, { target: { value: "review" } });
  expect(onMoveItem).toHaveBeenCalledWith(item, "review");
});

test("Kanban does not show reviewer guidance to someone without edit permission", () => {
  const item = { id: 6, reference: "WI-000006", title: "Campaign", status: "new", priority: "medium",
    permissions: { edit: false, statuses: ["new"] } };
  render(<MemoryRouter><WorkspaceKanban hasActiveFilters={false} items={[item]} loading={false} onMoveItem={jest.fn()} savingItemIds={new Set()} /></MemoryRouter>);
  const column = screen.getByRole("region", { name: "New work items" });
  expect(within(column).queryByRole("option", { name: "Review" })).not.toBeInTheDocument();
  expect(within(column).queryByText("Assign an active reviewer to submit for review.")).not.toBeInTheDocument();
});
