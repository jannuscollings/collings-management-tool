import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import ProfileAvatar from "./ProfileAvatar";
import { authApi } from "../../api/auth";

jest.mock("../../api/auth", () => ({ authApi: { photo: jest.fn(), userPhoto: jest.fn() } }));

const createObjectURL = URL.createObjectURL;
const revokeObjectURL = URL.revokeObjectURL;
beforeEach(() => {
  authApi.photo.mockReset();
  authApi.userPhoto.mockReset();
  URL.createObjectURL = jest.fn(() => "blob:avatar");
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

test("loads another user's uploaded photo and refreshes it when the version changes", async () => {
  authApi.userPhoto.mockResolvedValue({ data: new Blob(["photo"], { type: "image/jpeg" }) });
  const person = { id: 8, display_name: "Amy Smith", has_photo: true, avatar_updated_at: "first" };
  const { rerender, unmount } = render(<ProfileAvatar user={person} otherUser className="h-6 w-6" />);
  expect(await screen.findByRole("img", { name: "Amy Smith" })).toHaveAttribute("src", "blob:avatar");
  expect(authApi.userPhoto).toHaveBeenCalledWith(8);
  rerender(<ProfileAvatar user={{ ...person, avatar_updated_at: "second" }} otherUser />);
  await waitFor(() => expect(authApi.userPhoto).toHaveBeenCalledTimes(2));
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

test("uses initials for missing photo data and a failed image request", async () => {
  const person = { id: 8, display_name: "Amy Smith" };
  const { rerender } = render(<ProfileAvatar user={person} otherUser />);
  expect(screen.getByLabelText("Initials for Amy Smith")).toHaveTextContent("AS");
  expect(authApi.userPhoto).not.toHaveBeenCalled();
  rerender(<ProfileAvatar user={{ display_name: "Amy Smith", has_photo: true }} otherUser />);
  expect(authApi.photo).not.toHaveBeenCalled();
  expect(authApi.userPhoto).not.toHaveBeenCalled();
  authApi.userPhoto.mockRejectedValue(new Error("unavailable"));
  rerender(<ProfileAvatar user={{ ...person, has_photo: true }} otherUser />);
  await waitFor(() => expect(authApi.userPhoto).toHaveBeenCalledWith(8));
  expect(screen.getByLabelText("Initials for Amy Smith")).toHaveTextContent("AS");
});
