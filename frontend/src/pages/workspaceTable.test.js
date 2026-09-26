import { sortWorkItems } from "./workspaceTable";

const item = (id, values) => ({ id, ...values });
const ids = (items) => items.map(({ id }) => id);

test("sorts workflow and priority by their operational order", () => {
  const statuses = [item(1, { status: "done" }), item(2, { status: "review" }), item(3, { status: "new" }), item(4, { status: "in_progress" })];
  expect(ids(sortWorkItems(statuses, "status", "asc"))).toEqual([3, 4, 2, 1]);
  expect(ids(sortWorkItems(statuses, "status", "desc"))).toEqual([1, 2, 4, 3]);
  const priorities = [item(1, { priority: "low" }), item(2, { priority: "high" }), item(3, { priority: "medium" })];
  expect(ids(sortWorkItems(priorities, "priority", "asc"))).toEqual([2, 3, 1]);
  expect(ids(sortWorkItems(priorities, "priority", "desc"))).toEqual([1, 3, 2]);
});

test("sorts text and dates with missing values last in either direction", () => {
  const items = [
    item(1, { reference: "WI-000010", title: "Zebra", owner_detail: null, reviewer_detail: null, due_date: null }),
    item(2, { reference: "WI-000002", title: "alpha", owner_detail: { display_name: "Zoe" }, reviewer_detail: { display_name: "Amy" }, due_date: "2026-11-01" }),
    item(3, { reference: "WI-000003", title: "Bravo", owner_detail: { display_name: "amy" }, reviewer_detail: { display_name: "Zoe" }, due_date: "2026-10-01" }),
  ];
  expect(ids(sortWorkItems(items, "reference", "asc"))).toEqual([2, 3, 1]);
  expect(ids(sortWorkItems(items, "title", "asc"))).toEqual([2, 3, 1]);
  expect(ids(sortWorkItems(items, "owner", "asc"))).toEqual([3, 2, 1]);
  expect(ids(sortWorkItems(items, "reviewer", "desc"))).toEqual([3, 2, 1]);
  expect(ids(sortWorkItems(items, "due_date", "asc"))).toEqual([3, 2, 1]);
  expect(ids(sortWorkItems(items, "due_date", "desc"))).toEqual([2, 3, 1]);
  expect(sortWorkItems(items, null, null)).toBe(items);
});
