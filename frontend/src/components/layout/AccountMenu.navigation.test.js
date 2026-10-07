import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountMenu from "./AccountMenu";
import { authApi } from "../../api/auth";

const mockDispatch = jest.fn();
const mockConfirmSignOut = jest.fn();
let mockUser = { first_name: "Demo", last_name: "Agent", is_staff: true };
jest.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
  useSelector: (select) => select({ auth: { user: mockUser } }),
}));
jest.mock("../../api/auth", () => ({ authApi: { photo: jest.fn(), userPhoto: jest.fn() } }));
jest.mock("../../contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "light", toggle: jest.fn() }) }));
jest.mock("../navigation/NavigationGuard", () => ({ useNavigationGuard: () => ({ confirmSignOut: mockConfirmSignOut }) }));
jest.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: ({ children }) => <div>{children}</div>,
  Trigger: ({ children }) => children,
  Portal: ({ children }) => <>{children}</>,
  Content: ({ children }) => <div>{children}</div>,
  Item: ({ children, onSelect }) => <button onClick={onSelect}>{children}</button>,
  Separator: () => null,
}));

beforeEach(() => { mockDispatch.mockReset(); mockConfirmSignOut.mockReset(); mockUser = { first_name: "Demo", last_name: "Agent", is_staff: true }; });

test("Cancel sign-out retains the session; Continue dispatches once", async () => {
  mockConfirmSignOut.mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<MemoryRouter><AccountMenu /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /My Profile/ })).toHaveAttribute("href", "/profile");
  fireEvent.click(await screen.findByText("Sign out"));
  expect(mockConfirmSignOut).toHaveBeenCalledTimes(1);
  expect(mockDispatch).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByText("Sign out"));
  expect(mockConfirmSignOut).toHaveBeenCalledTimes(2);
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch.mock.calls[0][0]).toMatchObject({ type: "auth/logout" });
});

test("account avatar updates when the signed-in user's photo changes", async () => {
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:account");
  URL.revokeObjectURL = jest.fn();
  authApi.photo.mockResolvedValue({ data: new Blob(["image"], { type: "image/jpeg" }) });
  try {
    const { rerender, unmount } = render(<MemoryRouter><AccountMenu /></MemoryRouter>);
    expect(screen.getByLabelText("Initials for Demo Agent")).toHaveTextContent("DA");
    mockUser = { ...mockUser, has_photo: true, avatar_updated_at: "now" };
    rerender(<MemoryRouter><AccountMenu /></MemoryRouter>);
    expect(await screen.findByRole("img", { name: "Demo Agent" })).toHaveAttribute("src", "blob:account");
    expect(authApi.photo).toHaveBeenCalledTimes(1);
    unmount();
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  }
});
