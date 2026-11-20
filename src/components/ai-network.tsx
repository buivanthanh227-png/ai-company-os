import type { LiveStaff, Task } from "@/lib/types";
import { PRESENCE_LABEL } from "@/lib/types";

type NetworkState = "working" | "active" | "degraded" | "quota_exhausted" | "offline" | "standby";

const STATE_STYLE: Record<NetworkState, { color: string; label: string; className: string }> = {
  working: { color: "#2563eb", label: "Đang có nhiệm vụ", className: "text-blue-700 bg-blue-50" },
  active: { color: "#0d9488", label: PRESENCE_LABEL.active, className: "text-teal-700 bg-teal-50" },
  degraded: { color: "#b45309", label: PRESENCE_LABEL.degraded, className: "text-amber-800 bg-amber-50" },
  quota_exhausted: { color: "#dc2626", label: PRESENCE_LABEL.quota_exhausted, className: "text-red-700 bg-red-50" },
  offline: { color: "#64748b", label: PRESENCE_LABEL.offline, className: "text-slate-700 bg-slate-100" },
  standby: { color: "#94a3b8", label: PRESENCE_LABEL.standby, className: "text-slate-600 bg-slate-100" },
};

function stateFor(person: LiveStaff, tasks: Task[]): NetworkState {
  const working = tasks.some(
    (task) => task.assigneeId === person.id && (task.status === "running" || task.status === "review"),
  );
  return working ? "working" : person.status;
}

export function AiNetwork({ roster, tasks }: { roster: LiveStaff[]; tasks: Task[] }) {
  const people = roster.slice(0, 5);
  const positions = [
    { x: 10, y: 9 },
    { x: 30, y: 9 },
    { x: 50, y: 9 },
    { x: 70, y: 9 },
    { x: 90, y: 9 },
  ];
  const isWorking = (person: LiveStaff) =>
    tasks.some((task) => task.assigneeId === person.id && (task.status === "running" || task.status === "review"));
  const workingCount = roster.filter(isWorking).length;
  const activeCount = roster.filter((person) => person.status === "active" && !isWorking(person)).length;

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-line bg-elevated p-4 shadow-sm sm:p-5" aria-labelledby="ai-network-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-medium tracking-wide text-accent">AI COMPANY OS · NETWORK</p>
          <h2 id="ai-network-title" className="mt-1 text-base font-semibold text-fg">Mạng lưới nhân sự AI</h2>
          <p className="mt-1 text-xs text-muted">Trạng thái lấy từ danh mục nhân sự và bảng nhiệm vụ hiện tại.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-700">{activeCount} sẵn sàng</span>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{workingCount} đang làm</span>
        </div>
      </div>

      <div className="mt-3 hidden sm:block">
        <svg viewBox="0 0 100 14" className="mt-3 w-full max-h-28" role="img" aria-label="Sơ đồ kết nối CEO với các nhóm nhân sự AI">
          {positions.slice(0, people.length).map((point, index) => (
            <line key={people[index].id} x1="50" y1="4.5" x2={point.x} y2="7.5" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 2" />
          ))}
          <circle cx="50" cy="2.5" r="2.1" fill="#2563eb" />
          <text x="50" y="3.1" textAnchor="middle" fontSize="1.35" fontWeight="600" fill="#ffffff">CEO</text>
          {people.map((person, index) => {
            const point = positions[index];
            const state = stateFor(person, tasks);
            return (
              <g key={person.id}>
                <circle cx={point.x} cy={point.y} r="1.45" fill={STATE_STYLE[state].color} />
                <text x={point.x} y={point.y + 4.2} textAnchor="middle" fontSize="1.35" fill="#334155">
                  {person.name.length > 13 ? `${person.name.slice(0, 12)}…` : person.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((person) => {
          const state = stateFor(person, tasks);
          const style = STATE_STYLE[state];
          return (
            <div key={person.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2">
              <span className="min-w-0 truncate text-sm font-medium text-fg">{person.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${style.className}`}>{style.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-faint">
        Lưu ý: đây là trạng thái vận hành nội bộ, không phải tín hiệu trực tiếp từ API nhà cung cấp hoặc bằng chứng các AI đang tự động trao đổi với nhau.
      </p>
    </section>
  );
}
