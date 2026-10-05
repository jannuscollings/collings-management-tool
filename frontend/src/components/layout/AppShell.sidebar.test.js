import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AppShell from "./AppShell";

jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: { is_staff: true } } }) }));
jest.mock("../work/WorkItemDrawer", () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
  useWorkItemContext: () => ({ workspaces: [
    { id: 1, slug: "creative", name: "Creative & Design With A Very Long Name" },
    { id: 2, slug: "operations", name: "Operations" },
  ], workspaceLoadError: false }),
  DrawerLink: ({ drawer, children, ...props }) => <a href={`?drawer=${drawer}`} {...props}>{children}</a>,
}));
jest.mock("./AppHeader", () => () => <header>Header</header>);
jest.mock("./MobileNavigation", () => () => <nav aria-label="Mobile primary navigation" className="shell:hidden">Mobile</nav>);

function setup(path = "/home") {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<AppShell />}>
    <Route path="/home" element={<p>Home page</p>} />
    <Route path="/my-work" element={<p>My Work page</p>} />
    <Route path="/workspaces/:slug" element={<p>Workspace page</p>} />
  </Route></Routes></MemoryRouter>);
}

beforeEach(() => window.localStorage.clear());

test("collapses and expands while primary and workspace links remain usable", () => {
  setup();
  const nav = within(screen.getByRole("navigation", { name: "Primary navigation" }));
  const shell = screen.getByRole("button", { name: "Collapse sidebar" }).parentElement.parentElement;
  expect(shell).toHaveClass("shell:grid-cols-[250px_minmax(0,1fr)]");
  expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(shell).toHaveClass("shell:grid-cols-[72px_minmax(0,1fr)]");
  expect(window.localStorage.getItem("cmt-sidebar-collapsed")).toBe("true");
  expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("title", "Home");
  expect(nav.getByRole("link", { name: "Creative & Design With A Very Long Name" })).toHaveAttribute("title", "Creative & Design With A Very Long Name");
  fireEvent.click(nav.getByRole("link", { name: "My Work" }));
  expect(nav.getByRole("link", { name: "My Work" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(nav.getByRole("link", { name: "Operations" }));
  expect(nav.getByRole("link", { name: "Operations" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("Workspace page")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect(shell).toHaveClass("shell:grid-cols-[250px_minmax(0,1fr)]");
  expect(window.localStorage.getItem("cmt-sidebar-collapsed")).toBe("false");
  expect(nav.getByText("Creative & Design With A Very Long Name")).toHaveClass("truncate");
});

test("restores a saved preference and keeps mobile layout classes independent", () => {
  window.localStorage.setItem("cmt-sidebar-collapsed", "true");
  const { unmount } = setup();
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Mobile primary navigation" })).toHaveClass("shell:hidden");
  unmount();

  window.localStorage.setItem("cmt-sidebar-collapsed", "invalid");
  setup();
  expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
});
