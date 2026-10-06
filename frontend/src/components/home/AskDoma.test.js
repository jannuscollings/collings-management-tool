import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import AskDoma, { resolveDomaCommand } from "./AskDoma";

jest.mock("../search/SearchDialog", () => ({ open, onOpenChange, initialQuery }) => open
  ? <div role="dialog" aria-label="Search CMT"><input aria-label="Search query" value={initialQuery} readOnly /><button onClick={() => onOpenChange(false)}>Close Search</button></div>
  : null);

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}
const workspaces = [{ id: 1, name: "Creative", slug: "creative" }, { id: 2, name: "Operations", slug: "operations" }];
function setup(isAdmin = true) {
  render(<MemoryRouter initialEntries={["/home"]}><AskDoma isAdmin={isAdmin} workspaces={workspaces} /><Location /></MemoryRouter>);
}
function command(value) {
  fireEvent.click(screen.getByRole("button", { name: "Ask DOMA" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Ask DOMA command" }), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
}

test("opens, focuses, closes with Escape, and restores trigger focus", async () => {
  setup();
  const trigger = screen.getByRole("button", { name: "Ask DOMA" });
  fireEvent.click(trigger);
  expect(screen.getByRole("textbox", { name: "Ask DOMA command" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Ask DOMA command" }), { key: "Escape" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Ask DOMA" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Ask DOMA" }));
  fireEvent.click(screen.getByRole("button", { name: "Close Ask DOMA" }));
  expect(screen.getByRole("button", { name: "Ask DOMA" })).toHaveFocus();
});

test("pill stays centered in the main area as the sidebar width changes", () => {
  const originalObserver = window.ResizeObserver;
  let resize;
  window.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() {}
  };
  let left = 250;
  const rect = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ left }));
  try {
    render(<MemoryRouter><main id="main-content"><AskDoma isAdmin workspaces={workspaces} /></main></MemoryRouter>);
    const pill = screen.getByRole("button", { name: "Ask DOMA" });
    const wrapper = pill.parentElement;
    expect(wrapper.style.getPropertyValue("--doma-content-left")).toBe("250px");
    expect(wrapper).toHaveClass("shell:left-[var(--doma-content-left)]");
    expect(wrapper).toHaveClass("bottom-[calc(6rem+env(safe-area-inset-bottom))]");
    expect(pill).toHaveClass("max-w-[400px]", "rounded-full", "focus-visible:ring-2");
    expect(pill.querySelector("svg")).toHaveClass("text-brand-strong", "dark:text-brand");
    left = 72;
    act(() => resize());
    expect(wrapper.style.getPropertyValue("--doma-content-left")).toBe("72px");
    fireEvent.click(pill);
    expect(screen.getByRole("region", { name: "Ask DOMA commands" })).toHaveClass("max-w-xl");
  } finally {
    rect.mockRestore();
    window.ResizeObserver = originalObserver;
  }
});

test.each([
  ["create request", "/home?drawer=new-request"],
  ["my work", "/my-work"],
  ["overdue", "/my-work?due=overdue"],
  ["waiting for review", "/home?view=review"],
])("%s uses an existing destination", (input, destination) => {
  setup();
  command(input);
  expect(screen.getByTestId("location")).toHaveTextContent(destination);
});

test("Admin chooses a workspace before existing Work Item creation", () => {
  setup();
  command("create work item");
  expect(screen.getByText("Choose a workspace for the new Work Item.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Operations" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/operations?drawer=new-work-item&drawerWorkspace=operations");
});

test("Staff has no Admin suggestion and cannot run its command", () => {
  setup(false);
  fireEvent.click(screen.getByRole("button", { name: "Ask DOMA" }));
  expect(screen.queryByRole("button", { name: "Create a Work Item" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Ask DOMA command" }), { target: { value: "create work item" } });
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
  expect(screen.getByText(/Work Item creation is available to administrators/)).toBeInTheDocument();
  expect(screen.getByTestId("location")).toHaveTextContent("/home");
});

test("reference and other unmatched text reuse CMT search", () => {
  setup();
  command("WI-000123");
  expect(screen.getByRole("dialog", { name: "Search CMT" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Search query" })).toHaveValue("WI-000123");
  fireEvent.click(screen.getByRole("button", { name: "Close Search" }));
  command("homepage");
  expect(screen.getByRole("textbox", { name: "Search query" })).toHaveValue("homepage");
  expect(resolveDomaCommand("Show what's overdue", true)).toBe("overdue");
});
