import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import { workApi } from "../../api/work";

let mockIsAdmin = true;
let mockWorkspaces = [];
const mockRefreshWorkspaces = jest.fn();

jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: { is_staff: mockIsAdmin } } }) }));
jest.mock("../../api/work", () => ({ workApi: { updateWorkspace: jest.fn(), archiveWorkspace: jest.fn() } }));
jest.mock("@radix-ui/react-dropdown-menu", () => {
  const React = require("react");
  const MenuContext = React.createContext(null);
  return {
    Root: ({ children }) => {
      const [open, setOpen] = React.useState(false);
      return <MenuContext.Provider value={{ open, setOpen }}>{children}</MenuContext.Provider>;
    },
    Trigger: ({ children }) => {
      const { setOpen } = React.useContext(MenuContext);
      return React.cloneElement(children, { onClick: () => setOpen((open) => !open) });
    },
    Portal: ({ children }) => <>{children}</>,
    Content: ({ children }) => {
      const { open, setOpen } = React.useContext(MenuContext);
      return open ? <div role="menu" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>{children}</div> : null;
    },
    Item: ({ children, onSelect, asChild }) => {
      const { setOpen } = React.useContext(MenuContext);
      const click = (event) => { children?.props?.onClick?.(event); onSelect?.(event); setOpen(false); };
      return asChild ? React.cloneElement(children, { role: "menuitem", onClick: click })
        : <button type="button" role="menuitem" onClick={click}>{children}</button>;
    },
  };
});
jest.mock("../work/WorkItemDrawer", () => ({
  useWorkItemContext: () => ({ workspaces: mockWorkspaces, workspaceLoadError: false, refreshWorkspaces: mockRefreshWorkspaces }),
  DrawerLink: ({ drawer, children, ...props }) => {
    const { Link: MockLink, useLocation: mockUseLocation } = require("react-router-dom");
    const location = mockUseLocation();
    return <MockLink to={`${location.pathname}?drawer=${drawer}`} {...props}>{children}</MockLink>;
  },
}));

function LocationState() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}{location.search}</p>;
}

function setup({ collapsed = false, path = "/home" } = {}) {
  return render(<MemoryRouter initialEntries={[path]}><Sidebar collapsed={collapsed} onToggle={() => {}} /><LocationState /></MemoryRouter>);
}

async function action(label = "Creative") {
  fireEvent.click(screen.getByRole("button", { name: `Actions for ${label}` }));
  return screen.findByRole("menuitem", { name: "Rename workspace" });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdmin = true;
  mockWorkspaces = [{ id: 1, slug: "creative", name: "Creative" }, { id: 2, slug: "operations", name: "Operations" }];
  workApi.updateWorkspace.mockImplementation(async (_slug, payload) => {
    mockWorkspaces = mockWorkspaces.map((workspace) => workspace.slug === "creative" ? { ...workspace, name: payload.name } : workspace);
    return { data: mockWorkspaces[0] };
  });
  workApi.archiveWorkspace.mockResolvedValue({ data: { archived: true } });
});

test("Admin actions are separate from Workspace navigation and preserve active state", async () => {
  setup({ path: "/workspaces/creative" });
  const nav = within(screen.getByRole("navigation", { name: "Primary navigation" }));
  expect(nav.getByRole("link", { name: "Creative" })).toHaveAttribute("aria-current", "page");
  expect(nav.getByRole("button", { name: "Actions for Creative" })).toBeInTheDocument();
  await action();
  expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/creative");
  expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  fireEvent.click(nav.getByRole("link", { name: "Operations" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/operations");
  expect(nav.getByRole("link", { name: "Operations" })).toHaveAttribute("aria-current", "page");
});

test("Staff sees Workspace links without quick actions", () => {
  mockIsAdmin = false;
  setup();
  expect(screen.getByRole("link", { name: "Creative" })).toHaveAttribute("href", "/workspaces/creative");
  expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
});

test("collapsed Admin rail keeps the existing titled links without action buttons", () => {
  setup({ collapsed: true });
  expect(screen.getByRole("link", { name: "Creative" })).toHaveAttribute("title", "Creative");
  expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Creative" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/creative");
});

test("Enter renames through the stable slug and refreshed data retains the name", async () => {
  const view = setup();
  fireEvent.click(await action());
  const input = await screen.findByRole("textbox", { name: "Rename Creative" });
  expect(input).toHaveValue("Creative");
  expect(input).toHaveFocus();
  expect(screen.queryByRole("link", { name: "Creative" })).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: "Creative Studio" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(workApi.updateWorkspace).toHaveBeenCalledWith("creative", { name: "Creative Studio" }));
  await waitFor(() => expect(screen.getByRole("link", { name: "Creative Studio" })).toHaveAttribute("href", "/workspaces/creative"));
  expect(mockRefreshWorkspaces).toHaveBeenCalledTimes(1);
  view.unmount();
  setup();
  expect(screen.getByRole("link", { name: "Creative Studio" })).toBeInTheDocument();
});

test("Escape cancels, blank Enter is rejected, and valid blur saves", async () => {
  setup();
  fireEvent.click(await action());
  let input = await screen.findByRole("textbox", { name: "Rename Creative" });
  fireEvent.change(input, { target: { value: "Discard me" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.getByRole("link", { name: "Creative" })).toBeInTheDocument();
  expect(workApi.updateWorkspace).not.toHaveBeenCalled();

  fireEvent.click(await action());
  input = await screen.findByRole("textbox", { name: "Rename Creative" });
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a workspace name.");
  expect(workApi.updateWorkspace).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "New name" } });
  fireEvent.blur(input);
  await waitFor(() => expect(screen.getByRole("link", { name: "New name" })).toBeInTheDocument());
});

test("a failed rename keeps the draft visible for correction", async () => {
  workApi.updateWorkspace.mockRejectedValueOnce({ response: { data: { name: ["Name already in use."] } } });
  setup();
  fireEvent.click(await action());
  const input = await screen.findByRole("textbox", { name: "Rename Creative" });
  fireEvent.change(input, { target: { value: "Operations" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent("Name already in use.");
  expect(input).toHaveValue("Operations");
  expect(screen.queryByRole("link", { name: "Creative" })).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.getByRole("link", { name: "Creative" })).toBeInTheDocument();
});

test("Manage boards opens the existing Workspace management drawer", async () => {
  setup({ path: "/workspaces/creative" });
  await action();
  fireEvent.click(screen.getByRole("menuitem", { name: "Manage boards" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/creative?drawer=workspaces");
});

test("Archive uses confirmation, removes active navigation, and leaves the stable API intact", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  setup({ path: "/workspaces/creative" });
  await action();
  fireEvent.click(screen.getByRole("menuitem", { name: "Archive workspace" }));
  expect(workApi.archiveWorkspace).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Creative" })).toBeInTheDocument();
  await action();
  fireEvent.click(screen.getByRole("menuitem", { name: "Archive workspace" }));
  await waitFor(() => expect(workApi.archiveWorkspace).toHaveBeenCalledWith("creative"));
  await waitFor(() => expect(screen.queryByRole("link", { name: "Creative" })).not.toBeInTheDocument());
  expect(mockRefreshWorkspaces).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("location")).toHaveTextContent("/home");
  confirm.mockRestore();
});
