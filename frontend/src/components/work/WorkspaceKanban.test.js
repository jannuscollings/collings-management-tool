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
    permissions: { statuses: ["new", "in_progress"] }, owner_detail: { display_name: "Amy" }, due_date: null };
  const onMoveItem = jest.fn();
  const { container } = render(<MemoryRouter><WorkspaceKanban hasActiveFilters={false} items={[item]} loading={false} onMoveItem={onMoveItem} savingItemIds={new Set()} /></MemoryRouter>);
  const scroller = container.firstChild;
  expect(scroller).toHaveClass("snap-x", "shell:snap-none");
  expect(scroller.firstChild.className).toContain("auto-cols-[minmax(280px,calc(100vw_-_5.5rem))]");
  expect(screen.getAllByRole("region")).toHaveLength(4);
  const newColumn = screen.getByRole("region", { name: "New work items" });
  expect(newColumn).toHaveClass("snap-start");
  expect(within(newColumn).getByRole("link", { name: /Launch page/ })).toHaveAttribute("href", "/?item=4");
  fireEvent.change(within(newColumn).getByRole("combobox", { name: "Move WI-000004" }), { target: { value: "in_progress" } });
  expect(onMoveItem).toHaveBeenCalledWith(item, "in_progress");
  expect(within(newColumn).queryByRole("option", { name: "Done" })).not.toBeInTheDocument();
});
