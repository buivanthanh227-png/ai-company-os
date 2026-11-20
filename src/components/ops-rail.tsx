import { Link } from "@tanstack/react-router";
import { staffById } from "@/data/roster";
import { presenceOf } from "@/lib/engine";
import { useOs, useRoster } from "@/lib/store";
import { PRESENCE_LABEL } from "@/lib/types";

const OPEN = new Set(["queued", "assigned", "running", "review"]);

export function OpsRail() {
  const roster = useRoster();
  const tasks = useOs((state) => state.tasks);
  const open = tasks.filter((task) => OPEN.has(task.status));
  const queued = open.filter((task) => task.status === "queued");
  const risks = roster.filter((person) => {
    const presence = presenceOf(person);
    return presence === "quota_exhausted" || presence === "degraded" || presence === "standby";
  });

  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-l border-line bg-elevated xl:flex">
      <div className="border-b border-line px-4 py-4">
        <p className="font-mono text-xs text-accent">Bảng điều hành</p>
        <p className="mt-1 text-sm text-fg">Việc đang mở và người cần chú ý</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="font-mono text-xs text-faint">
          {open.length} việc mở · {queued.length} trong hàng đợi
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {open.slice(0, 6).map((task) => {
            const person = staffById(roster, task.assigneeId);
            return (
              <li key={task.id} className="rounded-md border border-line px-3 py-2">
                <p className="text-sm text-fg">
                  <span className="font-mono text-accent">{task.phase}</span> {task.title}
                </p>
                <p className="mt-1 text-xs text-faint">
                  {person?.name ?? "Hàng đợi"} · {task.progress}%
                </p>
              </li>
            );
          })}
          {!open.length ? <li className="text-sm text-muted">Không có việc mở.</li> : null}
        </ul>
        <h2 className="mt-6 text-sm font-medium text-fg">Cần chú ý</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {risks.slice(0, 8).map((person) => (
            <li key={person.id}>
              <Link to="/" search={{ view: "profile", id: person.id, q: "" }} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-fg">{person.name}</span>
                <span className="shrink-0 text-xs text-muted">{PRESENCE_LABEL[presenceOf(person)]}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/" search={{ view: "tasks", id: "", q: "" }} className="mt-6 inline-flex h-11 items-center text-sm text-accent">
          Mở theo dõi nhiệm vụ
        </Link>
      </div>
    </aside>
  );
}
