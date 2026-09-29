function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function dueState(item, today = localDate()) {
  if (!item?.due_date || item.status === "done") return null;
  if (item.due_date < today) return "overdue";
  if (item.due_date === today) return "today";
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 3);
  return item.due_date <= end.toISOString().slice(0, 10) ? "soon" : null;
}

const states = {
  overdue: ["Overdue", "text-critical"],
  today: ["Due today", "text-amber-700 dark:text-amber-200"],
  soon: ["Due soon", "text-amber-700 dark:text-amber-200"],
};

export default function DueDate({ item, today, prefix = "", empty = "—" }) {
  const state = dueState(item, today);
  return <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
    <span>{item.due_date ? `${prefix}${item.due_date}` : empty}</span>
    {state && <span className={`text-[10px] font-semibold ${states[state][1]}`}>· {states[state][0]}</span>}
  </span>;
}
