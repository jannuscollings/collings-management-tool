import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, createRoutesFromElements, Route, RouterProvider, useLocation } from "react-router-dom";

import AppHeader from "../layout/AppHeader";
import NavigationGuard, { drawerIdentity, drawerSurvives, useDraftScope } from "../navigation/NavigationGuard";
import { searchApi } from "../../api/search";

jest.mock("../../api/search", () => ({ searchApi: { search: jest.fn() } }));
jest.mock("../layout/AccountMenu", () => () => <button type="button">Account</button>);
jest.mock("../layout/NotificationLink", () => () => <button type="button">Notifications</button>);
jest.mock("@radix-ui/react-dialog", () => {
  let close;
  return {
    Root: ({ open, onOpenChange, children }) => {
      const React = require("react");
      close = () => onOpenChange(false);
      React.useEffect(() => {
        const onKeyDown = (event) => { if (event.key === "Escape") onOpenChange(false); };
        globalThis.document.addEventListener("keydown", onKeyDown);
        return () => globalThis.document.removeEventListener("keydown", onKeyDown);
      }, [onOpenChange]);
      return open ? <>{children}</> : null;
    },
    Portal: ({ children }) => <>{children}</>,
    Overlay: () => <div />,
    Content: ({ children, onCloseAutoFocus, ...props }) => {
      const React = require("react");
      React.useEffect(() => () => onCloseAutoFocus({ preventDefault() {} }), []);
      return <div role="dialog" {...props}>{children}</div>;
    },
    Title: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
    Close: ({ children, ...props }) => <button {...props} onClick={() => close()}>{children}</button>,
  };
});

const result = (id, title) => ({ id, reference: `WI-${String(id).padStart(6, "0")}`, title,
  workspaceName: "Creative", workspaceSlug: "creative", boardName: "Website", status: "new", priority: "high", owner: "Sarah", dueDate: null, excerpt: null });
const response = (...workItems) => ({ data: { results: { workItems, requests: [], workspaces: [], boards: [] } } });

function Page() {
  const location = useLocation();
  const identity = drawerIdentity(location);
  const setDirty = useDraftScope("drawer", drawerSurvives(identity));
  return <>
    <AppHeader />
    <output data-testid="location">{location.pathname}{location.search}</output>
    {identity && <input aria-label="Editor draft" onChange={(event) => setDirty(Boolean(event.target.value))} />}
  </>;
}

function setup(path = "/home?item=1") {
  const router = createMemoryRouter(createRoutesFromElements(<Route element={<NavigationGuard />}>
    <Route path="/home" element={<Page />} />
    <Route path="/workspaces/:workspaceSlug" element={<Page />} />
  </Route>), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  searchApi.search.mockResolvedValue(response(result(1, "Homepage"), result(2, "Homepage follow-up")));
  jest.spyOn(window, "confirm").mockReturnValue(false);
});
afterEach(() => { window.confirm.mockRestore(); jest.clearAllMocks(); });

test("click and shortcut open Search without removing a dirty editor; Escape returns focus", async () => {
  setup();
  fireEvent.change(screen.getByRole("textbox", { name: "Editor draft" }), { target: { value: "Keep this" } });
  const trigger = screen.getAllByRole("button", { name: "Search work, requests, and spaces" })[0];
  fireEvent.click(trigger);
  expect(screen.getByRole("searchbox", { name: "Search work, requests, and spaces" })).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "Editor draft" })).toHaveValue("Keep this");
  expect(window.confirm).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Search CMT" })).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(screen.getByRole("searchbox", { name: "Search work, requests, and spaces" })).toHaveFocus();
});

test("cancelled guard keeps query and results; discard navigates once", async () => {
  setup();
  fireEvent.change(screen.getByRole("textbox", { name: "Editor draft" }), { target: { value: "Draft" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Search work, requests, and spaces" })[0]);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "homepage" } });
  await screen.findByRole("button", { name: /Work Item WI-000002 Homepage follow-up/ });
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("searchbox")).toHaveValue("homepage");
  expect(screen.getByRole("textbox", { name: "Editor draft" })).toHaveValue("Draft");
  expect(screen.getByTestId("location")).toHaveTextContent("?item=1");
  window.confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: /Work Item WI-000002 Homepage follow-up/ }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("?item=2"));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Search CMT" })).not.toBeInTheDocument());
  expect(window.confirm).toHaveBeenCalledTimes(2);
});

test("stale response cannot replace results for a newer query; category and empty state work", async () => {
  let resolveOld;
  searchApi.search.mockImplementation((query) => query === "old" ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve(response(result(3, "New result"))));
  setup("/home");
  fireEvent.click(screen.getAllByRole("button", { name: "Search work, requests, and spaces" })[0]);
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "old" } });
  await waitFor(() => expect(searchApi.search).toHaveBeenCalledWith("old", expect.anything()));
  fireEvent.change(input, { target: { value: "new" } });
  await screen.findByRole("button", { name: /Work Item WI-000003 New result/ });
  await act(async () => { resolveOld(response(result(4, "Old result"))); });
  expect(screen.queryByText("Old result")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Requests" }));
  expect(screen.getByText(/No matching work found/)).toBeInTheDocument();
});

test("below-minimum query skips the API, retry recovers an error, and board opens its workspace section", async () => {
  searchApi.search.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { results: {
    workItems: [], requests: [], workspaces: [], boards: [{ id: 9, name: "Website", workspaceName: "Creative", workspaceSlug: "creative" }],
  } } });
  setup("/home");
  fireEvent.click(screen.getAllByRole("button", { name: "Search work, requests, and spaces" })[0]);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "w" } });
  expect(screen.getByText(/Enter at least 2 characters/)).toBeInTheDocument();
  expect(searchApi.search).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "website" } });
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  const board = await screen.findByRole("button", { name: "Board Website Creative" });
  fireEvent.click(board);
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/creative?board=9"));
});
