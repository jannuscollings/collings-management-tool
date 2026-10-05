import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import PeoplePage from "./PeoplePage";
import { peopleApi } from "../api/people";

jest.mock("react-redux", () => ({
  useSelector: (selector) => selector({ auth: { user: { id: 1, is_staff: true } } }),
  useDispatch: () => jest.fn(),
}));
jest.mock("../api/people", () => ({ peopleApi: { list: jest.fn(), create: jest.fn(), update: jest.fn() } }));
jest.mock("react-hot-toast", () => ({ success: jest.fn(), error: jest.fn() }));

let people;
beforeEach(() => {
  people = [{ id: 1, display_name: "Demo Admin", first_name: "Demo", last_name: "Admin", email: "admin@example.com", job_title: "", is_staff: true, is_active: true }];
  peopleApi.list.mockImplementation(async () => ({ data: [...people] }));
  peopleApi.create.mockImplementation(async (payload) => {
    people.push({ id: 2, display_name: `${payload.first_name} ${payload.last_name}`, ...payload, is_active: true });
    return { data: people[1] };
  });
  peopleApi.update.mockImplementation(async (id, payload) => {
    people = people.map((person) => person.id === id ? { ...person, ...payload } : person);
    return { data: people.find((person) => person.id === id) };
  });
});
afterEach(() => jest.clearAllMocks());

test("job title can be created, edited, and cleared independently of access", async () => {
  render(<MemoryRouter><PeoplePage /></MemoryRouter>);
  await screen.findByText("Demo Admin");
  fireEvent.click(screen.getByRole("button", { name: "New person" }));
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Jane" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Designer" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "UI/UX Designer" } });
  fireEvent.change(screen.getByLabelText(/Initial password/), { target: { value: "password123" } });
  expect(screen.getByLabelText("Access")).toHaveValue("staff");
  fireEvent.click(screen.getByRole("button", { name: "Create person" }));
  await screen.findByText("UI/UX Designer");
  expect(peopleApi.create).toHaveBeenCalledWith(expect.objectContaining({ job_title: "UI/UX Designer", is_staff: false }));

  const card = screen.getByText("Jane Designer").closest("[class*='flex-wrap']");
  expect(within(card).getByText("Staff")).toBeInTheDocument();
  fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Graphic Designer" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Graphic Designer");
  expect(peopleApi.update).toHaveBeenLastCalledWith(2, expect.objectContaining({ job_title: "Graphic Designer", is_staff: false }));

  fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.queryByText("Graphic Designer")).not.toBeInTheDocument());
  expect(peopleApi.update).toHaveBeenLastCalledWith(2, expect.objectContaining({ job_title: "", is_staff: false }));
});
