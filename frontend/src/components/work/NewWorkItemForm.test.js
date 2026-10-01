import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewWorkItemForm from "./NewWorkItemForm";
import { workApi } from "../../api/work";

jest.mock("../../api/work", () => ({
  WORK_PRIORITY_OPTIONS: [["medium", "Medium"]],
  workApi: { getWorkspace: jest.fn(), listUsers: jest.fn(), createItem: jest.fn() },
}));

beforeEach(() => {
  jest.resetAllMocks();
  workApi.getWorkspace.mockResolvedValue({ data: { groups: [{ id: 7, name: "Production" }] } });
  workApi.listUsers.mockResolvedValue({ data: [] });
  workApi.createItem.mockResolvedValue({ data: { id: 1, reference: "WI-000001" } });
});

test("new work item sends start and due dates", async () => {
  const onCreated = jest.fn();
  render(<NewWorkItemForm workspaceSlug="creative-design" onCreated={onCreated} onDirty={jest.fn()} onBusy={jest.fn()} />);
  await screen.findByLabelText("Start date");
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Campaign" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-10-10" } });
  fireEvent.click(screen.getByRole("button", { name: "Create work item" }));
  await waitFor(() => expect(workApi.createItem).toHaveBeenCalledWith(expect.objectContaining({
    group: 7, start_date: "2026-10-01", due_date: "2026-10-10",
  })));
  await waitFor(() => expect(onCreated).toHaveBeenCalled());
});

test("new work item sends empty dates as null", async () => {
  render(<NewWorkItemForm workspaceSlug="creative-design" onCreated={jest.fn()} onDirty={jest.fn()} onBusy={jest.fn()} />);
  await screen.findByLabelText("Start date");
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unscheduled" } });
  fireEvent.click(screen.getByRole("button", { name: "Create work item" }));
  await waitFor(() => expect(workApi.createItem).toHaveBeenCalledWith(expect.objectContaining({
    start_date: null, due_date: null,
  })));
});
