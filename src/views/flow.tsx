import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Meter, PageHeader, PresenceBadge, StaffMark } from "@/components/bits";
import { Button, Field, Panel, Select, TextArea, TextInput } from "@/components/ui";
import { staffById } from "@/data/roster";
import { helpText } from "@/lib/ceo";
import { rankForSkill } from "@/lib/engine";
import { when } from "@/lib/format";
import { useOs, useRoster } from "@/lib/store";
import {
  ACCESS_LABEL,
  KIND_LABEL,
  SKILL_KEYS,
  SKILL_LABEL,
  type FailReason,
  type MissionKind,
  type Priority,
  type SkillKey,
  type Task,
} from "@/lib/types";

const STATUS_LABEL: Record<Task["status"], string> = {
  queued: "Hàng đợi",
  assigned: "Đã giao",
  running: "Đang làm",
  review: "Đang soát",
  done: "Xong",
  failed: "Thất bại",
};

export function CeoView() {
  const messages = useOs((state) => state.messages);
  const appendChatMessage = useOs((state) => state.appendChatMessage);
  const sendLocalChat = useOs((state) => state.sendChat);
  const tasks = useOs((state) => state.tasks);
  const projects = useOs((state) => state.projects);
  const roster = useRoster();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"ai" | "local">("ai");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = text.trim();
    if (!prompt || busy) return;
    setText("");
    setNotice("");

    if (mode === "local") {
      sendLocalChat(prompt);
      return;
    }

    setBusy(true);
    const history = messages.slice(-12).map((item) => ({
      role: item.role === "chairman" ? "user" as const : "assistant" as const,
      content: item.text,
    }));
    const context = [
      `Nhân sự: ${roster.length}; đang hoạt động: ${roster.filter((person) => person.status === "active").length}; hết hạn mức: ${roster.filter((person) => person.status === "quota_exhausted").length}.`,
      `Dự án: ${projects.length}; đang hoạt động: ${projects.filter((project) => project.status === "active").length}.`,
      `Nhiệm vụ: ${tasks.length}; đang mở: ${tasks.filter((task) => !["done", "failed"].includes(task.status)).length}; hoàn thành: ${tasks.filter((task) => task.status === "done").length}; thất bại: ${tasks.filter((task) => task.status === "failed").length}.`,
      "Các nhiệm vụ gần đây:",
      ...tasks.slice(0, 10).map((task) => {
        const person = staffById(roster, task.assigneeId);
        return `- ${task.title} | ${task.status} | ${person?.name ?? "Chưa phân công"} | ${task.priority}`;
      }),
      "Các dự án gần đây:",
      ...projects.slice(0, 8).map((project) => `- ${project.name} | ${project.status}`),
    ].join("\n");

    try {
      const { sendAiMessage } = await import("@/lib/ai.functions");
      const result = await sendAiMessage({
        data: { message: prompt, history, context },
      });
      appendChatMessage("chairman", prompt);
      appendChatMessage("ceo", result.text, result.provider);
      setNotice(
        result.provider === "gemini"
          ? "Đã trả lời bằng Google Gemini."
          : `Đã trả lời bằng OpenRouter${result.fallbackUsed ? " (tuyến dự phòng)" : ""}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Unauthorized")) {
        appendChatMessage("chairman", prompt);
        appendChatMessage("ceo", "Phiên đăng nhập chưa hợp lệ. Vui lòng đăng nhập lại rồi thử gửi yêu cầu.", "local");
        setNotice("Chưa xác thực — không gửi yêu cầu sang bộ điều phối nội bộ.");
      } else {
        // Keep the original local command planner usable when API keys or the
        // deployed server gateway are not ready. No user message is duplicated.
        sendLocalChat(prompt);
        setNotice("AI chưa sẵn sàng; đã chuyển sang bộ điều phối nội bộ hiện có.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="CEO"
        title="Phòng Chat CEO"
        lede="Chat CEO ưu tiên Gemini, tự chuyển sang OpenRouter khi cần. Bản tóm tắt nhiệm vụ và dự án sẽ được gửi tới nhà cung cấp AI để trả lời; các lệnh phân công vẫn được thực hiện tại Trung tâm giao việc."
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel className="flex min-h-[32rem] flex-col">
          <div className="flex max-h-[32rem] flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <article key={message.id} className={message.role === "ceo" ? "rounded-md border border-line bg-subtle p-3" : "self-end max-w-[40rem] rounded-md bg-bg p-3"}>
                <p className="font-mono text-xs text-faint">
                  {message.role === "ceo"
                    ? message.source === "gemini"
                      ? "CEO · Gemini"
                      : message.source === "openrouter"
                        ? "CEO · OpenRouter"
                        : "CEO · bộ điều phối nội bộ"
                    : "Chủ tịch"} · {when(message.at)}
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-fg">{message.text}</p>
              </article>
            ))}
            {busy ? (
              <article className="rounded-md border border-line bg-subtle p-3" aria-live="polite">
                <p className="font-mono text-xs text-faint">CEO · Gemini Router</p>
                <p className="mt-2 text-sm text-muted">Đang xử lý yêu cầu...</p>
              </article>
            ) : null}
          </div>
          <form className="mt-3 flex flex-col gap-2" onSubmit={submit}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Chế độ trả lời:</span>
              <Button type="button" variant={mode === "ai" ? "primary" : "secondary"} onClick={() => setMode("ai")}>AI Router</Button>
              <Button type="button" variant={mode === "local" ? "primary" : "secondary"} onClick={() => setMode("local")}>Lệnh nội bộ</Button>
            </div>
            <TextArea value={text} onChange={(event) => setText(event.target.value)} placeholder="Giao việc hoặc hỏi CEO..." disabled={busy} />
            {notice ? <p className="text-xs text-muted" aria-live="polite">{notice}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !text.trim()}>{busy ? "Đang gửi..." : "Gửi"}</Button>
              <Button variant="secondary" onClick={() => setText("Sửa ứng dụng học tiếng Trung, người học không mở được bài hội thoại sau HSK 1.")}>
                Việc mẫu
              </Button>
              <Button variant="ghost" onClick={() => { setText("Báo cáo"); setMode("local"); }}>Báo cáo nội bộ</Button>
            </div>
          </form>
        </Panel>
        <Panel>
          <h2 className="text-sm font-medium">Lệnh nhận được</h2>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{helpText()}</p>
        </Panel>
      </div>
    </div>
  );
}

export function DispatchView() {
  const projects = useOs((state) => state.projects);
  const createMission = useOs((state) => state.createMission);
  const [title, setTitle] = useState("Sửa lỗi lộ trình HSK 1");
  const [brief, setBrief] = useState("Sửa ứng dụng học tiếng Trung. Người học bị kẹt sau bài giới thiệu, không sang được bài từ vựng. Giữ dữ liệu cũ.");
  const [kind, setKind] = useState<MissionKind>("software");
  const [priority, setPriority] = useState<Priority>("P1");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "new");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");

  return (
    <div>
      <PageHeader
        kicker="Giao việc"
        title="Trung tâm giao việc"
        lede="CEO tách pha, chấm điểm từng kỹ năng rồi giao cho người còn hạn mức. Người đã dùng ở pha trước bị trừ điểm ở pha phản biện."
      />
      <form
        className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || !brief.trim()) {
            setError("Cần tiêu đề và mô tả.");
            return;
          }
          setError("");
          createMission({ projectId, projectName, title, brief, kind, priority });
        }}
      >
        <Panel className="flex flex-col gap-3">
          <Field label="Tiêu đề">
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Bối cảnh cần giữ xuyên suốt">
            <TextArea value={brief} onChange={(event) => setBrief(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Loại việc">
              <Select value={kind} onChange={(event) => setKind(event.target.value as MissionKind)}>
                {Object.entries(KIND_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Ưu tiên">
              <Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </Select>
            </Field>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit">Phân công ngay</Button>
        </Panel>
        <Panel className="flex flex-col gap-3">
          <Field label="Dự án">
            <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
              <option value="new">Tạo dự án mới</option>
            </Select>
          </Field>
          {projectId === "new" ? (
            <Field label="Tên dự án mới">
              <TextInput value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </Field>
          ) : null}
          <p className="text-sm text-muted">Sau khi giao, mở Theo dõi nhiệm vụ để mô phỏng hết hạn mức, timeout, rate limit, lỗi API hoặc lỗi xác thực.</p>
        </Panel>
      </form>
    </div>
  );
}

function TaskActions({ task }: { task: Task }) {
  const affect = useOs((state) => state.affectTask);
  const setStatus = useOs((state) => state.setTaskStatus);
  const reasons: [FailReason, string][] = [
    ["quota", "Hết hạn mức"],
    ["timeout", "Quá thời gian"],
    ["rate_limit", "Giới hạn tần suất"],
    ["api_error", "Lỗi API"],
    ["auth_error", "Lỗi xác thực"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {task.status === "assigned" || task.status === "queued" ? (
        <Button onClick={() => setStatus(task.id, "running")} disabled={!task.assigneeId}>Bắt đầu</Button>
      ) : null}
      {task.status === "running" ? <Button variant="secondary" onClick={() => setStatus(task.id, "review")}>Đưa sang soát</Button> : null}
      {task.status === "running" || task.status === "review" || task.status === "assigned" ? (
        <Button variant="secondary" onClick={() => setStatus(task.id, "done")} disabled={!task.assigneeId}>Hoàn thành</Button>
      ) : null}
      {task.status !== "done" ? (
        <Button variant="danger" onClick={() => setStatus(task.id, "failed")}>Thất bại</Button>
      ) : null}
      {reasons.map(([reason, label]) => (
        <Button key={reason} variant="ghost" onClick={() => affect(task.id, reason)} disabled={task.status === "done"}>
          {label}
        </Button>
      ))}
    </div>
  );
}

export function TasksView() {
  const tasks = useOs((state) => state.tasks);
  const missions = useOs((state) => state.missions);
  const projects = useOs((state) => state.projects);
  const roster = useRoster();
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState("all");
  const visibleMissions = missions.filter((mission) => projectId === "all" || mission.projectId === projectId);

  return (
    <div>
      <PageHeader
        kicker="Nhiệm vụ"
        title="Theo dõi và chuyển giao"
        lede="Hết hạn mức thì ghi trạng thái, giữ nguyên ngữ cảnh và giao cho người kế tiếp. Timeout, rate limit và lỗi API được thử lại một lần trước khi chuyển. Lỗi xác thực chuyển ngay."
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Field label="Dự án">
          <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="all">Tất cả</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Trạng thái">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả</option>
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-col gap-4">
        {visibleMissions.map((mission) => {
          const rows = tasks.filter((task) => task.missionId === mission.id && (status === "all" || task.status === status));
          if (!rows.length) return null;
          return (
            <section key={mission.id}>
              <h2 className="text-sm font-medium text-fg">{mission.title}</h2>
              <p className="mt-1 text-xs text-faint">{mission.id} · {KIND_LABEL[mission.kind]}</p>
              <div className="mt-2 flex flex-col gap-2">
                {rows.map((task) => {
                  const person = staffById(roster, task.assigneeId);
                  return (
                    <Panel key={task.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-fg">
                            <span className="font-mono text-accent">{task.phase}</span> {task.title}
                          </p>
                          <p className="mt-1 text-xs text-faint">{SKILL_LABEL[task.skill]} · {STATUS_LABEL[task.status]} · {task.priority} · {task.progress}%</p>
                        </div>
                        {person ? (
                          <Link to="/" search={{ view: "profile", id: person.id, q: "" }} className="flex items-center gap-2 text-sm text-fg">
                            <StaffMark name={person.name} />
                            <span>
                              {person.name}
                              <span className="block text-xs text-faint">{person.title}</span>
                            </span>
                          </Link>
                        ) : (
                          <span className="text-sm text-warn">Trong hàng đợi</span>
                        )}
                      </div>
                      <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{task.context}</p>
                      {task.triedIds.length ? (
                        <p className="mt-2 text-xs text-faint">Đã đi qua: {task.triedIds.map((id) => staffById(roster, id)?.name ?? id).join(" → ")}</p>
                      ) : null}
                      <ol className="mt-2 flex flex-col gap-1">
                        {task.history.slice(-4).map((item, index) => (
                          <li key={`${item.at}-${index}`} className="text-xs text-faint">{when(item.at)} — {item.text}</li>
                        ))}
                      </ol>
                      <div className="mt-3">
                        <TaskActions task={task} />
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!visibleMissions.length ? <p className="text-sm text-muted">Không có việc khớp bộ lọc.</p> : null}
      </div>
    </div>
  );
}

export function OrchestratorView() {
  const roster = useRoster();
  const assignDirect = useOs((state) => state.assignDirect);
  const [skill, setSkill] = useState<SkillKey>("P");
  const ranked = rankForSkill(roster, skill);
  const top = ranked[0];
  return (
    <div>
      <PageHeader
        kicker="Điều phối"
        title="Cách hệ thống chọn người"
        lede="Điểm = 70% kỹ năng đang cần + 15% độ tin cậy từ việc đã đóng + 15% ngân sách vận hành − 24 nếu người đó đã làm pha trước. Hết hạn mức, ngoại tuyến và chờ kích hoạt bị loại."
      />
      <Panel>
        <Field label="Kỹ năng cần xếp hạng">
          <Select value={skill} onChange={(event) => setSkill(event.target.value as SkillKey)}>
            {SKILL_KEYS.map((key) => (
              <option key={key} value={key}>{SKILL_LABEL[key]}</option>
            ))}
          </Select>
        </Field>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-faint">
              <tr>
                <th className="py-2 font-medium">Hạng</th>
                <th className="font-medium">Nhân sự</th>
                <th className="font-medium">Kỹ năng</th>
                <th className="font-medium">Tin cậy</th>
                <th className="font-medium">Ngân sách</th>
                <th className="font-medium">Phạt</th>
                <th className="font-medium">Tổng</th>
                <th className="font-medium">Kết luận</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 8).map((row, index) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-2 font-mono tabular-nums">{index + 1}</td>
                  <td>{row.name}</td>
                  <td className="tabular-nums">{row.skill}</td>
                  <td className="tabular-nums">{row.reliability}</td>
                  <td className="tabular-nums">{row.budget}</td>
                  <td className="tabular-nums">{row.penalty}</td>
                  <td className="tabular-nums">{row.total}</td>
                  <td>{row.eligible ? "Nhận được" : row.blocked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Button onClick={() => assignDirect(skill, `Việc thử · ${SKILL_LABEL[skill]}`)} disabled={!top?.eligible}>
            Giao việc thử cho {top?.eligible ? top.name : "không ai"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

export function QuotasView() {
  const roster = useRoster();
  const setBudget = useOs((state) => state.setBudget);
  const [access, setAccess] = useState("all");
  const [text, setText] = useState("");
  const rows = roster.filter((person) => {
    const blob = `${person.name} ${person.department} ${person.id}`.toLowerCase();
    return (access === "all" || person.access === access) && blob.includes(text.toLowerCase());
  });
  return (
    <div>
      <PageHeader
        kicker="Hạn mức"
        title="Hạn mức và token"
        lede="Cột hạn mức chính thức chỉ ghi những gì đã xác minh. Thanh bên dưới là ngân sách vận hành nội bộ để thử chuyển giao, không phải số token của nhà cung cấp."
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Field label="Lớp truy cập">
          <Select value={access} onChange={(event) => setAccess(event.target.value)}>
            <option value="all">Tất cả</option>
            {Object.entries(ACCESS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Lọc tên">
          <TextInput value={text} onChange={(event) => setText(event.target.value)} placeholder="Tên hoặc mã" />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((person) => (
          <Panel key={person.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to="/" search={{ view: "profile", id: person.id, q: "" }} className="text-sm text-fg">{person.name}</Link>
                <p className="mt-1 text-xs text-faint">{ACCESS_LABEL[person.access]} · {person.accessNote}</p>
              </div>
              <PresenceBadge person={person} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem] sm:items-center">
              <div>
                <Meter value={person.budget} />
                <p className="mt-1 text-xs text-faint">Ngân sách vận hành {person.budget}/100 · chi phí API thực tế: 0</p>
              </div>
              <label className="text-xs text-muted">
                Chỉnh ngân sách
                <input
                  className="mt-1 w-full accent-accent"
                  type="range"
                  min={0}
                  max={100}
                  value={person.budget}
                  onChange={(event) => setBudget(person.id, Number(event.target.value))}
                />
              </label>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function ProjectsView() {
  const projects = useOs((state) => state.projects);
  const tasks = useOs((state) => state.tasks);
  const addProject = useOs((state) => state.addProject);
  const setProjectStatus = useOs((state) => state.setProjectStatus);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  return (
    <div>
      <PageHeader kicker="Dự án" title="Quản lý dự án" lede="Tiến độ tính từ các pha đã xong trên tổng số pha của dự án." />
      <form
        className="mb-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          addProject(name, summary);
          setName("");
          setSummary("");
        }}
      >
        <Field label="Tên dự án"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Mô tả"><TextInput value={summary} onChange={(event) => setSummary(event.target.value)} /></Field>
        <Button type="submit">Tạo</Button>
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((project) => {
          const rows = tasks.filter((task) => task.projectId === project.id);
          const done = rows.filter((task) => task.status === "done").length;
          const progress = rows.length ? Math.round((done / rows.length) * 100) : 0;
          return (
            <Panel key={project.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">{project.name}</h2>
                  <p className="mt-1 text-sm text-muted">{project.summary || "Chưa có mô tả."}</p>
                </div>
                <span className="font-mono text-sm tabular-nums">{progress}%</span>
              </div>
              <div className="mt-3"><Meter value={progress} /></div>
              <p className="mt-2 text-xs text-faint">{done}/{rows.length} pha xong · {project.id}</p>
              <div className="mt-3">
                <Select value={project.status} onChange={(event) => setProjectStatus(project.id, event.target.value as typeof project.status)}>
                  <option value="active">Đang chạy</option>
                  <option value="paused">Tạm dừng</option>
                  <option value="done">Đóng</option>
                </Select>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
