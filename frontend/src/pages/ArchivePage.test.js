import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArchivePage from "./ArchivePage";
import { workApi } from "../api/work";

let mockIsAdmin = true;
const mockRefreshWorkspaces = jest.fn();
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: { is_staff: mockIsAdmin } } }) }));
jest.mock("../components/work/WorkItemDrawer", () => ({ useWorkItemContext: () => ({ refreshWorkspaces: mockRefreshWorkspaces }) }));
jest.mock("../api/work", () => ({ workApi: {
  listArchive: jest.fn(), restoreWorkspace: jest.fn(), restoreBoard: jest.fn(), restoreItem: jest.fn(),
} }));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdmin = true;
  workApi.listArchive.mockResolvedValue({ data: {
    workspaces: [{ id: 1, name: "Old", slug: "old" }],
    boards: [{ id: 2, name: "Delivery", workspace__name: "Old", workspace__slug: "old", workspace__archived: true }],
    work_items: [{ id: 3, reference: "WI-000003", title: "Artwork", group__name: "Delivery", group__workspace__name: "Old", group__archived: true }],
  } });
  workApi.restoreWorkspace.mockResolvedValue({});
  workApi.restoreBoard.mockResolvedValue({});
  workApi.restoreItem.mockResolvedValue({});
});

test("Admin sees archived identity and can restore each record", async () => {
  render(<MemoryRouter><ArchivePage /></MemoryRouter>);
  expect(await screen.findByText("WI-000003 · Artwork")).toBeInTheDocument();
  expect(screen.getByText("Old / Delivery · Parent archived")).toBeInTheDocument();
  const restore = screen.getAllByRole("button", { name: "Restore" });
  await act(async () => { fireEvent.click(restore[0]); });
  await waitFor(() => expect(workApi.restoreWorkspace).toHaveBeenCalledWith("old"));
  await waitFor(() => expect(mockRefreshWorkspaces).toHaveBeenCalled());
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(3));
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[1]); });
  await waitFor(() => expect(workApi.restoreBoard).toHaveBeenCalledWith("old", 2));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(3));
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[2]); });
  await waitFor(() => expect(workApi.restoreItem).toHaveBeenCalledWith(3));
});

test("Staff cannot open the Archive page or load archive data", () => {
  mockIsAdmin = false;
  render(<MemoryRouter><ArchivePage /></MemoryRouter>);
  expect(screen.queryByRole("heading", { name: "Archive" })).not.toBeInTheDocument();
  expect(workApi.listArchive).not.toHaveBeenCalled();
});
