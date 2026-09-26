export const TABLE_COLUMNS = [
  ["reference", "Reference"], ["title", "Work item"], ["status", "Status"],
  ["priority", "Priority"], ["owner", "Owner"], ["reviewer", "Reviewer"],
  ["due_date", "Due date"],
];

const statusOrder = ["new", "in_progress", "review", "done"];
const priorityOrder = ["high", "medium", "low"];
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export function sortWorkItems(items, column, direction) {
  if (!TABLE_COLUMNS.some(([key]) => key === column) || !["asc", "desc"].includes(direction)) return items;
  const value = (item) => {
    if (column === "status") return statusOrder.indexOf(item.status);
    if (column === "priority") return priorityOrder.indexOf(item.priority);
    if (column === "owner" || column === "reviewer") return item[`${column}_detail`]?.display_name || null;
    return item[column] || null;
  };
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    const left = value(a.item);
    const right = value(b.item);
    if (left == null || right == null) return left == null && right == null ? a.index - b.index : left == null ? 1 : -1;
    const comparison = typeof left === "number" ? left - right : collator.compare(left, right);
    return (direction === "asc" ? comparison : -comparison) || a.index - b.index;
  }).map(({ item }) => item);
}
