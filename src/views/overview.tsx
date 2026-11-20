import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Meter, PageHeader, PresenceBadge, Stat } from "@/components/bits";
import { Panel } from "@/components/ui";
import { staffById } from "@/data/roster";
import { presenceOf } from "@/lib/engine";
import { useOs, useRoster } from "@/lib/store";
import { SKILL_KEYS, SKILL_LABEL } from "@/lib/types";

function SupplyChart({ data }: { data: { name: string; value: number }[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <div className="h-96" />;
  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={92} tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "transparent" }}
            contentStyle={{ background: "var(--color-elevated)", border: "1px solid var(--color-line)", borderRadius: 8, color: "var(--color-fg)" }}
          />
          <Bar dataKey="value" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OverviewView() {
  const roster = useRoster();
  const tasks = useOs((state) => state.tasks);
  const missions = useOs((state) => state.missions);
  const ready = roster.filter((person) => presenceOf(person) === "active").length;
  const low = roster.filter((person) => presenceOf(person) === "degraded").length;
  const empty = roster.filter((person) => presenceOf(person) === "quota_exhausted").length;
  const queued = tasks.filter((task) => task.status === "queued").length;
  const open = tasks.filter((task) => task.status !== "done" && task.status !== "failed");
  const chart = SKILL_KEYS.map((key) => ({
    name: SKILL_LABEL[key],
    value: roster.filter((person) => person.skills[key] >= 80 && presenceOf(person) !== "standby").length,
  }));
  const risks = roster.filter((person) => {
    const presence = presenceOf(person);
    return presence === "quota_exhausted" || presence === "degraded" || presence === "standby";
  });

  return (
    <div>
      <PageHeader
        kicker="Tổng quan"
        title="Sàn điều hành"
        lede="Điểm năng lực, ngân sách vận hành và việc đang mở đều là dữ liệu thật của hệ thống này. Hạn mức token nhà cung cấp chưa được xác minh và không bịa số."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sẵn sàng" value={ready} hint={`${roster.length} nhân sự trong danh mục`} />
        <Stat label="Sắp chạm hạn mức" value={low} hint="Ngân sách vận hành dưới 20" />
        <Stat label="Hết hạn mức" value={empty} hint="Không nhận việc mới" />
        <Stat label="Hàng đợi" value={queued} hint={`${open.length} việc còn mở`} />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel>
          <h2 className="text-sm font-medium text-fg">Việc đang chạy</h2>
          <div className="mt-3 flex flex-col gap-3">
            {missions.slice(0, 3).map((mission) => (
              <div key={mission.id} className="rounded-md border border-line p-3">
                <p className="text-sm text-fg">{mission.title}</p>
                <p className="mt-1 text-xs text-faint">{mission.id}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {tasks
                    .filter((task) => task.missionId === mission.id)
                    .map((task) => {
                      const person = staffById(roster, task.assigneeId);
                      return (
                        <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 text-muted">
                            <span className="font-mono text-accent">{task.phase}</span> {task.title}
                            <span className="block text-xs text-faint">{person?.name ?? "Hàng đợi"}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-fg">{task.progress}%</span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
            {!missions.length ? <p className="text-sm text-muted">Chưa có việc. Hãy giao ở Trung tâm giao việc.</p> : null}
          </div>
          <Link to="/" search={{ view: "tasks", id: "", q: "" }} className="mt-3 inline-flex h-11 items-center text-sm text-accent">
            Mở bảng nhiệm vụ
          </Link>
        </Panel>
        <Panel>
          <h2 className="text-sm font-medium text-fg">Số người đạt 80 điểm theo kỹ năng</h2>
          <p className="mt-1 text-xs text-faint">Điểm vận hành nội bộ, không phải benchmark nhà cung cấp.</p>
          <SupplyChart data={chart} />
        </Panel>
      </div>
      <Panel className="mt-3">
        <h2 className="text-sm font-medium text-fg">Cần Chủ tịch để mắt</h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {risks.slice(0, 8).map((person) => (
            <li key={person.id}>
              <Link to="/" search={{ view: "profile", id: person.id, q: "" }} className="flex items-center gap-3 rounded-md border border-line p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{person.name}</p>
                  <div className="mt-2"><Meter value={person.budget} /></div>
                </div>
                <PresenceBadge person={person} />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
