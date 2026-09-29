import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequestsPage from "./RequestsPage";
import { workRequestsApi } from "../api/workRequests";

let mockUser = { is_staff: false };
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: mockUser } }) }));
jest.mock("../api/workRequests", () => ({ workRequestsApi: { list: jest.fn() } }));
jest.mock("../components/work/WorkItemDrawer", () => ({
  useWorkItemContext: () => ({ requestRevision: 0 }),
  DrawerLink: ({ children }) => <a href="/requests/new">{children}</a>,
  RequestLink: ({ children }) => <a href="/request">{children}</a>,
}));

beforeEach(() => { mockUser = { is_staff: false }; workRequestsApi.list.mockResolvedValue({ data: [] }); });

test("Requests introduction describes the user's submission workflow", () => {
  render(<MemoryRouter><RequestsPage /></MemoryRouter>);
  expect(screen.getByText("Track the requests you've submitted.")).toBeInTheDocument();
});

test("Requests introduction describes admin triage", () => {
  mockUser = { is_staff: true };
  render(<MemoryRouter><RequestsPage /></MemoryRouter>);
  expect(screen.getByText("Review incoming work and route it into a workspace.")).toBeInTheDocument();
});

test("Requests keeps the desktop table and shows linked compact mobile records", async () => {
  workRequestsApi.list.mockResolvedValue({ data: [{
    id: 5, reference: "REQ-000005", title: "LongUnbrokenRequestTitle".repeat(5),
    request_type_label: "Creative & Design", status: "new", status_label: "New",
    submitted_by_detail: { display_name: "Requester" }, priority: "high",
    requested_due_date: null, created_at: "2026-09-29T00:00:00Z",
  }] });
  render(<MemoryRouter><RequestsPage /></MemoryRouter>);
  const mobile = await screen.findByLabelText("Requests mobile items");
  const link = within(mobile).getByRole("link", { name: /REQ-000005/ });
  expect(link).toHaveAttribute("href", "/request");
  expect(within(link).getByText(/LongUnbrokenRequestTitle/)).toHaveClass("break-all");
  expect(within(mobile).getByText("Requester", { exact: false })).toBeInTheDocument();
  expect(screen.getByRole("table").parentElement).toHaveClass("hidden", "shell:block");
  expect(mobile.closest("[class*='pb-16']")).toHaveClass("pb-16");
  expect(screen.getByRole("link", { name: /Request internal/ })).toBeInTheDocument();
});
