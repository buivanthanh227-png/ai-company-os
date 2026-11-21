import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, ClipboardCopy, ExternalLink, ImagePlus, MessagesSquare, Mic, Paperclip, X } from "lucide-react";
import { Meter, PageHeader, PresenceBadge, StaffMark } from "@/components/bits";
import { Button, Field, Panel, Select, TextArea, TextInput } from "@/components/ui";
import { staffById } from "@/data/roster";
import { detectKind, rankForSkill } from "@/lib/engine";
import { interpret } from "@/lib/ceo";
import { when } from "@/lib/format";
import { getSnapshot, useOs, useRoster } from "@/lib/store";
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
  assigned: "Sẵn sàng chuyển giao",
  handed_off: "Đã chuyển AI · chờ kết quả",
  running: "Đang làm",
  review: "Đang soát",
  done: "Đã xác nhận thủ công",
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
  const [conversationOpen, setConversationOpen] = useState(false);
  const [visibleFrom, setVisibleFrom] = useState(messages.length);
  const [mode, setMode] = useState<"ai" | "local">("ai");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState("");
  const [files, setFiles] = useState<Array<{ file: File; data?: string; content?: string }>>([]);
  const [listening, setListening] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const speechBaseTextRef = useRef("");

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next: typeof files = [];
    for (const file of Array.from(list).slice(0, Math.max(0, 4 - files.length))) {
      if (file.size > 5 * 1024 * 1024) { setNotice(file.name + " vượt quá 5 MB."); continue; }
      if (file.type.startsWith("image/")) {
        const alreadySelected = files.filter((item) => item.data).reduce((total, item) => total + item.file.size, 0);
        if (alreadySelected + file.size > 2_500_000) {
          setNotice("Tổng dung lượng ảnh đính kèm không được vượt quá 2,5 MB để gửi ổn định.");
          continue;
        }
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
    type Engine = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex?: number }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
    const w = window as unknown as { SpeechRecognition?: new () => Engine; webkitSpeechRecognition?: new () => Engine };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setNotice("Trình duyệt chưa hỗ trợ nhập giọng nói."); return; }
    const engine = new Ctor();
    engine.lang = "vi-VN"; engine.interimResults = true;
    speechBaseTextRef.current = text.trim();
    engine.onresult = (e) => {
      // Recognition events contain the current result list; replace the preview, never append it.
      const recognized = Array.from(e.results).map((result) => result[0]?.transcript?.trim() ?? "").filter(Boolean).join(" ");
      const baseText = speechBaseTextRef.current;
      setText([baseText, recognized].filter(Boolean).join(baseText && recognized ? " " : ""));
    };
    engine.onerror = () => { setListening(false); setNotice("Không nhận diện được giọng nói. Kiểm tra quyền micro."); };
    engine.onend = () => {
      setListening(false);
      setNotice("Đã nhận giọng nói. Ngài có thể chỉnh sửa nội dung trước khi gửi.");
    };
    speechRef.current = engine;
    try { engine.start(); setListening(true); setNotice("Đang nghe…"); } catch { setNotice("Không thể bật micro. Kiểm tra quyền truy cập."); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = text.trim();
    if ((!prompt && !files.length) || busyRef.current) return;
    setText(""); setNotice("");
    setVisibleFrom(messages.length);
    setConversationOpen(true);
    const images = files.filter((f) => f.data).map((f) => ({ name: f.file.name, mimeType: f.file.type || "image/jpeg", data: (f.data ?? "").split(",")[1] ?? "" }));
    const textContent = files.filter((f) => f.content).map((f) => "\n\nNỘI DUNG TỆP " + f.file.name + ":\n" + f.content).join("");
    const labels = files.length ? "\n[Tệp đính kèm: " + files.map((f) => f.file.name).join(", ") + "]" : "";
    const message = (prompt || "Vui lòng xem tệp đính kèm.") + textContent;
    const missionIntent = interpret(prompt || "");
    const missionBrief = (prompt || "Vui lòng xử lý tệp đính kèm.") + labels;
    if (mode === "local") { sendLocalChat(message + labels); setFiles([]); return; }
    busyRef.current = true;
    setBusy(true);
    // Show the user's message immediately; network latency should only affect the assistant reply indicator.
    appendChatMessage("chairman", (prompt || "Vui lòng xem tệp đính kèm.") + labels);
    // Create the delegation plan immediately; the provider reply is not a prerequisite for routing work.
    if (missionIntent.type === "mission") {
      const project = projects.find((item) => item.name === "Việc từ phòng CEO");
      createMission({ projectId: project?.id ?? "new", projectName: "Việc từ phòng CEO", title: missionIntent.title, brief: missionBrief, kind: missionIntent.kind, priority: "P1" });
    }
    const history = messages.slice(visibleFrom).slice(-8).map((m) => ({ role: m.role === "chairman" ? "user" as const : "assistant" as const, content: m.text }));
    const includeContext = /nhân sự|công ty|dự án|nhiệm vụ|công việc|giao việc|báo cáo|hạn mức|token|điều hành|trạng thái hệ thống/i.test(prompt);
    const context = [
      "Nhân sự: " + roster.length + "; đang hoạt động: " + roster.filter((p) => p.status === "active").length + ".",
      "Dự án: " + projects.length + "; nhiệm vụ: " + tasks.length + ".",
      ...tasks.slice(0, 8).map((t) => "- " + t.title + " | " + t.status + " | " + (staffById(roster, t.assigneeId)?.name ?? "Chưa phân công")),
    ].join("\n");
    try {
      const { sendAiMessage } = await import("@/lib/ai.functions");
      const result = await sendAiMessage({ data: { message, history, context: includeContext ? context : undefined, attachments: images } });
      appendChatMessage("ceo", result.text, result.provider, result.model);
      setFiles([]);
      const providerLabel = result.provider === "gemini" ? "Google Gemini" : result.provider === "deepseek" ? "DeepSeek" : result.provider === "groq" ? "Groq" : "OpenRouter";
      setNotice(`Đã trả lời bằng ${providerLabel}${result.fallbackUsed ? " (dự phòng)." : "."}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      const answer = msg === "Unauthorized"
        ? "Phiên đăng nhập chưa hợp lệ. Vui lòng đăng nhập lại."
        : msg === "AI_NOT_CONFIGURED"
          ? "Chưa cấu hình nhà cung cấp AI trên máy chủ."
          : msg === "AI_PROVIDER_RATE_LIMITED"
            ? "Nhà cung cấp AI đang giới hạn tần suất. Hãy chờ rồi thử lại."
            : msg === "AI_PROVIDER_AUTH_FAILED"
              ? "Nhà cung cấp AI từ chối xác thực. Quản trị viên cần kiểm tra cấu hình máy chủ."
              : msg === "AI_PROVIDER_TIMEOUT"
                ? "Nhà cung cấp AI phản hồi quá thời gian cho phép. Hãy thử lại sau."
                : "Nhà cung cấp AI hiện không khả dụng. Yêu cầu chưa được xử lý.";
      appendChatMessage("ceo", answer, "local");
      setNotice("Yêu cầu AI chưa hoàn tất. Xem thông báo trong hội thoại để biết nguyên nhân.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-[calc(100dvh-9rem)] flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
        {!conversationOpen || messages.length === visibleFrom ? (
          <div className="my-auto px-3 py-12 text-center">
            <div className="mx-auto mb-6 grid size-16 place-items-center rounded-3xl border border-blue-100 bg-blue-50 text-blue-600"><MessagesSquare className="size-8" /></div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Chào Chủ tịch Bùi Văn Thanh,</h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-muted sm:text-xl">Ngài cần chúng tôi làm việc gì cứ nói nhé.</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6 pb-8">
            {messages.slice(visibleFrom).map((m) => (
              <article key={m.id} className={m.role === "ceo" ? "flex gap-3" : "ml-auto max-w-[88%] rounded-2xl bg-subtle px-4 py-3"}>
                {m.role === "ceo" ? <div className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-elevated text-accent"><MessagesSquare className="size-4" /></div> : null}
                <div className="min-w-0 flex-1">
                  {m.role === "ceo" ? <p className="mb-1 text-xs font-medium text-muted">Trợ lý AI · {m.source === "gemini" ? "Gemini" : m.source === "deepseek" ? "DeepSeek" : m.source === "groq" ? "Groq" : m.source === "openrouter" ? "OpenRouter" : "Nội bộ"}{m.model ? ` · ${m.model}` : ""}</p> : null}
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
            {busy ? <p className="text-sm text-muted" aria-live="polite">Đã nhận tin nhắn · AI đang soạn câu trả lời…</p> : null}
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
            <Button type="submit" disabled={busy || (!text.trim() && !files.length)}>{busy ? "AI đang trả lời…" : "Gửi"}</Button>
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

function TaskHandoff({ task, missionBrief, person }: { task: Task; missionBrief: string; person: ReturnType<typeof staffById> }) {
  const setStatus = useOs((state) => state.setTaskStatus);
  const saveResult = useOs((state) => state.saveTaskResult);
  const setNotice = useOs((state) => state.setNotice);
  const [result, setResult] = useState("");
  const prompt = [
    "Bạn là AI được CEO AI COMPANY OS giao một phần việc cụ thể. Hãy làm đúng phạm vi, không tự mở rộng.",
    "NHIỆM VỤ: " + task.title,
    "MỤC TIÊU CHUNG: " + missionBrief,
    "PHẦN VIỆC CỦA BẠN: " + task.detail,
    "NGỮ CẢNH: " + task.context,
    "YÊU CẦU BÀN GIAO: Trả kết quả cụ thể, nêu phần đã làm, phần chưa làm và hạn chế. Nếu là chỉnh ảnh, phải xuất ảnh đã chỉnh sửa; không chỉ mô tả cách làm.",
    "LƯU Ý: Ảnh/tệp gốc không được tự chuyển giữa các website. Chủ tịch sẽ tự đính kèm lại tệp gốc trong cửa sổ công cụ bên ngoài. Không tuyên bố hoàn thành nếu chưa tạo được đầu ra.",
  ].join("\n\n");
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice("Đã sao chép brief. Mở AI được giao, dán brief và đính kèm tệp gốc.");
    } catch {
      setNotice("Không truy cập được clipboard. Hãy chọn và sao chép nội dung brief từ hồ sơ nhiệm vụ.");
    }
  }
  return (
    <div className="mt-3 rounded-xl border border-line bg-subtle p-3">
      <p className="text-xs font-semibold text-fg">Chuyển giao cho AI bên ngoài</p>
      <p className="mt-1 text-xs leading-5 text-muted">Đây là giao việc qua tài khoản website, chưa phải lệnh gọi API tự động. Chủ tịch cần dán brief và đính kèm lại ảnh/tệp gốc.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => void copyPrompt()}><ClipboardCopy className="size-3.5" /> Sao chép brief</Button>
        {person?.website ? <a href={person.website} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-elevated px-3 text-xs font-medium text-fg"><ExternalLink className="size-3.5" /> Mở {person.name}</a> : <span className="inline-flex h-9 items-center rounded-md px-2 text-xs text-warn">Chưa có website xác minh</span>}
        {task.status === "assigned" && person ? <Button type="button" className="h-9 px-3 text-xs" onClick={() => setStatus(task.id, "handed_off")}>Đã gửi cho AI</Button> : null}
      </div>
      {task.status === "handed_off" ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs font-medium text-fg">Khi AI trả kết quả, dán phần trả lời hoặc đường dẫn tệp vào đây để CEO kiểm tra.</p>
          <TextArea value={result} onChange={(event) => setResult(event.target.value)} placeholder="Dán kết quả AI, đường dẫn tệp hoặc ghi chú bàn giao..." />
          <div><Button type="button" disabled={!result.trim()} onClick={() => { saveResult(task.id, result); setResult(""); }}>Gửi kết quả về CEO soát</Button></div>
        </div>
      ) : null}
      {task.result ? <div className="mt-3 rounded-lg border border-line bg-elevated p-3"><p className="text-xs font-semibold text-fg">Kết quả đã nhận</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted">{task.result}</p></div> : null}
    </div>
  );
}

function TaskActions({ task }: { task: Task }) {
  const affect = useOs((state) => state.affectTask);
  const setStatus = useOs((state) => state.setTaskStatus);
  const setNotice = useOs((state) => state.setNotice);
  const [completing, setCompleting] = useState(false);
  const reasons: [FailReason, string][] = [
    ["quota", "Hết hạn mức"],
    ["timeout", "Quá thời gian"],
    ["rate_limit", "Giới hạn tần suất"],
    ["api_error", "Lỗi API"],
    ["auth_error", "Lỗi xác thực"],
  ];

  async function attestCompletion() {
    setCompleting(true);
    try {
      const { completeTask, loadWorkspaceSnapshot, saveWorkspaceSnapshot } = await import("@/lib/workspace.functions");
      await saveWorkspaceSnapshot({ data: { snapshot: getSnapshot() } });
      await completeTask({ data: { taskId: task.id } });
      const snapshot = await loadWorkspaceSnapshot();
      if (snapshot) useOs.getState().importSnapshot(snapshot);
      setNotice("Đã ghi nhận xác nhận hoàn tất thủ công của owner. Trạng thái này chưa thay thế kiểm chứng CI/commit.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setNotice(
        message.includes("OWNER_IDENTITY_NOT_UNIQUE")
          ? "Không thể phê duyệt bằng danh tính dev-user dùng chung. Cần phiên đăng nhập có user ID riêng."
          : message.includes("OWNER_AUTHORIZATION_NOT_CONFIGURED")
            ? "Chưa cấu hình AI_COMPANY_OWNER_USER_IDS trên máy chủ; thao tác bị khóa an toàn."
            : message.includes("OWNER_FORBIDDEN")
              ? "Tài khoản hiện tại không có quyền owner."
              : message.includes("TASK_RESULT_REQUIRED")
                ? "Cần lưu kết quả trước khi xác nhận hoàn tất."
                : message.includes("WORKSPACE_DATABASE_NOT_CONFIGURED")
                  ? "Kho dữ liệu máy chủ chưa được cấu hình."
                  : "Không thể ghi nhận xác nhận hoàn tất. Trạng thái chưa được thay đổi."
      );
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {task.status === "running" ? <Button variant="secondary" onClick={() => setStatus(task.id, "review")}>Đưa sang soát</Button> : null}
      {task.status === "running" || task.status === "review" ? (
        <Button variant="secondary" onClick={attestCompletion} disabled={completing || !task.assigneeId || !task.result?.trim()}>
          {completing ? "Đang xác nhận..." : "Owner xác nhận hoàn tất"}
        </Button>
      ) : null}
      {task.status !== "done" && task.status !== "failed" ? (
        <Button variant="danger" onClick={() => setStatus(task.id, "failed")}>Đánh dấu thất bại</Button>
      ) : null}
      {reasons.map(([reason, label]) => (
        <Button key={reason} variant="ghost" onClick={() => affect(task.id, reason)} disabled={task.status === "done" || task.status === "failed"}>
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
        lede="Theo dõi từng pha từ lúc được phân công, chuyển cho AI bên ngoài, nhận kết quả đến CEO soát xét. Hoàn tất chỉ được ghi nhận bằng owner attestation phía máy chủ; đây chưa phải xác minh CI/commit."
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
                      {person && task.status !== "done" && task.status !== "failed" ? <TaskHandoff task={task} missionBrief={mission.brief} person={person} /> : null}
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
