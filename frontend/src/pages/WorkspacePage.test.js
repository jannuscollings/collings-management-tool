import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import WorkspacePage from "./WorkspacePage";
import { workApi } from "../api/work";

let mockUser = { is_staff: true };
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: mockUser } }) }));
jest.mock("../api/work", () => ({
  WORK_STATUS_OPTIONS: [["new", "New"], ["in_progress", "In progress"], ["review", "Review"], ["done", "Done"]],
  WORK_PRIORITY_OPTIONS: [["low", "Low"], ["medium", "Medium"], ["high", "High"]],
  workApi: { getWorkspace: jest.fn(), listUsers: jest.fn(), listWorkItems: jest.fn(), updateItem: jest.fn() },
}));
jest.mock("../components/work/WorkItemDrawer", () => ({
  useWorkItemContext: () => ({ revision: 0 }),
  WorkItemLink: ({ item, children, ...props }) => { const MockLink = require("react-router-dom").Link; return <MockLink to={`?item=${item.id}`} {...props}>{children}</MockLink>; },
  DrawerLink: ({ children, ...props }) => { const MockLink = require("react-router-dom").Link; return <MockLink to="?drawer=new-work-item" {...props}>{children}</MockLink>; },
}));
jest.mock("../components/work/WorkspaceKanban", () => () => <div>Kanban view</div>);

const base = { group: 1, brief: "", status: "new", priority: "medium", owner: null, reviewer: null, due_date: null,
  owner_detail: null, reviewer_detail: null, permissions: { manage: true, statuses: ["new", "in_progress", "review"] } };
const items = [
  { ...base, id: 2, reference: "WI-000002", title: "Zebra" },
  { ...base, id: 1, reference: "WI-000001", title: "Alpha" },
];
function LocationTools() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.search}</output><button onClick={() => navigate(-1)}>Back</button></>;
}
function setup(path = "/workspaces/creative-design/") {
  workApi.getWorkspace.mockResolvedValue({ data: { name: "Creative & Design", groups: [{ id: 1, name: "Property launch" }] } });
  workApi.listUsers.mockResolvedValue({ data: [{ id: 7, display_name: "Amy" }] });
  if (!workApi.listWorkItems.getMockImplementation()) workApi.listWorkItems.mockResolvedValue({ data: items });
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/workspaces/:workspaceSlug/" element={<><LocationTools /><WorkspacePage /></>} /></Routes></MemoryRouter>);
}
beforeEach(() => { jest.resetAllMocks(); mockUser = { is_staff: true }; });

test("headers cycle through URL-backed sorting and Back restores the previous order", async () => {
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  const header = screen.getByRole("columnheader", { name: "Work item" });
  const order = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("link")[1].textContent);
  expect(order()).toEqual(["Zebra", "Alpha"]);
  fireEvent.click(within(header).getByRole("button"));
  expect(order()).toEqual(["Alpha", "Zebra"]);
  expect(screen.getByTestId("location").textContent).toContain("sort=title&direction=asc");
  fireEvent.click(within(header).getByRole("button"));
  expect(order()).toEqual(["Zebra", "Alpha"]);
  expect(header).toHaveAttribute("aria-sort", "descending");
  fireEvent.click(within(header).getByRole("button"));
  expect(header).toHaveAttribute("aria-sort", "none");
  expect(screen.getByTestId("location").textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  await waitFor(() => expect(header).toHaveAttribute("aria-sort", "descending"));
});

test("a URL sort survives refresh state and clearing filters", async () => {
  setup("/workspaces/creative-design/?sort=title&direction=asc&priority=medium");
  await screen.findByRole("link", { name: "Zebra" });
  expect(screen.getByRole("columnheader", { name: "Work item" })).toHaveAttribute("aria-sort", "ascending");
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByTestId("location").textContent).toBe("?sort=title&direction=asc");
});

test("admin inline change patches one field and leaves title drawer navigation intact", async () => {
  workApi.updateItem.mockResolvedValue({ data: { ...items[0], priority: "high" } });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  fireEvent.click(screen.getByRole("button", { name: "Edit priority for WI-000002" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Edit priority for WI-000002" }), { target: { value: "high" } });
  await waitFor(() => expect(workApi.updateItem).toHaveBeenCalledWith(2, { priority: "high" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit priority for WI-000002" })).toHaveTextContent("high"));
  expect(screen.getByRole("link", { name: "Zebra" })).toHaveAttribute("href", "/workspaces/creative-design/?item=2");
});

test("standard users can sort but get no inline property controls", async () => {
  mockUser = { is_staff: false };
  workApi.listWorkItems.mockResolvedValue({ data: items.map((item) => ({ ...item, permissions: { ...item.permissions, manage: true } })) });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  expect(screen.queryByRole("button", { name: /Edit priority for/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Work item" }));
  expect(screen.getByTestId("location").textContent).toContain("sort=title");
});

test("review status offers no generic route to Done", async () => {
  workApi.listWorkItems.mockResolvedValue({ data: [{ ...items[0], status: "review", permissions: { manage: true, statuses: ["review"] } }] });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  fireEvent.click(screen.getByRole("button", { name: "Edit status for WI-000002" }));
  expect(within(screen.getByRole("combobox", { name: "Edit status for WI-000002" })).getAllByRole("option").map((option) => option.value)).toEqual(["review"]);
});

test("a failed inline save restores the displayed value", async () => {
  workApi.updateItem.mockRejectedValue({ response: { data: { priority: ["Invalid priority."] } } });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  fireEvent.click(screen.getByRole("button", { name: "Edit priority for WI-000002" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Edit priority for WI-000002" }), { target: { value: "high" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit priority for WI-000002" })).toHaveTextContent("medium"));
});
