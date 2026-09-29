import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyWorkPage from "./MyWorkPage";
import { workApi } from "../api/work";

jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: { id: 7 } } }) }));
jest.mock("../api/work", () => ({
  WORK_STATUS_OPTIONS: [["new", "New"]], WORK_PRIORITY_OPTIONS: [["medium", "Medium"]],
  workApi: { listWorkItems: jest.fn() },
}));
jest.mock("../components/work/WorkItemDrawer", () => ({
  useWorkItemContext: () => ({ revision: 0 }),
  WorkItemLink: ({ children }) => <a href="/item">{children}</a>,
}));

test("My Work labels sub-work-only items without implying ownership or review", async () => {
  const base = { group_name: "Production", workspace_name: "Creative & Design", status: "new", priority: "medium", due_date: null };
  workApi.listWorkItems.mockResolvedValue({ data: [
    { ...base, id: 1, reference: "WI-000001", title: "Assigned sub-work", owner: 8, reviewer: null },
    { ...base, id: 2, reference: "WI-000002", title: "Owned work", owner: 7, reviewer: null },
    { ...base, id: 3, reference: "WI-000003", title: "Review work", owner: 8, reviewer: 7 },
  ] });
  render(<MemoryRouter><MyWorkPage /></MemoryRouter>);

  const subWorkRow = await screen.findByRole("row", { name: /Assigned sub-work/ });
  expect(within(subWorkRow).getByText("Sub-work")).toBeInTheDocument();
  expect(within(subWorkRow).queryByText("Owner")).not.toBeInTheDocument();
  expect(within(subWorkRow).queryByText("Reviewer")).not.toBeInTheDocument();
  expect(within(screen.getByRole("row", { name: /Owned work/ })).getByText("Owner")).toBeInTheDocument();
  expect(within(screen.getByRole("row", { name: /Review work/ })).getByText("Reviewer")).toBeInTheDocument();
  expect(workApi.listWorkItems).toHaveBeenCalledWith({ relevance: "mine" });
  const mobile = screen.getByLabelText("My Work mobile items");
  expect(within(mobile).getByText("Assigned sub-work")).toBeInTheDocument();
  expect(within(mobile).getByText("Sub-work")).toBeInTheDocument();
  expect(within(mobile).getByText("Owner")).toBeInTheDocument();
  expect(within(mobile).getByText("Reviewer")).toBeInTheDocument();
  expect(screen.getByRole("table").parentElement).toHaveClass("hidden", "shell:block");
  expect(mobile).toHaveClass("shell:hidden");
  expect(mobile.closest("[class*='pb-16']")).toHaveClass("pb-16");
});

test("My Work keeps search visible and URL-backed secondary filters collapsible on mobile", async () => {
  workApi.listWorkItems.mockResolvedValue({ data: [] });
  render(<MemoryRouter><MyWorkPage /></MemoryRouter>);
  await screen.findByText("No work items are currently assigned to you for ownership, review or sub-work.", { selector: "p" });
  expect(screen.getByRole("searchbox")).toBeInTheDocument();
  const filters = screen.getByRole("button", { name: "Filters" });
  expect(filters).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(filters);
  expect(filters).toHaveAttribute("aria-expanded", "true");
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "new" } });
  await waitFor(() => expect(workApi.listWorkItems).toHaveBeenCalledWith({ relevance: "mine", status: "new" }));
  expect(screen.getByRole("button", { name: "Filters (1)" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(workApi.listWorkItems).toHaveBeenLastCalledWith({ relevance: "mine" }));
});

test("My Work restores a due filter from the URL and keeps other filters", async () => {
  workApi.listWorkItems.mockResolvedValue({ data: [] });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  render(<MemoryRouter initialEntries={["/my-work?due=today&status=new&priority=medium&q=launch"]}><MyWorkPage /></MemoryRouter>);
  await waitFor(() => expect(workApi.listWorkItems).toHaveBeenCalledWith({
    relevance: "mine", due: "today", timezone, status: "new", priority: "medium", q: "launch",
  }));
  expect(screen.getByRole("searchbox")).toHaveValue("launch");
  fireEvent.click(screen.getByRole("button", { name: "Filters (3)" }));
  expect(screen.getByRole("combobox", { name: "Due" })).toHaveValue("today");
  fireEvent.change(screen.getByRole("combobox", { name: "Due" }), { target: { value: "soon" } });
  await waitFor(() => expect(workApi.listWorkItems).toHaveBeenLastCalledWith({
    relevance: "mine", due: "soon", timezone, status: "new", priority: "medium", q: "launch",
  }));
});
