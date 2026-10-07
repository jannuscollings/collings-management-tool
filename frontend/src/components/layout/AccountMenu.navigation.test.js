import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountMenu from "./AccountMenu";

const mockDispatch = jest.fn();
const mockConfirmSignOut = jest.fn();
jest.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
  useSelector: (select) => select({ auth: { user: { first_name: "Demo", last_name: "Agent", is_staff: true } } }),
}));
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

beforeEach(() => { mockDispatch.mockReset(); mockConfirmSignOut.mockReset(); });

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
