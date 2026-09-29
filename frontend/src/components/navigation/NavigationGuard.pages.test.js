import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, createRoutesFromElements, Route, RouterProvider, useLocation } from "react-router-dom";
import NavigationGuard from "./NavigationGuard";
import WorkItemPage from "../../pages/WorkItemPage";
import RequestDetailPage from "../../pages/RequestDetailPage";
import NewRequestPage from "../../pages/NewRequestPage";

jest.mock("../work/WorkItemPanel", () => ({ onDirty }) => <input aria-label="Work item draft" onChange={(event) => onDirty(Boolean(event.target.value))} />);
jest.mock("../requests/RequestDetailPanel", () => ({ onDirty }) => <input aria-label="Request triage draft" onChange={(event) => onDirty(Boolean(event.target.value))} />);
jest.mock("../requests/NewRequestForm", () => ({ onDirty }) => <input aria-label="New request draft" onChange={(event) => onDirty(Boolean(event.target.value))} />);

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function setup(path) {
  const router = createMemoryRouter(createRoutesFromElements(<Route element={<NavigationGuard />}>
    <Route path="/workspaces/:workspaceSlug/items/:itemId" element={<><WorkItemPage /><Location /></>} />
    <Route path="/requests/:requestId" element={<><RequestDetailPage /><Location /></>} />
    <Route path="/requests/new" element={<><NewRequestPage /><Location /></>} />
    <Route path="/requests" element={<Location />} />
    <Route path="/workspaces/:workspaceSlug" element={<Location />} />
  </Route>), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

beforeEach(() => { jest.spyOn(window, "confirm").mockReturnValue(false); });
afterEach(() => { window.confirm.mockRestore(); });

test.each([
  ["/workspaces/creative-design/items/1", "Work item draft", "Back to workspace", "/workspaces/creative-design"],
  ["/requests/3", "Request triage draft", "Requests", "/requests"],
  ["/requests/new", "New request draft", "Requests", "/requests"],
])("full-page editor at %s protects its draft", async (start, field, link, destination) => {
  setup(start);
  if (field === "Work item draft") {
    expect(screen.getByRole("textbox", { name: field }).closest("[class*='pb-16']")).toHaveClass("pb-16", "shell:pb-[34px]");
  }
  fireEvent.change(screen.getByRole("textbox", { name: field }), { target: { value: "Unsent" } });
  fireEvent.click(screen.getByRole("link", { name: link }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId("location")).toHaveTextContent(start);
  expect(screen.getByRole("textbox", { name: field })).toHaveValue("Unsent");
  window.confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("link", { name: link }));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(destination));
  expect(window.confirm).toHaveBeenCalledTimes(2);
});
