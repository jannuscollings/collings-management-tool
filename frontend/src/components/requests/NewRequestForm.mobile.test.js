import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import NewRequestForm from "./NewRequestForm";

jest.mock("../../api/workRequests", () => ({
  REQUEST_PRIORITY_OPTIONS: [["medium", "Medium"]],
  REQUEST_TYPE_OPTIONS: [["creative_design", "Creative & Design"]],
  workRequestsApi: { create: jest.fn() },
}));

test("new request keeps its form and submit action clear of mobile navigation", () => {
  render(<NewRequestForm />);
  expect(screen.getByRole("textbox", { name: "Request title" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Brief" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Submit request" })).toHaveClass("min-h-11");
  expect(screen.getByRole("button", { name: "Submit request" }).closest("form")).toHaveClass("pb-16", "shell:pb-0");
});
