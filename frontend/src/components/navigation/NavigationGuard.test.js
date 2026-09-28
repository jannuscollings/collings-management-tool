import "@testing-library/jest-dom";
import { useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Link, Route, RouterProvider, createRoutesFromElements, useLocation, useNavigate } from "react-router-dom";
import NavigationGuard, { drawerIdentity, drawerSurvives, pageSurvives, useDraftScope, useNavigationGuard } from "./NavigationGuard";

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function Drawer() {
  const location = useLocation();
  const identity = drawerIdentity(location);
  const [draft, setDraft] = useState("");
  const setDirty = useDraftScope("drawer", drawerSurvives(identity));
  useEffect(() => { setDirty(Boolean(draft)); }, [draft, setDirty]);
  return identity && <div>
    <textarea aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
    <button onClick={() => {
      const query = new URLSearchParams(location.search);
      query.delete("item"); query.delete("request"); query.delete("drawer");
      window.__navigate({ pathname: location.pathname, search: query.toString() });
    }}>X</button>
    <button onClick={() => {
      const query = new URLSearchParams(location.search);
      query.delete("item"); query.delete("request"); query.delete("drawer");
      window.__navigate({ pathname: location.pathname, search: query.toString() });
    }}>Overlay</button>
  </div>;
}

function Page() {
  const location = useLocation();
  const navigate = useNavigate();
  const [second, setSecond] = useState("");
  const setDirty = useDraftScope("page", pageSurvives(location.pathname));
  useEffect(() => { setDirty(Boolean(second)); }, [second, setDirty]);
  window.__navigate = navigate;
  return <>
    <Location />
    <Drawer />
    <input aria-label="Page draft" value={second} onChange={(event) => setSecond(event.target.value)} />
    <Link to="/home?item=2">Another work item</Link>
    <Link to="/home?request=3">Request</Link>
    <Link to="/requests">Sidebar</Link>
    <Link to="/home?item=1&sort=title&view=kanban">Sort and view</Link>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => navigate(1)}>Forward</button>
    <button onClick={() => navigate({ pathname: "/home", search: "?item=1" })}>Reopen</button>
    <button onClick={() => { if (window.__guard.confirmSignOut()) window.__signedOut = true; }}>Sign out</button>
  </>;
}

function GuardProbe() {
  window.__guard = useNavigationGuard();
  return <Page />;
}

function setup(entries = ["/home?item=1"], index = 0) {
  const router = createMemoryRouter(createRoutesFromElements(
    <Route element={<NavigationGuard />}>
      <Route path="/home" element={<GuardProbe />} />
      <Route path="/requests" element={<GuardProbe />} />
    </Route>
  ), { initialEntries: entries, initialIndex: index });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  window.__signedOut = false;
  jest.spyOn(window, "confirm").mockReturnValue(false);
});
afterEach(() => {
  window.confirm.mockRestore();
  delete window.__navigate;
  delete window.__guard;
  delete window.__signedOut;
});

test("X and overlay each ask once; Cancel keeps the draft and Continue closes", async () => {
  setup();
  fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Keep me" } });
  fireEvent.click(screen.getByRole("button", { name: "X" }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Keep me");
  fireEvent.click(screen.getByRole("button", { name: "Overlay" }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Keep me");
  window.confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "X" }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/home"));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Draft" })).not.toBeInTheDocument());
  expect(window.confirm).toHaveBeenCalledTimes(3);
});

test.each(["Another work item", "Request", "Sidebar"])("destructive %s navigation protects the draft", async (name) => {
  setup();
  fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Keep me" } });
  fireEvent.click(screen.getByRole("link", { name }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Keep me");
  expect(screen.getByTestId("location")).toHaveTextContent("/home?item=1");
  window.confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("link", { name }));
  await waitFor(() => expect(screen.getByTestId("location").textContent).not.toBe("/home?item=1"));
  expect(window.confirm).toHaveBeenCalledTimes(2);
});

test("Back and Forward cancel or proceed without corrupting history", async () => {
  const router = setup(["/home?item=2", "/home?item=1", "/requests"], 1);
  fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Draft" } });
  await act(async () => { await router.navigate(-1); });
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(router.state.location.search).toBe("?item=1");
  await act(async () => { await router.navigate(1); });
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2));
  expect(router.state.location.search).toBe("?item=1");
  window.confirm.mockReturnValue(true);
  await act(async () => { await router.navigate(-1); });
  await waitFor(() => expect(router.state.location.search).toBe("?item=2"));
});

test("query changes preserving the drawer do not prompt; two scopes remain independent", async () => {
  setup();
  fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Drawer" } });
  fireEvent.click(screen.getByRole("link", { name: "Sort and view" }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("sort=title"));
  expect(window.confirm).not.toHaveBeenCalled();
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Drawer");
  fireEvent.change(screen.getByRole("textbox", { name: "Page draft" }), { target: { value: "Page" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("link", { name: "Sidebar" }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("textbox", { name: "Page draft" })).toHaveValue("Page");
});

test("beforeunload is active only while dirty and sign-out Cancel preserves the draft", async () => {
  setup();
  const clean = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
  fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Draft" } });
  const dirty = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(dirty);
  expect(dirty.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(window.__signedOut).toBe(false);
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Draft");
  fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "" } });
  const cleared = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(cleared);
  expect(cleared.defaultPrevented).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(window.__signedOut).toBe(true);
  expect(window.confirm).toHaveBeenCalledTimes(1);
});

test("clean drawer and full-page editor navigate normally", async () => {
  setup();
  fireEvent.click(screen.getByRole("link", { name: "Sidebar" }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/requests"));
  expect(window.confirm).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "Page draft" }), { target: { value: "Triage" } });
  fireEvent.click(screen.getByRole("link", { name: "Another work item" }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("textbox", { name: "Page draft" })).toHaveValue("Triage");
});
