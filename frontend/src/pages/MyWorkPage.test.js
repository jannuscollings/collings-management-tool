import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
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
});
