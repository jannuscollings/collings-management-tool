import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "../layout/AppShell";
import WorkItemDrawer from "./WorkItemDrawer";
import { workApi } from "../../api/work";
import { awarenessApi } from "../../api/awareness";

let mockUser = { id: 1, is_staff: true };
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: mockUser } }) }));
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
jest.mock("./NewWorkItemForm", () => () => <div>New work item form</div>);
jest.mock("./WorkItemPanel", () => () => null);
jest.mock("./WorkspaceManagerPanel", () => () => <div>Workspace management interface</div>);
jest.mock("./NotificationsPanel", () => () => null);

beforeEach(() => { jest.resetAllMocks(); mockUser = { id: 1, is_staff: true }; });

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

test.each([
  ["/home?drawer=workspaces", "Workspace management interface"],
  ["/home?drawer=new-work-item&drawerWorkspace=creative-design", "New work item form"],
])("standard users cannot open admin interfaces through %s", async (path, interfaceText) => {
  mockUser = { id: 2, is_staff: false };
  workApi.listWorkspaces.mockResolvedValue({ data: [] });
  awarenessApi.notifications.mockResolvedValue({ data: { items: [], unread_count: 0, next_before: null } });
  render(<MemoryRouter initialEntries={[path]}><WorkItemDrawer><div>Page</div></WorkItemDrawer></MemoryRouter>);
  expect(screen.getByRole("status")).toHaveTextContent("This action is available to administrators.");
  expect(screen.queryByText(interfaceText)).not.toBeInTheDocument();
});
