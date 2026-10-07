import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfilePage from "./ProfilePage";
import { authApi } from "../api/auth";

let mockUser;
const mockDispatch = jest.fn();
jest.mock("react-redux", () => ({
  useSelector: (selector) => selector({ auth: { user: mockUser } }),
  useDispatch: () => mockDispatch,
}));
jest.mock("../api/auth", () => ({ authApi: {
  updateProfile: jest.fn(), photo: jest.fn(), uploadPhoto: jest.fn(), removePhoto: jest.fn(),
} }));
jest.mock("../store/slices/authSlice", () => ({ loadUser: () => ({ type: "auth/loadUser" }) }));

beforeEach(() => {
  mockUser = { id: 1, first_name: "Sam", last_name: "Lee", display_name: "Sam Lee", email: "sam@example.com", job_title: "Designer", bio: "Designs campaigns", is_staff: false, has_photo: false };
  mockDispatch.mockReset().mockResolvedValue({});
  authApi.updateProfile.mockReset().mockResolvedValue({});
  authApi.uploadPhoto.mockReset().mockResolvedValue({});
  authApi.removePhoto.mockReset().mockResolvedValue({});
});

test("shows the current user's profile and keeps managed fields read only", () => {
  const { container } = render(<ProfilePage />);
  expect(screen.getByRole("heading", { name: "My Profile" })).toBeInTheDocument();
  expect(screen.getByText("sam@example.com")).toBeInTheDocument();
  expect(screen.getAllByText("Designer")).toHaveLength(2);
  expect(screen.getByText("Designs campaigns")).toBeInTheDocument();
  expect(screen.getByLabelText("Initials for Sam Lee")).toHaveTextContent("SL");
  expect(container.querySelector("[class*='sm:grid-cols-2']")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  expect(screen.queryByLabelText("Work email")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Job title")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Access")).not.toBeInTheDocument();
});

test("updates only personal fields and refreshes the authenticated user", async () => {
  render(<ProfilePage />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "  Samantha  " } });
  fireEvent.change(screen.getByLabelText("Professional bio"), { target: { value: "  Brand design  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(authApi.updateProfile).toHaveBeenCalledWith({ first_name: "Samantha", last_name: "Lee", bio: "Brand design" }));
  await screen.findByText("Profile updated.");
  expect(mockDispatch).toHaveBeenCalledWith({ type: "auth/loadUser" });
});

test("uploads, replaces, and removes a photo, then shows initials", async () => {
  const { rerender } = render(<ProfilePage />);
  const file = new File(["photo"], "face.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Choose profile photo"), { target: { files: [file] } });
  await waitFor(() => expect(authApi.uploadPhoto).toHaveBeenCalledWith(file));
  await screen.findByText("Profile photo updated.");

  mockUser = { ...mockUser, has_photo: true };
  authApi.photo.mockResolvedValue({ data: new Blob(["photo"], { type: "image/jpeg" }) });
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:profile");
  URL.revokeObjectURL = jest.fn();
  try {
    rerender(<ProfilePage />);
    expect(screen.getByRole("button", { name: "Replace photo" })).toBeInTheDocument();
    await screen.findByRole("img", { name: "Sam Lee" });
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    await waitFor(() => expect(authApi.removePhoto).toHaveBeenCalledTimes(1));
    await screen.findByText("Profile photo removed.");
    mockUser = { ...mockUser, has_photo: false };
    rerender(<ProfilePage />);
    expect(screen.getByLabelText("Initials for Sam Lee")).toHaveTextContent("SL");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:profile");
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  }
});

test("shows full upload validation feedback and Admin access in the same layout", async () => {
  mockUser = { ...mockUser, is_staff: true };
  authApi.uploadPhoto.mockRejectedValue({ response: { data: { photo: "Use a JPEG, PNG, or WebP image." } } });
  render(<ProfilePage />);
  expect(screen.getAllByText("Admin")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Choose profile photo"), { target: { files: [new File(["bad"], "bad.svg")] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Use a JPEG, PNG, or WebP image.");
});
