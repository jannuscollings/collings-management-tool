import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import WorkspacePage from "./WorkspacePage";
import { workApi } from "../api/work";

let mockUser = { is_staff: true };
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: mockUser } }) }));
jest.mock("react-hot-toast", () => ({ __esModule: true, default: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../api/work", () => ({
  WORK_STATUS_OPTIONS: [["new", "New"], ["in_progress", "In progress"], ["review", "Review"], ["done", "Done"]],
  WORK_PRIORITY_OPTIONS: [["low", "Low"], ["medium", "Medium"], ["high", "High"]],
  workApi: { getWorkspace: jest.fn(), listUsers: jest.fn(), listWorkItems: jest.fn(), updateItem: jest.fn(), renameBoard: jest.fn(), addBoard: jest.fn() },
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
function setup(path = "/workspaces/creative-design/", workspaceData = { name: "Creative & Design", groups: [{ id: 1, name: "Property launch" }] }) {
  workApi.getWorkspace.mockResolvedValue({ data: workspaceData });
  workApi.listUsers.mockResolvedValue({ data: [{ id: 7, display_name: "Amy" }] });
  if (!workApi.listWorkItems.getMockImplementation()) workApi.listWorkItems.mockResolvedValue({ data: items });
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/workspaces/:workspaceSlug/" element={<><LocationTools /><WorkspacePage /></>} /></Routes></MemoryRouter>);
}
beforeEach(() => { jest.resetAllMocks(); mockUser = { is_staff: true }; });

test("Admin creates a Board in this Workspace and sees it immediately across applicable views", async () => {
  workApi.addBoard.mockResolvedValue({ data: [
    { id: 1, name: "Property launch", display_order: 1 },
    { id: 2, name: "New delivery", display_order: 2 },
  ] });
  const view = setup();
  await screen.findByRole("heading", { name: "Property launch" });
  fireEvent.click(screen.getByRole("button", { name: "New Board" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Board name" }), { target: { value: "  New delivery  " } });
  fireEvent.click(screen.getByRole("button", { name: "Create Board" }));
  await waitFor(() => expect(workApi.addBoard).toHaveBeenCalledWith("creative-design", "New delivery"));
  await screen.findByRole("heading", { name: "New delivery" });
  expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Property launch", "New delivery"]);
  fireEvent.click(screen.getByRole("button", { name: "Kanban" }));
  expect(screen.getByText("Kanban view")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  expect(screen.getByRole("region", { name: "New delivery Timeline" })).toBeInTheDocument();
  view.unmount();
  setup("/workspaces/creative-design/", { name: "Creative & Design", groups: [
    { id: 1, name: "Property launch" }, { id: 2, name: "New delivery" },
  ] });
  expect(await screen.findByRole("heading", { name: "New delivery" })).toBeInTheDocument();
});

test("Staff cannot create Boards from the Workspace", async () => {
  mockUser = { is_staff: false };
  setup();
  await screen.findByRole("heading", { name: "Property launch" });
  expect(screen.queryByRole("button", { name: "New Board" })).not.toBeInTheDocument();
  expect(workApi.addBoard).not.toHaveBeenCalled();
});

test("blank Board names are blocked and a rejected name keeps the form open", async () => {
  workApi.addBoard.mockRejectedValue({ response: { data: { name: ["A board with this name already exists."] } } });
  setup();
  await screen.findByRole("heading", { name: "Property launch" });
  fireEvent.click(screen.getByRole("button", { name: "New Board" }));
  const name = screen.getByRole("textbox", { name: "Board name" });
  fireEvent.change(name, { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "Create Board" })).toBeDisabled();
  expect(workApi.addBoard).not.toHaveBeenCalled();
  fireEvent.change(name, { target: { value: "Property launch" } });
  fireEvent.click(screen.getByRole("button", { name: "Create Board" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("A board with this name already exists.");
  expect(name).toHaveValue("Property launch");
  expect(screen.getByRole("heading", { name: "Property launch" })).toBeInTheDocument();
});

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

test("Workspace sort labels render uppercase without changing their accessible names", async () => {
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  expect(screen.getByRole("button", { name: "Work item" })).toHaveClass("uppercase");
});

test("Admin can rename a group with Enter and cancel a later edit with Escape", async () => {
  workApi.renameBoard.mockResolvedValue({ data: [{ id: 1, name: "Campaign delivery" }] });
  setup();
  const heading = await screen.findByRole("heading", { name: "Property launch" });
  fireEvent.doubleClick(within(heading).getByText("Property launch"));
  const input = screen.getByRole("textbox", { name: "Rename Property launch" });
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "Campaign delivery" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(workApi.renameBoard).toHaveBeenCalledWith("creative-design", 1, "Campaign delivery"));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Rename Property launch" })).not.toBeInTheDocument());
  const renamed = screen.getByRole("heading", { name: "Campaign delivery" });
  fireEvent.doubleClick(within(renamed).getByText("Campaign delivery"));
  const secondInput = screen.getByRole("textbox", { name: "Rename Campaign delivery" });
  fireEvent.change(secondInput, { target: { value: "Canceled name" } });
  fireEvent.keyDown(secondInput, { key: "Escape" });
  expect(screen.getByRole("heading", { name: "Campaign delivery" })).toBeInTheDocument();
  expect(workApi.renameBoard).toHaveBeenCalledTimes(1);
});

test("Admin blur saves valid group names and leaves empty names unchanged", async () => {
  workApi.renameBoard.mockResolvedValue({ data: [{ id: 1, name: "Renamed board" }] });
  setup();
  const heading = await screen.findByRole("heading", { name: "Property launch" });
  fireEvent.doubleClick(within(heading).getByText("Property launch"));
  const input = screen.getByRole("textbox", { name: "Rename Property launch" });
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.blur(input);
  expect(workApi.renameBoard).not.toHaveBeenCalled();
  fireEvent.doubleClick(within(screen.getByRole("heading", { name: "Property launch" })).getByText("Property launch"));
  const validInput = screen.getByRole("textbox", { name: "Rename Property launch" });
  fireEvent.change(validInput, { target: { value: " Renamed board " } });
  fireEvent.blur(validInput);
  await waitFor(() => expect(workApi.renameBoard).toHaveBeenCalledWith("creative-design", 1, "Renamed board"));
});

test("Staff cannot enter inline group rename", async () => {
  mockUser = { is_staff: false };
  setup();
  const heading = await screen.findByRole("heading", { name: "Property launch" });
  fireEvent.doubleClick(within(heading).getByText("Property launch"));
  expect(screen.queryByRole("textbox", { name: /Rename Property launch/ })).not.toBeInTheDocument();
  expect(workApi.renameBoard).not.toHaveBeenCalled();
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
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Edit priority for WI-000002" }));
  fireEvent.change(within(screen.getByRole("table")).getByRole("combobox", { name: "Edit priority for WI-000002" }), { target: { value: "high" } });
  await waitFor(() => expect(workApi.updateItem).toHaveBeenCalledWith(2, { priority: "high" }));
  await waitFor(() => expect(within(screen.getByRole("table")).getByRole("button", { name: "Edit priority for WI-000002" })).toHaveTextContent("high"));
  expect(within(screen.getByRole("table")).getByRole("link", { name: "Zebra" })).toHaveAttribute("href", "/workspaces/creative-design/?item=2");
});

test("standard users can sort but get no inline property controls", async () => {
  mockUser = { is_staff: false };
  workApi.listWorkItems.mockResolvedValue({ data: items.map((item) => ({ ...item, permissions: { ...item.permissions, manage: true } })) });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  expect(within(screen.getByRole("table")).queryByRole("button", { name: /Edit priority for/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Work item" }));
  expect(screen.getByTestId("location").textContent).toContain("sort=title");
});

test("review status offers no generic route to Done", async () => {
  workApi.listWorkItems.mockResolvedValue({ data: [{ ...items[0], status: "review", permissions: { manage: true, statuses: ["review"] } }] });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Edit status for WI-000002" }));
  expect(within(within(screen.getByRole("table")).getByRole("combobox", { name: "Edit status for WI-000002" })).getAllByRole("option").map((option) => option.value)).toEqual(["review"]);
});

test("admin Table submits Review through the existing status update when a reviewer is assigned", async () => {
  const reviewItem = { ...items[0], reviewer: 7, reviewer_detail: { display_name: "Amy" } };
  workApi.listWorkItems.mockResolvedValue({ data: [reviewItem] });
  workApi.updateItem.mockResolvedValue({ data: { ...reviewItem, status: "review", permissions: { manage: true, statuses: ["review"] } } });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Edit status for WI-000002" }));
  const status = within(screen.getByRole("table")).getByRole("combobox", { name: "Edit status for WI-000002" });
  expect(within(status).getByRole("option", { name: "Review" })).toBeEnabled();
  expect(within(status).queryByRole("option", { name: "Done" })).not.toBeInTheDocument();
  fireEvent.change(status, { target: { value: "review" } });
  await waitFor(() => expect(workApi.updateItem).toHaveBeenCalledWith(2, { status: "review" }));
  await waitFor(() => expect(within(screen.getByRole("table")).getByRole("button", { name: "Edit status for WI-000002" })).toHaveTextContent("Review"));
});

test("admin Table shows why Review is unavailable without a reviewer", async () => {
  workApi.listWorkItems.mockResolvedValue({ data: [{ ...items[0], permissions: { manage: true, statuses: ["new", "in_progress", "done"] } }] });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Edit status for WI-000002" }));
  const status = within(screen.getByRole("table")).getByRole("combobox", { name: "Edit status for WI-000002" });
  expect(within(status).getByRole("option", { name: "Review" })).toBeDisabled();
  expect(within(screen.getByRole("table")).getByText("Assign an active reviewer to submit for review.")).toBeInTheDocument();
  expect(workApi.updateItem).not.toHaveBeenCalled();
});

test("admin Table shows the backend reviewer error if assignment changes before saving", async () => {
  workApi.updateItem.mockRejectedValue({ response: { data: { reviewer: ["Assign an active reviewer before submitting for review."] } } });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Edit status for WI-000002" }));
  fireEvent.change(within(screen.getByRole("table")).getByRole("combobox", { name: "Edit status for WI-000002" }), { target: { value: "review" } });
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Assign an active reviewer before submitting for review."));
  expect(within(screen.getByRole("table")).getByRole("button", { name: "Edit status for WI-000002" })).toHaveTextContent("New");
});

test("a failed inline save restores the displayed value", async () => {
  workApi.updateItem.mockRejectedValue({ response: { data: { priority: ["Invalid priority."] } } });
  setup();
  await screen.findByRole("link", { name: "Zebra" });
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Edit priority for WI-000002" }));
  fireEvent.change(within(screen.getByRole("table")).getByRole("combobox", { name: "Edit priority for WI-000002" }), { target: { value: "high" } });
  await waitFor(() => expect(within(screen.getByRole("table")).getByRole("button", { name: "Edit priority for WI-000002" })).toHaveTextContent("medium"));
});

test("mobile work items retain context, opening, and permitted Admin editing", async () => {
  workApi.listWorkItems.mockResolvedValue({ data: [{ ...items[0], owner: 7, owner_detail: { display_name: "Amy" }, reviewer_detail: { display_name: "Lee" }, due_date: "2026-10-15" }] });
  workApi.updateItem.mockResolvedValue({ data: { ...items[0], priority: "high" } });
  setup();
  const list = await screen.findByRole("list", { name: "Property launch mobile work items" });
  const card = await within(list).findByRole("listitem");
  expect(card).toHaveTextContent("Zebra");
  expect(card).toHaveTextContent("WI-000002");
  expect(card).toHaveTextContent("New");
  expect(card).toHaveTextContent("medium");
  expect(card).toHaveTextContent("Amy");
  expect(card).toHaveTextContent("2026-10-15");
  expect(card).toHaveTextContent("Lee");
  expect(within(card).getByRole("link", { name: /Zebra/ })).toHaveAttribute("href", "/workspaces/creative-design/?item=2");
  fireEvent.click(within(card).getByRole("button", { name: "Edit priority for WI-000002" }));
  fireEvent.change(within(card).getByRole("combobox", { name: "Edit priority for WI-000002" }), { target: { value: "high" } });
  await waitFor(() => expect(workApi.updateItem).toHaveBeenCalledWith(2, { priority: "high" }));
});

test("mobile filters collapse behind a count and keep URL-backed state", async () => {
  setup("/workspaces/creative-design/?sort=title&direction=asc&status=new");
  await screen.findByRole("list", { name: "Property launch mobile work items" });
  const filters = screen.getByRole("button", { name: "Filters 1" });
  expect(filters).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(filters);
  expect(filters).toHaveAttribute("aria-expanded", "true");
  expect(document.getElementById("workspace-mobile-filters")).toHaveClass("grid-cols-2", "gap-2");
  fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "high" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Filters 2" })).toBeInTheDocument());
  expect(screen.getByTestId("location")).toHaveTextContent("priority=high");
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByTestId("location")).toHaveTextContent("sort=title&direction=asc");
  expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
});

test("Workspace Table and Kanban share mobile bottom clearance without changing desktop padding", async () => {
  setup();
  await screen.findByRole("list", { name: "Property launch mobile work items" });
  const workspacePage = screen.getByRole("heading", { name: "Creative & Design" }).closest("[class*='pb-16']");
  expect(workspacePage).toHaveClass("pb-16", "shell:pb-[34px]");
  fireEvent.click(screen.getByRole("button", { name: "Kanban" }));
  expect(screen.getByText("Kanban view")).toBeInTheDocument();
  expect(workspacePage).toHaveClass("pb-16", "shell:pb-[34px]");
});

test("Timeline uses the existing filtered items, Board grouping, drawer links, and URL view", async () => {
  workApi.listWorkItems.mockResolvedValue({ data: [
    { ...items[0], start_date: "2026-10-01", due_date: "2026-10-03" },
    { ...items[1], start_date: null, due_date: null },
  ] });
  setup("/workspaces/creative-design/?view=timeline&status=new");
  const timeline = await screen.findByLabelText("Workspace Timeline");
  expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-pressed", "true");
  expect(within(timeline).getByRole("region", { name: "Property launch Timeline" })).toBeInTheDocument();
  expect(within(timeline).getByText("Unscheduled")).toBeInTheDocument();
  expect(within(timeline).getByRole("link", { name: /WI-000001 · Alpha/ })).toHaveAttribute("href", "/workspaces/creative-design/?item=1");
  fireEvent.click(screen.getByRole("button", { name: "Kanban" }));
  expect(screen.getByText("Kanban view")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  expect(screen.getByLabelText("Workspace Timeline")).toBeInTheDocument();
  expect(workApi.listWorkItems).toHaveBeenCalledWith({ workspace: "creative-design", status: "new" });
});

test("mobile Staff items show details without edit controls", async () => {
  mockUser = { is_staff: false };
  setup();
  const list = await screen.findByRole("list", { name: "Property launch mobile work items" });
  await within(list).findAllByRole("listitem");
  expect(within(list).queryByRole("button", { name: /Edit (status|priority|owner|reviewer|due_date)/ })).toBeNull();
  expect(within(list).getAllByRole("link")).toHaveLength(2);
});
