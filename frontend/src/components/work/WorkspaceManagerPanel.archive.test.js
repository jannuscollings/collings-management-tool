import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkspaceManagerPanel from "./WorkspaceManagerPanel";
import { workApi } from "../../api/work";

jest.mock("../../api/work", () => ({ workApi: {
  listWorkspaces: jest.fn(), listBoards: jest.fn(), archiveBoard: jest.fn(),
} }));

test("Admin management can archive the last active board while empty-board deletion stays protected", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  workApi.listWorkspaces.mockResolvedValue({ data: [{ id: 1, name: "Production", slug: "production" }] });
  workApi.listBoards.mockResolvedValue({ data: [{ id: 2, name: "Delivery", work_item_count: 1, request_count: 1 }] });
  workApi.archiveBoard.mockResolvedValue({ data: { id: 2, archived: true } });
  const changed = jest.fn();
  render(<WorkspaceManagerPanel onChanged={changed} onDirty={jest.fn()} onBusy={jest.fn()} />);
  const archive = await screen.findByRole("button", { name: "Archive Delivery" });
  expect(archive).toBeEnabled();
  expect(screen.getByRole("button", { name: "Delete Delivery" })).toBeDisabled();
  await act(async () => { fireEvent.click(archive); });
  await waitFor(() => expect(workApi.archiveBoard).toHaveBeenCalledWith("production", 2));
  expect(changed).toHaveBeenCalled();
  confirm.mockRestore();
});
