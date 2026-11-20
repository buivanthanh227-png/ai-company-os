import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Meter, PageHeader, PresenceBadge, StaffMark } from "@/components/bits";
import { Button, Field, Panel, Select, TextArea, TextInput } from "@/components/ui";
import { CHIEFS } from "@/lib/types";
import { presenceOf, topSkills } from "@/lib/engine";
import { COST_NOTE, officialQuota, rate } from "@/lib/format";
import { useOs, useRoster } from "@/lib/store";
import {
  ACCESS_LABEL,
  CAP_LABEL,
  GROUPS,
  RANK_LABEL,
  SKILL_KEYS,
  SKILL_LABEL,
  type Cap,
  type Rank,
} from "@/lib/types";

function useFiltered(q: string) {
  const roster = useRoster();
  const [group, setGroup] = useState("all");
  const [presence, setPresence] = useState("all");
  const [text, setText] = useState(q);
  useEffect(() => {
    setText(q);
  }, [q]);
  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return roster.filter((person) => {
      const blob = `${person.name} ${person.id} ${person.title} ${person.department} ${person.developer} ${person.groups.join(" ")}`.toLowerCase();
      if (needle && !blob.includes(needle)) return false;
      if (group !== "all" && !person.groups.includes(group) && person.department !== group) return false;
      if (presence !== "all" && presenceOf(person) !== presence) return false;
      return true;
    });
  }, [roster, text, group, presence]);
  return { rows, group, setGroup, presence, setPresence, text, setText, total: roster.length };
}

export function StaffView({ q }: { q: string }) {
  const filter = useFiltered(q);
  return (
    <div>
      <PageHeader kicker="Nhân sự" title="Danh sách nhân sự AI" lede={`${filter.rows.length} / ${filter.total} người. Dola AI và OpenClaw đang chờ vì chưa xác minh được hồ sơ công khai.`} />
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <Field label="Tìm">
          <TextInput value={filter.text} onChange={(event) => filter.setText(event.target.value)} placeholder="Tên, mã, phòng" />
        </Field>
        <Field label="Nhóm">
          <Select value={filter.group} onChange={(event) => filter.setGroup(event.target.value)}>
            <option value="all">Tất cả nhóm</option>
            {GROUPS.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </Select>
        </Field>
        <Field label="Trạng thái">
          <Select value={filter.presence} onChange={(event) => filter.setPresence(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="active">Sẵn sàng</option>
            <option value="degraded">Sắp chạm hạn mức</option>
            <option value="quota_exhausted">Hết hạn mức</option>
            <option value="standby">Chờ kích hoạt</option>
            <option value="offline">Ngoại tuyến</option>
          </Select>
        </Field>
      </div>
      {filter.rows.length === 0 ? <p className="text-sm text-muted">Không có nhân sự khớp bộ lọc.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {filter.rows.map((person) => (
          <Link key={person.id} to="/" search={{ view: "profile", id: person.id, q: "" }} className="rounded-xl border border-line bg-elevated p-3">
            <div className="flex items-start gap-3">
              <StaffMark name={person.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{person.name}</p>
                  <PresenceBadge person={person} />
                </div>
                <p className="mt-1 text-xs text-muted">{person.title} · {person.department}</p>
                <p className="mt-1 font-mono text-xs text-faint">Mã {person.id}</p>
                <p className="mt-2 text-xs text-faint">{topSkills(person).map(([key, score]) => `${SKILL_LABEL[key]} ${score}`).join(" · ")}</p>
                <div className="mt-3"><Meter value={person.budget} /></div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MatrixView() {
  const roster = useRoster();
  const [text, setText] = useState("");
  const rows = roster.filter((person) => `${person.name} ${person.department}`.toLowerCase().includes(text.toLowerCase()));
  return (
    <div>
      <PageHeader kicker="Năng lực" title="Hồ sơ năng lực theo từng kỹ năng" lede="Một người có thể đứng đầu lập trình mà không đứng đầu nghiên cứu. Số là điểm vận hành nội bộ." />
      <Field label="Lọc">
        <TextInput value={text} onChange={(event) => setText(event.target.value)} placeholder="Tên hoặc phòng" />
      </Field>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-max min-w-full text-left text-xs">
          <thead className="bg-subtle text-faint">
            <tr>
              <th className="sticky left-0 bg-subtle px-3 py-2 font-medium">Nhân sự</th>
              {SKILL_KEYS.map((key) => (
                <th key={key} className="px-2 py-2 font-medium">{SKILL_LABEL[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => (
              <tr key={person.id} className="border-t border-line">
                <td className="sticky left-0 bg-elevated px-3 py-2">
                  <Link to="/" search={{ view: "profile", id: person.id, q: "" }} className="text-fg">{person.name}</Link>
                </td>
                {SKILL_KEYS.map((key) => (
                  <td key={key} className="px-2 py-2 text-center font-mono tabular-nums text-muted">{person.skills[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapRow({ label, value }: { label: string; value: Cap }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span>{CAP_LABEL[value]}</span>
    </div>
  );
}

export function ProfileView({ id }: { id: string }) {
  const roster = useRoster();
  const person = roster.find((item) => item.id === id);
  const tasks = useOs((state) => state.tasks);
  const exhaust = useOs((state) => state.exhaustStaff);
  const restore = useOs((state) => state.restoreStaff);
  const setBudget = useOs((state) => state.setBudget);
  if (!person) {
    return (
      <div>
        <PageHeader kicker="Hồ sơ" title="Chưa chọn nhân sự" lede="Mở một người từ danh sách." />
        <Link to="/" search={{ view: "staff", id: "", q: "" }} className="text-sm text-accent">Về danh sách</Link>
      </div>
    );
  }
  const own = tasks.filter((task) => task.assigneeId === person.id || task.triedIds.includes(person.id) || task.history.some((item) => item.text.includes(person.name)));
  return (
    <div>
      <PageHeader kicker={`Mã nhân sự ${person.id}`} title={person.name} lede={person.title} actions={<PresenceBadge person={person} />} />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-3">
          <Panel>
            <p className="text-sm text-fg">{person.summary}</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-faint">Nhà phát triển</dt><dd>{person.developer}</dd></div>
              <div><dt className="text-faint">Quốc gia</dt><dd>{person.country}</dd></div>
              <div><dt className="text-faint">Phòng</dt><dd>{person.department}</dd></div>
              <div><dt className="text-faint">Cấp</dt><dd>{RANK_LABEL[person.rank]}</dd></div>
              <div className="sm:col-span-2"><dt className="text-faint">Website</dt><dd>{person.website ? <a className="break-all text-accent" href={person.website} target="_blank" rel="noreferrer">{person.website}</a> : "Chưa xác minh"}</dd></div>
            </dl>
          </Panel>
          <Panel>
            <h2 className="text-sm font-medium">Điểm mạnh và điểm yếu</h2>
            <p className="mt-2 text-sm text-muted">{person.strength}</p>
            <p className="mt-2 text-sm text-muted">{person.weakness}</p>
          </Panel>
          <Panel>
            <h2 className="text-sm font-medium">Điểm từng kỹ năng</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {SKILL_KEYS.map((key) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>{SKILL_LABEL[key]}</span>
                    <span className="font-mono tabular-nums">{person.skills[key]}</span>
                  </div>
                  <Meter value={person.skills[key]} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <h2 className="text-sm font-medium">Việc liên quan</h2>
            {own.length === 0 ? <p className="mt-2 text-sm text-muted">Chưa có việc.</p> : null}
            <ul className="mt-2 flex flex-col gap-2">
              {own.map((task) => (
                <li key={task.id} className="text-sm text-muted">{task.phase}. {task.title} — {task.status}</li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="flex flex-col gap-3">
          <Panel>
            <h2 className="text-sm font-medium">Hạn mức</h2>
            <p className="mt-2 text-sm text-muted">{officialQuota(person.meter)}</p>
            <p className="mt-2 text-xs text-faint">Kiểm tra {person.checkedAt}. Nguồn: {person.source}</p>
            <p className="mt-3 text-xs text-muted">Lớp truy cập: {ACCESS_LABEL[person.access]}</p>
            <p className="mt-1 text-xs text-faint">{person.accessNote}</p>
            <div className="mt-3"><Meter value={person.budget} /></div>
            <p className="mt-1 text-xs text-faint">Ngân sách vận hành {person.budget}/100. {COST_NOTE}</p>
            <label className="mt-3 block text-xs text-muted">
              Chỉnh ngân sách nội bộ
              <input className="mt-1 w-full" type="range" min={0} max={100} value={person.budget} onChange={(event) => setBudget(person.id, Number(event.target.value))} />
            </label>
            <p className="mt-3 text-sm">Tỷ lệ thành công: {rate(person.ok, person.bad)}</p>
          </Panel>
          <Panel>
            <h2 className="text-sm font-medium">Năng lực công cụ</h2>
            <CapRow label="API" value={person.api} />
            <CapRow label="Tự động hóa" value={person.automation} />
            <CapRow label="Đọc và sửa file" value={person.fileEdit} />
            <CapRow label="Dự án nhiều file" value={person.multiFile} />
            <CapRow label="Công cụ ngoài" value={person.tools} />
          </Panel>
          <Panel className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Trạng thái</h2>
            <Button onClick={() => exhaust(person.id)}>Mô phỏng hết hạn mức</Button>
            <Button variant="secondary" onClick={() => restore(person.id, "active")}>Đưa lại vào ứng viên</Button>
            <Button variant="secondary" onClick={() => restore(person.id, "standby")}>Chuyển sang chờ</Button>
            <Button variant="ghost" onClick={() => restore(person.id, "offline")}>Đánh dấu ngoại tuyến</Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function OrgView() {
  const roster = useRoster();
  const directors = roster.filter((person) => person.rank === "director");
  const ceo = roster.find((person) => person.rank === "ceo");
  const direct = roster.filter((person) => CHIEFS[person.department] === "chatgpt" && person.rank !== "ceo");
  return (
    <div>
      <PageHeader kicker="Tổ chức" title="Sơ đồ từ Chủ tịch đến chuyên viên" lede="Giám đốc chuyên môn chỉ huy đúng phòng. ChatGPT giữ vai CEO, không ôm mọi kỹ năng." />
      <div className="mb-4 flex flex-col items-start gap-2">
        <Panel className="w-full max-w-sm">
          <p className="font-mono text-xs text-faint">Chủ tịch</p>
          <p className="text-sm">Bạn — quyết định cuối, duyệt điều chuyển</p>
        </Panel>
        {ceo ? (
          <Link to="/" search={{ view: "profile", id: ceo.id, q: "" }} className="w-full max-w-sm rounded-xl border border-line bg-elevated p-3">
            <p className="font-mono text-xs text-accent">CEO</p>
            <p className="text-sm">{ceo.name}</p>
            <p className="text-xs text-muted">{ceo.title}</p>
          </Link>
        ) : null}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        <OrgColumn title="Khối điều hành" people={direct} />
        {directors.map((director) => {
          const depts = Object.entries(CHIEFS).filter(([, chief]) => chief === director.id).map(([dept]) => dept);
          const people = roster.filter((person) => depts.includes(person.department) && person.id !== director.id);
          return (
            <section key={director.id} className="w-72 shrink-0">
              <Link to="/" search={{ view: "profile", id: director.id, q: "" }} className="block rounded-xl border border-line bg-elevated p-3">
                <p className="font-mono text-xs text-accent">Giám đốc</p>
                <p className="text-sm">{director.name}</p>
                <p className="text-xs text-muted">{director.title}</p>
              </Link>
              <div className="mt-2"><OrgColumn title={depts.slice(0, 3).join(", ")} people={people} /></div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OrgColumn({ title, people }: { title: string; people: ReturnType<typeof useRoster> }) {
  const leads = people.filter((person) => person.rank === "lead");
  const rest = people.filter((person) => person.rank === "specialist");
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs text-faint">{title}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {[...leads, ...rest].map((person) => (
          <li key={person.id}>
            <Link to="/" search={{ view: "profile", id: person.id, q: "" }} className="block text-sm">
              <span className="text-fg">{person.name}</span>
              <span className="block text-xs text-faint">{person.rank === "lead" ? "Trưởng phòng" : "Chuyên viên"} · {person.department}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewsView() {
  const roster = useRoster();
  const setSkill = useOs((state) => state.setSkill);
  const propose = useOs((state) => state.propose);
  const proposals = useOs((state) => state.proposals);
  const decide = useOs((state) => state.decideProposal);
  const [id, setId] = useState(roster[0]?.id ?? "");
  const person = roster.find((item) => item.id === id) ?? roster[0];
  const [rank, setRank] = useState<Rank>("lead");
  const [title, setTitle] = useState("Trưởng phòng");
  const [reason, setReason] = useState("");
  if (!person) return null;
  return (
    <div>
      <PageHeader kicker="Đánh giá" title="Kiểm tra và điều chuyển" lede="CEO chỉ được đề xuất. Chủ tịch phê duyệt thì chức vụ mới ghi vào hồ sơ." />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel>
          <Field label="Nhân sự">
            <Select value={person.id} onChange={(event) => setId(event.target.value)}>
              {roster.map((item) => (
                <option key={item.id} value={item.id}>{item.name} — {item.title}</option>
              ))}
            </Select>
          </Field>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SKILL_KEYS.map((key) => (
              <label key={key} className="text-xs text-muted">
                {SKILL_LABEL[key]}
                <input
                  className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-3 font-mono text-sm text-fg"
                  type="number"
                  min={0}
                  max={100}
                  value={person.skills[key]}
                  onChange={(event) => setSkill(person.id, key, Number(event.target.value))}
                />
              </label>
            ))}
          </div>
        </Panel>
        <div className="flex flex-col gap-3">
          <Panel className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Đề xuất của CEO</h2>
            <p className="text-xs text-faint">Đang là {RANK_LABEL[person.rank]}.</p>
            <Field label="Cấp mới">
              <Select value={rank} onChange={(event) => setRank(event.target.value as Rank)}>
                <option value="director">Giám đốc chuyên môn</option>
                <option value="lead">Trưởng phòng</option>
                <option value="specialist">Chuyên viên</option>
              </Select>
            </Field>
            <Field label="Chức danh"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field label="Lý do"><TextArea value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
            <Button onClick={() => propose({ staffId: person.id, toRank: rank, title, reason })}>Gửi Chủ tịch duyệt</Button>
          </Panel>
          <Panel>
            <h2 className="text-sm font-medium">Hàng duyệt</h2>
            {proposals.length === 0 ? <p className="mt-2 text-sm text-muted">Chưa có đề xuất.</p> : null}
            <ul className="mt-2 flex flex-col gap-3">
              {proposals.map((item) => {
                const who = roster.find((personRow) => personRow.id === item.staffId);
                return (
                  <li key={item.id} className="border-t border-line pt-2 text-sm">
                    <p>{who?.name ?? item.staffId} → {item.title}</p>
                    <p className="text-xs text-faint">{item.reason || "Không có lý do"} · {item.status === "approved" ? "Đã duyệt" : item.status === "rejected" ? "Đã bác" : "Chờ duyệt"}</p>
                    {item.status === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <Button onClick={() => decide(item.id, true)}>Duyệt</Button>
                        <Button variant="danger" onClick={() => decide(item.id, false)}>Bác</Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
