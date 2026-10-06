import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage, { homeAttentionRows } from "./HomePage";
import { awarenessApi } from "../api/awareness";

let mockUser = { first_name: "Michael", is_staff: true };
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: mockUser } }) }));
jest.mock("../api/awareness", () => ({ awarenessApi: { home: jest.fn() } }));
jest.mock("../components/search/SearchDialog", () => () => null);
jest.mock("../components/work/WorkItemDrawer", () => ({
  useWorkItemContext: () => ({ revision: 0, requestRevision: 0, workspaceRevision: 0 }),
  DrawerLink: ({ children }) => <a href="/new-request">{children}</a>,
  WorkItemLink: ({ children }) => <a href="/item">{children}</a>,
  RequestLink: ({ children }) => <a href="/request">{children}</a>,
}));

const item = { id: 1, reference: "WI-000001", title: "Revise copy", group__workspace__name: "Creative", status: "in_progress", priority: "high", due_date: null };
const section = (...items) => ({ count: items.length, items });

beforeEach(() => { mockUser = { first_name: "Michael", is_staff: true }; });

test("Home keeps distinct attention reasons and opens existing work items", async () => {
  awarenessApi.home.mockResolvedValue({ data: { today: "2026-09-29", overdue: section(item), review: section(item), my_open: section(item), recent: section(item) } });
  expect(homeAttentionRows({ overdue: section(item), review: section(item), my_open: section(item) })).toHaveLength(1);
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Hi, Michael" })).toBeInTheDocument();
  const table = await screen.findByRole("table");
  expect(within(table).getByRole("columnheader", { name: "Work Item" })).toBeInTheDocument();
  expect(within(table).getByRole("link", { name: /WI-000001 Revise copy/ })).toHaveAttribute("href", "/item");
  expect(within(table).getByText("Overdue")).toBeInTheDocument();
  expect(within(table).getByText("Waiting for your review")).toBeInTheDocument();
  expect(within(table).queryByText("My open work")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Recent" }));
  expect(within(screen.getByRole("table")).getByText("Recently updated")).toBeInTheDocument();
});

test("Admin request triage remains accessible and due links retain My Work filters", async () => {
  awarenessApi.home.mockResolvedValue({ data: { today: "2026-09-29", overdue: { count: 13, items: [item] }, triage: section({ id: 2, reference: "WR-000002", title: "Needs triage", status: "new" }) } });
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByRole("link", { name: /View all overdue in My Work/ })).toHaveAttribute("href", "/my-work?due=overdue");
  fireEvent.click(screen.getByRole("tab", { name: "Requests (1)" }));
  expect(screen.getByRole("link", { name: /WR-000002 Needs triage/ })).toHaveAttribute("href", "/request");
  expect(screen.getByRole("link", { name: "View all Requests" })).toHaveAttribute("href", "/requests");
});

test("Staff sees compact cards and no Admin triage control", async () => {
  mockUser = { first_name: "CG", is_staff: false };
  const longTitle = "LongUnbrokenTitle".repeat(8);
  awarenessApi.home.mockResolvedValue({ data: { today: "2026-09-29", changes_requested: section({ ...item, title: longTitle }), triage: section({ id: 2, title: "Admin request" }) } });
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  const links = await screen.findAllByRole("link", { name: /WI-000001/ });
  expect(links).toHaveLength(2);
  expect(within(links[1]).getByText(longTitle)).toHaveClass("break-all");
  expect(screen.getByRole("list").closest(".shell\\:hidden")).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Requests/ })).not.toBeInTheDocument();
  expect(screen.getAllByText("Changes requested")).toHaveLength(2);
});
