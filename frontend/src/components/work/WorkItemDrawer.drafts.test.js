import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, createRoutesFromElements, MemoryRouter, Route, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import WorkItemDrawer from "./WorkItemDrawer";
import NavigationGuard from "../navigation/NavigationGuard";
import { workApi } from "../../api/work";
import { awarenessApi } from "../../api/awareness";

let mockCloseDrawer;
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: { id: 1, is_staff: true } } }) }));
jest.mock("../../api/work", () => ({
  WORK_STATUS_OPTIONS: [["new", "New"], ["in_progress", "In progress"], ["review", "Review"], ["done", "Done"]],
  WORK_PRIORITY_OPTIONS: [["low", "Low"], ["medium", "Medium"], ["high", "High"]],
  workApi: {
    listWorkspaces: jest.fn(), getItem: jest.fn(), listComments: jest.fn(), listActivity: jest.fn(),
    listSubWork: jest.fn(), listLinks: jest.fn(), getWorkspace: jest.fn(), listUsers: jest.fn(),
    updateItem: jest.fn(), createComment: jest.fn(), editComment: jest.fn(), createSubWork: jest.fn(),
    updateSubWork: jest.fn(), createLink: jest.fn(), review: jest.fn(),
  },
}));
jest.mock("../../api/awareness", () => ({ awarenessApi: { notifications: jest.fn() } }));
jest.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children, onOpenChange }) => {
    const React = require("react");
    mockCloseDrawer = () => onOpenChange(false);
    React.useEffect(() => {
      const onKeyDown = (event) => { if (event.key === "Escape") onOpenChange(false); };
      globalThis.document.addEventListener("keydown", onKeyDown);
      return () => globalThis.document.removeEventListener("keydown", onKeyDown);
    }, [onOpenChange]);
    return <>{children}</>;
  },
  Portal: ({ children }) => <>{children}</>,
  Overlay: () => <button aria-label="Drawer overlay" onClick={() => mockCloseDrawer()} />,
  Content: ({ children }) => <div>{children}</div>,
  Title: ({ children }) => <div>{children}</div>,
  Description: ({ children }) => <div>{children}</div>,
  Close: ({ children, ...props }) => <button {...props} onClick={() => mockCloseDrawer()}>{children}</button>,
}));
jest.mock("../requests/NewRequestForm", () => () => null);
jest.mock("../requests/RequestDetailPanel", () => () => null);
jest.mock("./NewWorkItemForm", () => () => null);
jest.mock("./WorkspaceManagerPanel", () => () => null);
jest.mock("./NotificationsPanel", () => () => null);

const item = {
  id: 1, reference: "WI-000001", title: "Campaign", brief: "Saved brief", group: 1,
  group_name: "Production", workspace_slug: "creative-design", workspace_name: "Creative & Design",
  status: "review", priority: "medium", owner: 1, reviewer: 1, due_date: null,
  reviewer_detail: { display_name: "Reviewer" }, owner_detail: { display_name: "Owner" },
  permissions: { edit: true, manage: true, review: true, statuses: ["review"] },
};
const comment = (id, body, parent = null) => ({
  id, body, parent, author_detail: { display_name: "Owner" }, created_at: "2026-09-28T00:00:00Z",
  mention_details: [], can_manage: true, deleted_at: null,
});

function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.search}</output><button onClick={() => {
    const query = new URLSearchParams(location.search);
    query.set("view", "kanban");
    navigate({ pathname: location.pathname, search: query.toString() });
  }}>Change view</button></>;
}

function setup({ comments = [], subs = [], guarded = false } = {}) {
  workApi.listWorkspaces.mockResolvedValue({ data: [] });
  awarenessApi.notifications.mockResolvedValue({ data: { items: [], unread_count: 0, next_before: null } });
  workApi.getItem.mockResolvedValue({ data: item });
  workApi.listComments.mockResolvedValue({ data: comments });
  workApi.listActivity.mockResolvedValue({ data: [] });
  workApi.listSubWork.mockResolvedValue({ data: subs });
  workApi.listLinks.mockResolvedValue({ data: [] });
  workApi.getWorkspace.mockResolvedValue({ data: { groups: [{ id: 1, name: "Production" }] } });
  workApi.listUsers.mockResolvedValue({ data: [{ id: 1, display_name: "Owner" }, { id: 2, display_name: "Other" }] });
  if (guarded) {
    const router = createMemoryRouter(createRoutesFromElements(<Route element={<NavigationGuard />}>
      <Route path="/home" element={<WorkItemDrawer><Location /></WorkItemDrawer>} />
    </Route>), { initialEntries: ["/home?item=1"] });
    return render(<RouterProvider router={router} />);
  }
  return render(<MemoryRouter initialEntries={["/home?item=1"]}><WorkItemDrawer><Location /></WorkItemDrawer></MemoryRouter>);
}

beforeEach(() => { jest.resetAllMocks(); jest.spyOn(window, "confirm").mockReturnValue(false); });
afterEach(() => { window.confirm.mockRestore(); });

test("router guard gives one confirmation for X, overlay and Escape while keeping review and post drafts", async () => {
  setup({ guarded: true });
  await screen.findByText("Saved brief");
  fireEvent.change(screen.getByRole("textbox", { name: /^Review note/ }), { target: { value: "Review draft" } });
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.change(screen.getByRole("textbox", { name: /^Post update/ }), { target: { value: "Post draft" } });
  expect(window.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Change view" }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("view=kanban"));
  expect(window.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Drawer overlay" }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2));
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(3));
  expect(screen.getByRole("textbox", { name: /^Review note/ })).toHaveValue("Review draft");
  expect(screen.getByRole("textbox", { name: /^Post update/ })).toHaveValue("Post draft");
  expect(screen.getByTestId("location")).toHaveTextContent("item=1");
});

test("core edits survive tab switches and reverting to saved values clears the close guard", async () => {
  setup();
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const title = screen.getByRole("textbox", { name: "Title" });
  fireEvent.change(title, { target: { value: "Changed campaign" } });
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.click(screen.getByRole("button", { name: "Activity" }));
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Changed campaign");
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("location")).toHaveTextContent("item=1");
  fireEvent.change(title, { target: { value: "Campaign" } });
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("location")).not.toHaveTextContent("item=1");
});

test("post and review drafts stay independent for X, overlay and Escape", async () => {
  setup();
  await screen.findByText("Saved brief");
  fireEvent.change(screen.getByRole("textbox", { name: /^Review note/ }), { target: { value: "Check the logo" } });
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.change(screen.getByRole("textbox", { name: /^Post update/ }), { target: { value: "Draft update" } });
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("textbox", { name: /^Post update/ }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Drawer overlay" }));
  expect(window.confirm).toHaveBeenCalledTimes(2);
  fireEvent.change(screen.getByRole("textbox", { name: /^Review note/ }), { target: { value: "" } });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(window.confirm).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("location")).not.toHaveTextContent("item=1");
});

test("typed reply cannot be lost by hiding or switching threads; Cancel discards it", async () => {
  setup({ comments: [comment(1, "First"), comment(2, "Existing reply", 1), comment(3, "Second")] });
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  const first = screen.getByText("First").closest("section");
  fireEvent.click(within(first).getByRole("button", { name: "Reply" }));
  fireEvent.change(screen.getByRole("textbox", { name: /^Post reply/ }), { target: { value: "Unsent reply" } });
  fireEvent.click(screen.getByRole("button", { name: "Hide 1 reply" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("textbox", { name: /^Post reply/ })).toHaveValue("Unsent reply");
  const second = screen.getByText("Second").closest("section");
  fireEvent.click(within(second).getByRole("button", { name: "Reply" }));
  expect(window.confirm).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("textbox", { name: /^Post reply/ })).toHaveValue("Unsent reply");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(2);
});

test("hiding a thread protects an unsaved edit to an existing reply", async () => {
  setup({ comments: [comment(1, "First"), comment(2, "Existing reply", 1)] });
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.click(screen.getByRole("button", { name: "Show 1 reply" }));
  const reply = screen.getByText("Existing reply").parentElement;
  fireEvent.click(within(reply).getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByRole("textbox", { name: /^Save comment/ }), { target: { value: "Edited reply" } });
  fireEvent.click(screen.getByRole("button", { name: "Hide 1 reply" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("textbox", { name: /^Save comment/ })).toHaveValue("Edited reply");
  window.confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Hide 1 reply" }));
  expect(window.confirm).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(2);
});

test("failed comment save remains dirty and successful save clears only its draft", async () => {
  setup({ comments: [comment(1, "Saved comment")] });
  await screen.findByText("Saved brief");
  fireEvent.change(screen.getByRole("textbox", { name: "Link label" }), { target: { value: "Design file" } });
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByRole("textbox", { name: /^Save comment/ }), { target: { value: "Changed comment" } });
  workApi.editComment.mockRejectedValueOnce(new Error("Save failed"));
  fireEvent.click(screen.getByRole("button", { name: "Save comment" }));
  await waitFor(() => expect(workApi.editComment).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save comment" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  workApi.editComment.mockResolvedValueOnce({ data: {} });
  fireEvent.click(screen.getByRole("button", { name: "Save comment" }));
  await waitFor(() => expect(workApi.editComment).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: /^Save comment/ })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Drawer overlay" }));
  expect(window.confirm).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Link label" }), { target: { value: "" } });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(window.confirm).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("location")).not.toHaveTextContent("item=1");
});

test("reverting a comment edit clears its draft; Cancel clears core without clearing a review note", async () => {
  setup({ comments: [comment(1, "Saved comment")] });
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const commentBody = screen.getByRole("textbox", { name: /^Save comment/ });
  fireEvent.change(commentBody, { target: { value: "Changed comment" } });
  fireEvent.change(commentBody, { target: { value: "Saved comment" } });
  fireEvent.change(screen.getByRole("textbox", { name: /^Review note/ }), { target: { value: "Review draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Edited title" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("textbox", { name: /^Review note/ }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
});

test("sub-work edits survive tabs and failed creation retains the remaining draft", async () => {
  const sub = { id: 4, title: "Prepare artwork", assignee: 1, assignee_detail: { display_name: "Owner" }, completed: false };
  setup({ subs: [sub] });
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: "Edit Prepare artwork" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Sub-work title" }), { target: { value: "Prepare final artwork" } });
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  expect(screen.getByRole("textbox", { name: "Sub-work title" })).toHaveValue("Prepare final artwork");
  fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New sub-work title" }), { target: { value: "Check exports" } });
  workApi.createSubWork.mockRejectedValueOnce(new Error("Save failed"));
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() => expect(workApi.createSubWork).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
});
