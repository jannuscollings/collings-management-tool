import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequestDetailPanel from "./RequestDetailPanel";
import { workRequestsApi } from "../../api/workRequests";
import { workApi } from "../../api/work";

let mockIsAdmin = true;
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: { is_staff: mockIsAdmin } } }) }));
jest.mock("../../api/workRequests", () => ({
  REQUEST_PRIORITY_OPTIONS: [["low", "Low"], ["medium", "Medium"], ["high", "High"]],
  workRequestsApi: { get: jest.fn(), triage: jest.fn(), accept: jest.fn(), reject: jest.fn() },
}));
jest.mock("../../api/work", () => ({ workApi: { listWorkspaces: jest.fn(), getWorkspace: jest.fn(), listUsers: jest.fn() } }));

const request = {
  id: 3, reference: "WR-000003", title: "Campaign", status: "triaging", status_label: "Triaging",
  created_at: "2026-09-28T00:00:00Z", request_type_label: "Creative & Design",
  submitted_by_detail: { display_name: "Requester" }, priority: "medium", requested_due_date: null,
  brief: "Campaign brief", destination_group: 1, triage_priority: null, triage_due_date: null,
  owner: 7, reviewer: null, resulting_work_item_detail: null,
};

beforeEach(() => {
  jest.resetAllMocks();
  mockIsAdmin = true;
  workRequestsApi.get.mockResolvedValue({ data: request });
  workApi.listWorkspaces.mockResolvedValue({ data: [{ slug: "creative-design" }] });
  workApi.getWorkspace.mockResolvedValue({ data: { name: "Creative & Design", groups: [{ id: 1, name: "Production" }] } });
  workApi.listUsers.mockResolvedValue({ data: [{ id: 7, display_name: "Alice" }, { id: 8, display_name: "Bob" }] });
});

test("request details wrap long content and keep mobile actions and bottom clearance", async () => {
  const longText = "UnbrokenRequestContent".repeat(10);
  workRequestsApi.get.mockResolvedValue({ data: { ...request, title: longText, brief: longText } });
  render(<MemoryRouter><RequestDetailPanel requestId={3} drawer /></MemoryRouter>);
  const heading = await screen.findByRole("heading", { name: longText });
  expect(heading.closest(".break-all")).toBeInTheDocument();
  expect(screen.getByText(longText, { selector: "dd" })).toHaveClass("break-all", "shell:break-words");
  expect(heading.closest("[class*='pb-16']")).toHaveClass("pb-16", "shell:pb-0");
  expect(screen.getByRole("button", { name: "Save triage" })).toHaveClass("min-h-11");
  expect(screen.getByRole("button", { name: "Accept request" })).toBeInTheDocument();
});

test("staff request detail remains read-only with mobile clearance", async () => {
  mockIsAdmin = false;
  render(<MemoryRouter><RequestDetailPanel requestId={3} /></MemoryRouter>);
  await screen.findByText("Original request details");
  expect(screen.queryByRole("button", { name: "Save triage" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
  expect(screen.getByText("Original request details").closest("[class*='pb-16']")).toHaveClass("pb-16");
});

test("accept stays disabled for changed triage until the visible values are saved", async () => {
  const saved = { ...request, owner: 8 };
  workRequestsApi.triage.mockResolvedValue({ data: saved });
  workRequestsApi.accept.mockResolvedValue({ data: {
    ...saved, status: "accepted", status_label: "Accepted",
    can_view_resulting_work_item: true,
    resulting_work_item_detail: { id: 4, reference: "WI-000004", group_name: "Production", workspace_name: "Creative & Design", workspace_slug: "creative-design" },
  } });
  render(<MemoryRouter><RequestDetailPanel requestId={3} /></MemoryRouter>);

  const accept = await screen.findByRole("button", { name: "Accept request" });
  expect(accept).toBeEnabled();
  fireEvent.change(screen.getByRole("combobox", { name: "Owner" }), { target: { value: "8" } });
  expect(accept).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Save triage before accepting the request.");
  fireEvent.click(accept);
  expect(workRequestsApi.accept).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Save triage" }));
  await waitFor(() => expect(workRequestsApi.triage).toHaveBeenCalledWith(3, {
    destination_group: 1, triage_priority: null, triage_due_date: null, owner: 8, reviewer: null,
  }));
  await waitFor(() => expect(accept).toBeEnabled());
  expect(screen.getByRole("combobox", { name: "Owner" })).toHaveValue("8");
  fireEvent.click(accept);
  await waitFor(() => expect(workRequestsApi.accept).toHaveBeenCalledWith(3));
  expect(await screen.findByText("Resulting work item")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open WI-000004/ })).toHaveAttribute("href", "/workspaces/creative-design/items/4");
});

test("rejection requires a reason and shows it to the requester", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  workRequestsApi.reject.mockResolvedValue({ data: {
    ...request, status: "rejected", status_label: "Rejected", rejection_reason: "Use the current assets.",
  } });
  const { unmount } = render(<MemoryRouter><RequestDetailPanel requestId={3} /></MemoryRouter>);
  const reject = await screen.findByRole("button", { name: "Reject request" });
  expect(reject).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: /Rejection reason/ }), { target: { value: "  Use the current assets.  " } });
  expect(reject).toBeEnabled();
  fireEvent.click(reject);
  await waitFor(() => expect(workRequestsApi.reject).toHaveBeenCalledWith(3, { rejection_reason: "Use the current assets." }));
  expect(await screen.findByText("Use the current assets.")).toBeInTheDocument();
  confirm.mockRestore();
  unmount();
  mockIsAdmin = false;
  workRequestsApi.get.mockResolvedValue({ data: { ...request, status: "rejected", status_label: "Rejected", rejection_reason: "Use the current assets." } });
  render(<MemoryRouter><RequestDetailPanel requestId={3} /></MemoryRouter>);
  expect(await screen.findByText("Use the current assets.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reject request" })).not.toBeInTheDocument();
});

test("accepted request shows reference and destination without a misleading link when access is restricted", async () => {
  mockIsAdmin = false;
  workRequestsApi.get.mockResolvedValue({ data: {
    ...request, status: "accepted", status_label: "Accepted", can_view_resulting_work_item: false,
    resulting_work_item_detail: { id: 4, reference: "WI-000004", group_name: "Production", workspace_name: "Creative & Design", workspace_slug: "creative-design" },
  } });
  render(<MemoryRouter><RequestDetailPanel requestId={3} /></MemoryRouter>);
  expect(await screen.findByText("WI-000004")).toBeInTheDocument();
  expect(screen.getByText("Destination: Creative & Design / Production")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Open WI-000004/ })).not.toBeInTheDocument();
  expect(screen.getByText("This work item is available to its assigned delivery team.")).toBeInTheDocument();
});

test("returning a changed field to its persisted value restores acceptance", async () => {
  render(<MemoryRouter><RequestDetailPanel requestId={3} /></MemoryRouter>);
  const accept = await screen.findByRole("button", { name: "Accept request" });
  const owner = screen.getByRole("combobox", { name: "Owner" });
  fireEvent.change(owner, { target: { value: "8" } });
  expect(accept).toBeDisabled();
  fireEvent.change(owner, { target: { value: "7" } });
  expect(accept).toBeEnabled();
  expect(screen.queryByText("Save triage before accepting the request.")).not.toBeInTheDocument();
});
