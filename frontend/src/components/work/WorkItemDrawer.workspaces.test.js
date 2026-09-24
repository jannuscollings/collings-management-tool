import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "../layout/AppShell";
import { workApi } from "../../api/work";
import { awarenessApi } from "../../api/awareness";

jest.mock("react-redux", () => ({ useSelector: () => ({ id: 1, is_staff: true }) }));
jest.mock("../../api/work", () => ({ workApi: { listWorkspaces: jest.fn() } }));
jest.mock("../../api/awareness", () => ({ awarenessApi: { notifications: jest.fn() } }));
jest.mock("../layout/AccountMenu", () => () => null);
jest.mock("../layout/NotificationLink", () => () => null);
jest.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children }) => <>{children}</>,
  Portal: ({ children }) => <>{children}</>,
  Overlay: () => null,
  Content: ({ children }) => <div>{children}</div>,
  Title: ({ children }) => <div>{children}</div>,
  Description: ({ children }) => <div>{children}</div>,
  Close: ({ children }) => <div>{children}</div>,
}));
jest.mock("../requests/NewRequestForm", () => () => null);
jest.mock("../requests/RequestDetailPanel", () => () => null);
jest.mock("./NewWorkItemForm", () => () => null);
jest.mock("./WorkItemPanel", () => () => null);
jest.mock("./WorkspaceManagerPanel", () => () => null);
jest.mock("./NotificationsPanel", () => () => null);

test("a transient workspace load failure does not leave navigation empty", async () => {
  workApi.listWorkspaces
    .mockRejectedValueOnce(new Error("Temporary failure"))
    .mockResolvedValueOnce({ data: [
      { id: 2, name: "Property Agents", slug: "property-agents" },
      { id: 1, name: "Creative & Design", slug: "creative-design" },
    ] });
  awarenessApi.notifications.mockResolvedValue({ data: { items: [], unread_count: 0, next_before: null } });

  render(<MemoryRouter initialEntries={["/home"]}><AppShell /></MemoryRouter>);

  await waitFor(() => expect(screen.getAllByRole("link", { name: "Property Agents" })).toHaveLength(2), { timeout: 2500 });
  expect(workApi.listWorkspaces).toHaveBeenCalledTimes(2);
  for (const name of ["Primary navigation", "Mobile navigation"]) {
    const nav = within(screen.getByRole("navigation", { name }));
    expect(nav.getAllByRole("link").filter((link) => link.getAttribute("href").startsWith("/workspaces/")).map((link) => link.textContent))
      .toEqual(["Property Agents", "Creative & Design"]);
    expect(nav.getByRole("link", { name: /manage workspaces/i })).not.toBeNull();
  }
});
