import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, ImagePlus, MessagesSquare, Mic, Paperclip, X } from "lucide-react";
import { Meter, PageHeader, PresenceBadge, StaffMark } from "@/components/bits";
import { Button, Field, Panel, Select, TextArea, TextInput } from "@/components/ui";
import { staffById } from "@/data/roster";
import { detectKind, rankForSkill } from "@/lib/engine";
import { interpret } from "@/lib/ceo";
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
  const messages = useOs((s) => s.messages);
  const appendChatMessage = useOs((s) => s.appendChatMessage);
  const sendLocalChat = useOs((s) => s.sendChat);
  const tasks = useOs((s) => s.tasks);
  const projects = useOs((s) => s.projects);
  const missions = useOs((s) => s.missions);
  const createMission = useOs((s) => s.createMission);
  const roster = useRoster();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"ai" | "local">("ai");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [files, setFiles] = useState<Array<{ file: File; data?: string; content?: string }>>([]);
  const [listening, setListening] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<{ stop: () => void } | null>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next: typeof files = [];
    for (const file of Array.from(list).slice(0, Math.max(0, 4 - files.length))) {
      if (file.size > 5 * 1024 * 1024) { setNotice(file.name + " vượt quá 5 MB."); continue; }
      if (file.type.startsWith("image/")) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("Không đọc được ảnh"));
          reader.readAsDataURL(file);
        });
        next.push({ file, data });
      } else if (file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name)) {
        next.push({ file, content: (await file.text()).slice(0, 30000) });
      } else setNotice("Hiện hỗ trợ ảnh và tệp văn bản TXT, MD, CSV, JSON.");
    }
    setFiles((current) => [...current, ...next].slice(0, 4));
  }

  function toggleVoice() {
    if (listening) { speechRef.current?.stop(); setListening(false); return; }
    type Engine = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
    const w = window as unknown as { SpeechRecognition?: new () => Engine; webkitSpeechRecognition?: new () => Engine };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setNotice("Trình duyệt chưa hỗ trợ nhập giọng nói."); return; }
    const engine = new Ctor();
    engine.lang = "vi-VN"; engine.interimResults = true;
    engine.onresult = (e) => setText((v) => v + (v ? " " : "") + Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(""));
    engine.onerror = () => { setListening(false); setNotice("Không nhận diện được giọng nói. Kiểm tra quyền micro."); };
    engine.onend = () => setListening(false);
    speechRef.current = engine;
    try { engine.start(); setListening(true); setNotice("Đang nghe…"); } catch { setNotice("Không thể bật micro. Kiểm tra quyền truy cập."); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = text.trim();
    if ((!prompt && !files.length) || busy) return;
    setText(""); setNotice("");
    const images = files.filter((f) => f.data).map((f) => ({ name: f.file.name, mimeType: f.file.type || "image/jpeg", data: (f.data ?? "").split(",")[1] ?? "" }));
    const textContent = files.filter((f) => f.content).map((f) => "\n\nNỘI DUNG TỆP " + f.file.name + ":\n" + f.content).join("");
    const labels = files.length ? "\n[Tệp đính kèm: " + files.map((f) => f.file.name).join(", ") + "]" : "";
    const message = (prompt || "Vui lòng xem tệp đính kèm.") + textContent;
    if (mode === "local") { sendLocalChat(message + labels); setFiles([]); return; }
    setBusy(true);
    const history = messages.slice(-8).map((m) => ({ role: m.role === "chairman" ? "user" as const : "assistant" as const, content: m.text }));
    const includeContext = /nhân sự|công ty|dự án|nhiệm vụ|công việc|giao việc|báo cáo|hạn mức|token|điều hành|trạng thái hệ thống/i.test(prompt);
    const context = [
      "Nhân sự: " + roster.length + "; đang hoạt động: " + roster.filter((p) => p.status === "active").length + ".",
      "Dự án: " + projects.length + "; nhiệm vụ: " + tasks.length + ".",
      ...tasks.slice(0, 8).map((t) => "- " + t.title + " | " + t.status + " | " + (staffById(roster, t.assigneeId)?.name ?? "Chưa phân công")),
    ].join("\n");
    try {
      const { sendAiMessage } = await import("@/lib/ai.functions");
      const result = await sendAiMessage({ data: { message, history, context: includeContext ? context : undefined, attachments: images } });
      appendChatMessage("chairman", (prompt || "Vui lòng xem tệp đính kèm.") + labels);
      appendChatMessage("ceo", result.text, result.provider);
      setFiles([]);
      setNotice(result.provider === "gemini" ? "Đã trả lời bằng Google Gemini." : "Đã trả lời bằng OpenRouter" + (result.fallbackUsed ? " (dự phòng)." : "."));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      appendChatMessage("chairman", (prompt || "Vui lòng xem tệp đính kèm.") + labels);
      const answer = msg.includes("Unauthorized")
        ? "Phiên đăng nhập chưa hợp lệ. Vui lòng đăng nhập lại."
        : msg.includes("AI_NOT_CONFIGURED")
          ? "Chưa cấu hình khóa AI trên máy chủ. Hãy kiểm tra cấu hình Vercel."
          : msg.includes("AI_PROVIDER_UNAVAILABLE:BOTH")
            ? "Gemini và OpenRouter đều chưa phản hồi. Vui lòng thử lại sau."
            : "Hiện chưa kết nối được nhà cung cấp AI. Yêu cầu chưa được xử lý.";
      appendChatMessage("ceo", answer, "local");
      setNotice("Kết nối AI chưa sẵn sàng.");
    } finally { setBusy(false); }
  }

  return (
    <section className="flex min-h-[calc(100dvh-9rem)] flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
        {messages.length === 0 ? (
          <div className="my-auto px-3 py-12 text-center">
            <div className="mx-auto mb-6 grid size-16 place-items-center rounded-3xl border border-blue-100 bg-blue-50 text-blue-600"><MessagesSquare className="size-8" /></div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Chào Chủ tịch Bùi Văn Thanh,</h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-muted sm:text-xl">Ngài cần chúng tôi làm việc gì cứ nói nhé.</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6 pb-8">
            {messages.map((m) => (
              <article key={m.id} className={m.role === "ceo" ? "flex gap-3" : "ml-auto max-w-[88%] rounded-2xl bg-subtle px-4 py-3"}>
                {m.role === "ceo" ? <div className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-elevated text-accent"><MessagesSquare className="size-4" /></div> : null}
                <div className="min-w-0 flex-1">
                  {m.role === "ceo" ? <p className="mb-1 text-xs font-medium text-muted">Trợ lý AI · {m.source === "gemini" ? "Gemini" : m.source === "openrouter" ? "OpenRouter" : "Nội bộ"}</p> : null}
                  <p className="whitespace-pre-wrap text-sm leading-7 text-fg">{m.text}</p>
                  {m.role === "chairman" && interpret(m.text).type === "mission" ? (
                    <div className="mt-2">
                      {missions.some((mission) => mission.brief === m.text) ? <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">Đã lập kế hoạch</span> : (
                        <Button type="button" variant="secondary" className="h-9 px-3 text-sm" onClick={() => {
                          const project = projects.find((p) => p.name === "Việc từ phòng CEO");
                          createMission({ projectId: project?.id ?? "new", projectName: "Việc từ phòng CEO", title: m.text.slice(0, 90), brief: m.text, kind: detectKind(m.text), priority: "P1" });
                          setNotice("Đã lập kế hoạch nội bộ. Các AI bên ngoài chưa tự động thực thi.");
                        }}><MessagesSquare className="size-4" /> Lập kế hoạch & phân công</Button>
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            {busy ? <p className="text-sm text-muted" aria-live="polite">Trợ lý đang xử lý yêu cầu…</p> : null}
          </div>
        )}
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-4xl bg-bg pb-2 pt-3">
        <form className="rounded-2xl border border-line bg-elevated p-3 shadow-sm sm:p-4" onSubmit={submit}>
          <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "ai" ? "Ngài muốn giao việc gì cho chúng tôi?" : "Nhập lệnh điều hành nội bộ..."} disabled={busy} />
          {files.length ? <div className="flex flex-wrap gap-2 px-1 py-2">{files.map((f, i) => (
            <div key={f.file.name + i} className="flex max-w-full items-center gap-2 rounded-xl border border-line bg-subtle px-2 py-1.5 text-xs">
              {f.data ? <img src={f.data} alt={f.file.name} className="size-9 rounded-md object-cover" /> : <Paperclip className="size-4 text-accent" />}
              <span className="max-w-40 truncate">{f.file.name}</span>
              <button type="button" aria-label={"Bỏ " + f.file.name} onClick={() => setFiles((v) => v.filter((_, n) => n !== i))}><X className="size-3.5" /></button>
            </div>
          ))}</div> : null}
          {notice ? <p className="px-2 pb-2 text-xs text-muted" aria-live="polite">{notice}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <div className="flex flex-wrap items-center gap-1">
              <input ref={docRef} type="file" accept=".txt,.md,.csv,.json,text/*" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
              <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => docRef.current?.click()}><Paperclip className="size-4" /><span className="hidden sm:inline">Đính kèm tệp</span></Button>
              <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => cameraRef.current?.click()}><Camera className="size-4" /><span className="hidden sm:inline">Chụp ảnh</span></Button>
              <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => photoRef.current?.click()}><ImagePlus className="size-4" /><span className="hidden sm:inline">Thư viện ảnh</span></Button>
              <Button type="button" variant={listening ? "secondary" : "ghost"} className="h-10 px-3" onClick={toggleVoice}><Mic className="size-4" /><span className="hidden sm:inline">{listening ? "Đang nghe" : "Giọng nói"}</span></Button>
              <Button type="button" className="h-9 px-3" variant={mode === "ai" ? "secondary" : "ghost"} onClick={() => setMode("ai")}>Chat AI</Button>
              <Button type="button" className="h-9 px-3" variant={mode === "local" ? "secondary" : "ghost"} onClick={() => setMode("local")}>Lệnh nội bộ</Button>
            </div>
            <Button type="submit" disabled={busy || (!text.trim() && !files.length)}>{busy ? "Đang gửi..." : "Gửi"}</Button>
          </div>
        </form>
        <p className="mt-2 text-center text-[11px] text-faint">Nhập giọng nói · Tối đa 4 ảnh hoặc tệp văn bản, 5 MB mỗi tệp.</p>
      </div>
    </section>
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
