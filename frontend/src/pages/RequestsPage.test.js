import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequestsPage from "./RequestsPage";
import { workRequestsApi } from "../api/workRequests";

let mockUser = { is_staff: false };
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { user: mockUser } }) }));
jest.mock("../api/workRequests", () => ({ workRequestsApi: { list: jest.fn() } }));
jest.mock("../components/work/WorkItemDrawer", () => ({
  useWorkItemContext: () => ({ requestRevision: 0 }),
  DrawerLink: ({ children }) => <a href="/requests/new">{children}</a>,
  RequestLink: ({ children }) => <a href="/request">{children}</a>,
}));

beforeEach(() => { mockUser = { is_staff: false }; workRequestsApi.list.mockResolvedValue({ data: [] }); });

test("Requests introduction describes the user's submission workflow", () => {
  render(<MemoryRouter><RequestsPage /></MemoryRouter>);
  expect(screen.getByText("Track the requests you've submitted.")).toBeInTheDocument();
});

test("Requests introduction describes admin triage", () => {
  mockUser = { is_staff: true };
  render(<MemoryRouter><RequestsPage /></MemoryRouter>);
  expect(screen.getByText("Review incoming work and route it into a workspace.")).toBeInTheDocument();
});
