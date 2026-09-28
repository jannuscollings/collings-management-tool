import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, createRoutesFromElements, Route, RouterProvider, useLocation } from "react-router-dom";

import MobileNavigation from "./MobileNavigation";
import AppHeader from "./AppHeader";
import NavigationGuard, { useDraftScope, pageSurvives } from "../navigation/NavigationGuard";

let mockUser = { is_staff: true };
let mockWorkspaces = [{ id: 1, slug: "creative", name: "Creative" }];
let mockWorkspaceLoadError = false;
const mockRetryWorkspaces = jest.fn();

jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: mockUser } }) }));
jest.mock("../work/WorkItemDrawer", () => {
  const { Link, useLocation } = require("react-router-dom");
  return {
    useWorkItemContext: () => ({ workspaces: mockWorkspaces, workspaceLoadError: mockWorkspaceLoadError, retryWorkspaces: mockRetryWorkspaces, unreadCount: 3 }),
    DrawerLink: ({ drawer, children, ...props }) => {
      const location = useLocation();
      const params = new URLSearchParams(location.search);
      params.set("drawer", drawer);
      return <Link {...props} to={{ pathname: location.pathname, search: params.toString() }}>{children}</Link>;
    },
  };
});
jest.mock("./AccountMenu", () => () => <button type="button">Account controls</button>);
jest.mock("./NotificationLink", () => () => <button type="button">Notifications utility</button>);
jest.mock("../search/SearchDialog", () => ({ open }) => open ? <div role="dialog" aria-label="Search dialog">Search dialog</div> : null);
jest.mock("@radix-ui/react-dialog", () => {
  let close;
  return {
    Root: ({ open, onOpenChange, children }) => { close = () => onOpenChange(false); return open ? <>{children}</> : null; },
    Portal: ({ children }) => <>{children}</>, Overlay: () => <div />,
    Content: ({ children, ...props }) => <div role="dialog" {...props}>{children}</div>,
    Title: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
    Description: ({ children, ...props }) => <p {...props}>{children}</p>,
    Close: ({ children, ...props }) => <button type="button" {...props} onClick={() => close()}>{children}</button>,
  };
});

function Page() {
  const location = useLocation();
  const setDirty = useDraftScope("page", pageSurvives(location.pathname));
  return <><output data-testid="location">{location.pathname}{location.search}</output><button type="button" onClick={() => setDirty(true)}>Make dirty</button><MobileNavigation /></>;
}

function setup(path = "/home", header = false) {
  const element = header ? <><AppHeader /><MobileNavigation /></> : <Page />;
  const router = createMemoryRouter(createRoutesFromElements(<Route element={<NavigationGuard />}>
    <Route path="/home" element={element} />
    <Route path="/my-work" element={element} />
    <Route path="/requests" element={element} />
    <Route path="/workspaces/:slug" element={element} />
  </Route>), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => { mockUser = { is_staff: true }; mockWorkspaces = [{ id: 1, slug: "creative", name: "Creative" }]; mockWorkspaceLoadError = false; });
afterEach(() => { jest.clearAllMocks(); });

test("bottom destinations use existing routes, show active state, and open URL-backed notifications", async () => {
  setup();
  const nav = screen.getByRole("navigation", { name: "Mobile primary navigation" });
  expect(nav).toHaveClass("shell:hidden");
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("link", { name: "My Work" }));
  await waitFor(() => expect(screen.getByRole("link", { name: "My Work" })).toHaveAttribute("aria-current", "page"));
  fireEvent.click(screen.getByRole("link", { name: "Requests" }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/requests"));
  fireEvent.click(screen.getByRole("link", { name: /Notifications, 3 unread/ }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("?drawer=notifications"));
  expect(screen.getByRole("link", { name: /Notifications, 3 unread/ })).toHaveAttribute("aria-current", "page");
});

test("More exposes workspace navigation, retry, account, and admin management", async () => {
  mockWorkspaceLoadError = true;
  setup();
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(screen.getByRole("link", { name: "Creative" })).toHaveAttribute("href", "/workspaces/creative");
  expect(screen.getByRole("link", { name: "Manage workspaces" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Account controls" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reload workspaces" }));
  expect(mockRetryWorkspaces).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("link", { name: "Creative" }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/creative"));
  expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-current", "page");
});

test("Staff sees the shared shell without admin-only workspace management", () => {
  mockUser = { is_staff: false };
  setup();
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(screen.getByRole("link", { name: "Creative" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Manage workspaces" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Account controls" })).toBeInTheDocument();
});

test("More navigation uses the existing dirty-work guard", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Make dirty" }));
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(screen.getByRole("link", { name: "Creative" }));
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId("location")).toHaveTextContent("/home");
  expect(screen.getByRole("link", { name: "Creative" })).toBeInTheDocument();
  confirm.mockRestore();
});

test("mobile header shows context and opens the existing Search; desktop header remains present", () => {
  setup("/workspaces/creative", true);
  expect(screen.getByText("Creative")).toBeInTheDocument();
  expect(screen.getByText("CMT")).toBeInTheDocument();
  expect(screen.getByText("CMT").parentElement).toHaveClass("shell:flex");
  fireEvent.click(screen.getAllByRole("button", { name: "Search work, requests, and spaces" })[0]);
  expect(screen.getByRole("dialog", { name: "Search dialog" })).toBeInTheDocument();
});
