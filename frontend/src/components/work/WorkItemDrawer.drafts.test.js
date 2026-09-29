import "@testing-library/jest-dom";
import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, createRoutesFromElements, MemoryRouter, Route, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import WorkItemDrawer from "./WorkItemDrawer";
import NavigationGuard from "../navigation/NavigationGuard";
import { workApi } from "../../api/work";
import { awarenessApi } from "../../api/awareness";

let mockCloseDrawer;
let mockUser = { id: 1, is_staff: true };
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: mockUser } }) }));
jest.mock("../../api/work", () => ({
  WORK_STATUS_OPTIONS: [["new", "New"], ["in_progress", "In progress"], ["review", "Review"], ["done", "Done"]],
  WORK_PRIORITY_OPTIONS: [["low", "Low"], ["medium", "Medium"], ["high", "High"]],
  workApi: {
    listWorkspaces: jest.fn(), getItem: jest.fn(), listComments: jest.fn(), listActivity: jest.fn(),
    listSubWork: jest.fn(), listLinks: jest.fn(), getWorkspace: jest.fn(), listUsers: jest.fn(),
    updateItem: jest.fn(), createComment: jest.fn(), getCommentAttachment: jest.fn(), editComment: jest.fn(), createSubWork: jest.fn(),
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
  Trigger: ({ children }) => <>{children}</>,
  Overlay: () => <button aria-label="Drawer overlay" onClick={() => mockCloseDrawer()} />,
  Content: ({ children, className, id }) => <div className={className} id={id}>{children}</div>,
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

function setup({ comments = [], subs = [], links = [], detail = item, guarded = false, strict = false } = {}) {
  workApi.listWorkspaces.mockResolvedValue({ data: [] });
  awarenessApi.notifications.mockResolvedValue({ data: { items: [], unread_count: 0, next_before: null } });
  workApi.getItem.mockResolvedValue({ data: detail });
  workApi.listComments.mockResolvedValue({ data: comments });
  workApi.listActivity.mockResolvedValue({ data: [] });
  workApi.listSubWork.mockResolvedValue({ data: subs });
  workApi.listLinks.mockResolvedValue({ data: links });
  workApi.getWorkspace.mockResolvedValue({ data: { groups: [{ id: 1, name: "Production" }] } });
  workApi.listUsers.mockResolvedValue({ data: [{ id: 1, display_name: "Owner" }, { id: 2, display_name: "Other" }] });
  if (guarded) {
    const router = createMemoryRouter(createRoutesFromElements(<Route element={<NavigationGuard />}>
      <Route path="/home" element={<WorkItemDrawer><Location /></WorkItemDrawer>} />
    </Route>), { initialEntries: ["/home?item=1"] });
    return render(<RouterProvider router={router} />);
  }
  const tree = <MemoryRouter initialEntries={["/home?item=1"]}><WorkItemDrawer><Location /></WorkItemDrawer></MemoryRouter>;
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

beforeEach(() => { jest.resetAllMocks(); mockUser = { id: 1, is_staff: true }; jest.spyOn(window, "confirm").mockReturnValue(false);
  URL.createObjectURL = jest.fn(() => 'blob:preview'); URL.revokeObjectURL = jest.fn(); });
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

test("shared Work Item layout keeps long content, tabs, and final actions usable on mobile", async () => {
  const longText = "UnbrokenWorkItemContent".repeat(8);
  setup({ detail: { ...item, title: longText, brief: longText }, comments: [comment(4, longText)],
    links: [{ id: 5, label: `https://example.com/${longText}`, url: "https://example.com/file" }] });
  const title = await screen.findByRole("heading", { name: longText });
  expect(title).toHaveClass("break-words");
  const details = screen.getByRole("heading", { name: "Delivery details" }).parentElement.parentElement.parentElement;
  expect(within(details).getByText(longText)).toHaveClass("break-words");
  expect(screen.getByRole("navigation", { name: "Work item sections" })).toHaveClass("overflow-x-auto", "shell:overflow-visible");
  const scrollArea = document.querySelector("#cmt-drawer-content > div:last-child");
  expect(scrollArea).toHaveClass("overflow-y-auto", "pb-16", "shell:pb-6");
  expect(screen.getByRole("link", { name: /https:\/\/example.com/ })).toHaveClass("break-all", "shell:truncate");
  expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  const discussion = screen.getByRole("heading", { name: "Discussion" }).parentElement.parentElement;
  expect(within(discussion).getByText(longText)).toHaveClass("break-all", "shell:break-words");
  expect(screen.getByRole("button", { name: "Reply" })).toHaveClass("min-h-11");
});

test("Staff keeps discussion access without Admin and reviewer controls", async () => {
  mockUser = { id: 2, is_staff: false };
  setup({ detail: { ...item, permissions: { edit: false, manage: false, review: false, statuses: ["review"] } } });
  await screen.findByText("Saved brief");
  expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: /^Review note/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  expect(screen.getByRole("textbox", { name: /^Post update/ })).toBeInTheDocument();
});

test("selected files support attachment-only posting, removal, failed retry and independent drafts", async () => {
  setup({ guarded: true });
  await screen.findByText("Saved brief");
  fireEvent.change(screen.getByRole("textbox", { name: /^Review note/ }), { target: { value: "Review draft" } });
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  const picker = screen.getByLabelText("Add attachments to post update");
  const first = new File(["%PDF-hello"], "brief.pdf", { type: "application/pdf" });
  const second = new File(["notes"], "notes.txt", { type: "text/plain" });
  fireEvent.change(picker, { target: { files: [first, second] } });
  expect(screen.getByRole("button", { name: "Post update" })).toBeEnabled();
  expect(screen.getByText("brief.pdf")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove notes.txt" }));
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  workApi.createComment.mockRejectedValueOnce(new Error("Upload failed"));
  fireEvent.click(screen.getByRole("button", { name: "Post update" }));
  await waitFor(() => expect(workApi.createComment).toHaveBeenCalledTimes(1));
  expect(workApi.createComment.mock.calls[0][1].attachments).toEqual([first]);
  await waitFor(() => expect(screen.getByRole("button", { name: "Post update" })).toBeEnabled());
  expect(screen.getByText("brief.pdf")).toBeInTheDocument();
  workApi.createComment.mockResolvedValueOnce({ data: {} });
  fireEvent.click(screen.getByRole("button", { name: "Post update" }));
  await waitFor(() => expect(screen.queryByText("brief.pdf")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).toHaveBeenCalledTimes(2); // review note remains dirty
});

test("successful top-level attachment post clears selection before the next post in StrictMode", async () => {
  setup({ strict: true });
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  const first = new File(["image one"], "first.png", { type: "image/png" });
  const second = new File(["image two"], "second.png", { type: "image/png" });
  workApi.createComment.mockResolvedValue({ data: {} });
  fireEvent.change(screen.getByLabelText("Add attachments to post update"), { target: { files: [first] } });
  fireEvent.click(screen.getByRole("button", { name: "Post update" }));
  await waitFor(() => expect(workApi.createComment).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText("first.png")).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Add attachments to post update"), { target: { files: [second] } });
  fireEvent.click(screen.getByRole("button", { name: "Post update" }));
  await waitFor(() => expect(workApi.createComment).toHaveBeenCalledTimes(2));
  expect(workApi.createComment.mock.calls[1][1].attachments).toEqual([second]);
});

test("pasted screenshot in a reply survives tabs and protects thread switching", async () => {
  setup({ comments: [comment(1, "First"), comment(2, "Second")] });
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.change(screen.getByLabelText("Add attachments to post update"), {
    target: { files: [new File(["%PDF-post"], "post.pdf", { type: "application/pdf" })] },
  });
  fireEvent.click(within(screen.getByText("First").closest("section")).getByRole("button", { name: "Reply" }));
  const screenshot = new File(["image"], "screenshot.png", { type: "image/png" });
  fireEvent.paste(screen.getByRole("textbox", { name: /^Post reply/ }), {
    clipboardData: { items: [{ type: "image/png", getAsFile: () => screenshot }] },
  });
  expect(screen.getByAltText("", { selector: "img" })).toHaveAttribute("src", "blob:preview");
  fireEvent.click(screen.getByRole("button", { name: "Activity" }));
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  expect(screen.getByText("screenshot.png")).toBeInTheDocument();
  fireEvent.click(within(screen.getByText("Second").closest("section")).getByRole("button", { name: "Reply" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  workApi.createComment.mockResolvedValueOnce({ data: {} });
  fireEvent.click(screen.getByRole("button", { name: "Post reply" }));
  await waitFor(() => expect(workApi.createComment).toHaveBeenCalledTimes(1));
  expect(workApi.createComment.mock.calls[0][1]).toMatchObject({ body: "", parent: 1, attachments: [screenshot] });
  expect(screen.getByText("post.pdf")).toBeInTheDocument();
});

test("removing the final attachment clears only that discussion dirty source", async () => {
  setup();
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  fireEvent.change(screen.getByLabelText("Add attachments to post update"), {
    target: { files: [new File(["%PDF-file"], "draft.pdf", { type: "application/pdf" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Remove draft.pdf" }));
  fireEvent.click(screen.getByRole("button", { name: "Close work item" }));
  expect(window.confirm).not.toHaveBeenCalled();
  expect(screen.getByTestId("location")).not.toHaveTextContent("item=1");
});

test("posted images and files use authenticated attachment retrieval", async () => {
  const posted = { ...comment(1, "See files"), attachments: [
    { id: 10, filename: "screenshot.png", content_type: "image/png", size: 10 },
    { id: 11, filename: "brief.pdf", content_type: "application/pdf", size: 20 },
  ] };
  workApi.getCommentAttachment.mockResolvedValue({ data: new Blob(["file"]) });
  setup({ comments: [posted] });
  await screen.findByText("Saved brief");
  fireEvent.click(screen.getByRole("button", { name: /Updates/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: "View screenshot.png" })).toBeInTheDocument());
  expect(workApi.getCommentAttachment).toHaveBeenCalledWith("1", 1, 10);
  expect(screen.getByRole("button", { name: "Download brief.pdf" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View screenshot.png" }));
  expect(screen.getByRole("button", { name: "Close image" })).toBeInTheDocument();
});
