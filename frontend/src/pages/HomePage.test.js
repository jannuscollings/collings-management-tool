import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";
import { awarenessApi } from "../api/awareness";

jest.mock("../api/awareness", () => ({ awarenessApi: { home: jest.fn() } }));
jest.mock("../components/work/WorkItemDrawer", () => ({
  useWorkItemContext: () => ({ revision: 0, requestRevision: 0, workspaceRevision: 0 }),
  DrawerLink: ({ children }) => <a href="/new-request">{children}</a>,
  WorkItemLink: ({ children }) => <a href="/item">{children}</a>,
  RequestLink: ({ children }) => <a href="/request">{children}</a>,
}));

test("Home keeps its work and triage links readable with mobile bottom clearance", async () => {
  const longTitle = "LongUnbrokenTitle".repeat(8);
  awarenessApi.home.mockResolvedValue({ data: {
    today: "2026-09-29",
    my_open: { count: 1, items: [{ id: 1, reference: "WI-000001", title: longTitle,
      group__workspace__name: longTitle, priority: "high", due_date: null, status: "new" }] },
    triage: { count: 1, items: [{ id: 2, reference: "REQ-000002", title: "Needs triage" }] },
  } });
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  const workLink = await screen.findByRole("link", { name: /WI-000001/ });
  expect(workLink).toHaveAttribute("href", "/item");
  expect(within(workLink).getByText(longTitle)).toHaveClass("break-all", "shell:break-words");
  expect(screen.getByText("Needs triage").closest("a")).toHaveAttribute("href", "/request");
  expect(screen.getByText("Home").closest("[class*='pb-16']")).toHaveClass("pb-16", "shell:pb-[34px]");
  expect(screen.getByRole("link", { name: /New request/ })).toBeInTheDocument();
});

test("Home links each distinct attention group to its complete My Work filter", async () => {
  const section = { count: 13, items: [] };
  awarenessApi.home.mockResolvedValue({ data: {
    today: "2026-09-29", overdue: section, due_today: section, due_soon: section,
  } });
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByRole("link", { name: /View all overdue in My Work/ })).toHaveAttribute("href", "/my-work?due=overdue");
  expect(screen.getByRole("link", { name: /View all due today in My Work/ })).toHaveAttribute("href", "/my-work?due=today");
  expect(screen.getByRole("link", { name: /View all due soon in My Work/ })).toHaveAttribute("href", "/my-work?due=soon");
});
