import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mergeRoster, staffById } from "@/data/roster";
import { buildSeed } from "@/data/seed";
import { findText, helpText, interpret, mentionedStaff, queueText, reportText } from "@/lib/ceo";
import { applyHandover, isOpen, planTasks, rankForSkill } from "@/lib/engine";
import type {
  Activity,
  ChatMessage,
  FailReason,
  Mission,
  MissionKind,
  Priority,
  Project,
  Proposal,
  Rank,
  Settings,
  SkillKey,
  StaffOver,
  Task,
} from "@/lib/types";
import { KIND_LABEL, RANK_LABEL } from "@/lib/types";

export type Snapshot = {
  staffOver: Record<string, StaffOver>;
  projects: Project[];
  missions: Mission[];
  tasks: Task[];
  activity: Activity[];
  messages: ChatMessage[];
  proposals: Proposal[];
  settings: Settings;
};

type OsState = Snapshot & {
  notice: string | null;
  hydrated: boolean;
  setNotice: (notice: string | null) => void;
  markHydrated: () => void;
  createMission: (input: {
    projectId: string;
    projectName: string;
    title: string;
    brief: string;
    kind: MissionKind;
    priority: Priority;
  }) => string;
  assignDirect: (skill: SkillKey, title: string) => void;
  sendChat: (text: string) => void;
  affectTask: (taskId: string, reason: FailReason) => void;
  setTaskStatus: (taskId: string, status: Task["status"]) => void;
  exhaustStaff: (id: string) => void;
  restoreStaff: (id: string, status?: "active" | "standby" | "offline") => void;
  setBudget: (id: string, budget: number) => void;
  setSkill: (id: string, skill: SkillKey, value: number) => void;
  propose: (input: { staffId: string; toRank: Rank; title: string; reason: string }) => void;
  decideProposal: (id: string, accept: boolean) => void;
  addProject: (name: string, summary: string) => void;
  setProjectStatus: (id: string, status: Project["status"]) => void;
  setOrgName: (orgName: string) => void;
  setKey: (name: string, value: string) => void;
  importSnapshot: (snapshot: Snapshot) => void;
  reset: () => void;
};

const EMPTY_SETTINGS: Settings = { orgName: "AI COMPANY OS", keys: {} };

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function pushActivity(items: Activity[], text: string, tone: Activity["tone"], at: string): Activity[] {
  return [{ id: nid("ACT"), at, text, tone }, ...items].slice(0, 200);
}

function bump(over: Record<string, StaffOver>, id: string | null, field: "ok" | "bad") {
  if (!id) return over;
  const current = over[id] ?? {};
  return { ...over, [id]: { ...current, [field]: (current[field] ?? 0) + 1 } };
}

const seed = buildSeed();

export const useOs = create<OsState>()(
  persist(
    (set, get) => ({
      ...seed,
      proposals: [] as Proposal[],
      settings: EMPTY_SETTINGS,
      notice: null,
      hydrated: false,
      setNotice: (notice) => set({ notice }),
      markHydrated: () => set({ hydrated: true }),
      createMission: (input) => {
        const at = nowIso();
        const state = get();
        let projects = state.projects;
        let projectId = input.projectId;
        if (projectId === "new") {
          const created: Project = {
            id: nid("PRJ"),
            name: input.projectName.trim() || "Dự án mới",
            summary: input.brief.trim(),
            createdAt: at,
            status: "active",
          };
          projects = [created, ...projects];
          projectId = created.id;
        }
        const mission: Mission = {
          id: nid("MSN"),
          projectId,
          title: input.title.trim() || "Việc mới",
          brief: input.brief.trim(),
          kind: input.kind,
          createdAt: at,
        };
        const roster = mergeRoster(state.staffOver);
        const tasks = [
          ...planTasks({
            roster,
            kind: input.kind,
            brief: mission.brief,
            projectId,
            missionId: mission.id,
            priority: input.priority,
            now: at,
          }),
          ...state.tasks,
        ];
        const lines = tasks
          .filter((task) => task.missionId === mission.id)
          .map((task) => `${task.phase}. ${task.title}: ${staffById(roster, task.assigneeId)?.name ?? "hàng đợi"}`)
          .join("\n");
        const ceo: ChatMessage = {
          id: nid("MSG"),
          at,
          role: "ceo",
          text: `Đã lập ${KIND_LABEL[input.kind]} cho «${mission.title}».\n${lines}\nNgữ cảnh được lưu trên từng pha. Chưa gọi API ngoài.`,
        };
        set({
          projects,
          missions: [mission, ...state.missions],
          tasks,
          messages: [...state.messages, ceo].slice(-100),
          activity: pushActivity(state.activity, `Lập kế hoạch ${mission.id}: ${mission.title}.`, "ok", at),
          notice: "Đã phân công. Mở Theo dõi nhiệm vụ để chuyển giao nếu cần.",
        });
        return mission.id;
      },
      assignDirect: (skill, title) => {
        const at = nowIso();
        const state = get();
        const roster = mergeRoster(state.staffOver);
        const pick = rankForSkill(roster, skill).find((row) => row.eligible) ?? null;
        const project = state.projects[0] ?? {
          id: "PRJ-OS",
          name: "Điều phối",
          summary: "Việc tạo từ bộ điều phối.",
          createdAt: at,
          status: "active" as const,
        };
        const projects = state.projects.length ? state.projects : [project];
        const missionId = nid("MSN");
        const task: Task = {
          id: `${missionId}-A`,
          projectId: project.id,
          missionId,
          phase: "A",
          title: title.trim() || "Việc thử điều phối",
          detail: "Tạo từ bảng xếp hạng để kiểm tra lựa chọn.",
          skill,
          assigneeId: pick?.id ?? null,
          triedIds: [],
          status: pick ? "assigned" : "queued",
          progress: 0,
          context: pick
            ? `Giao ${pick.name} với điểm ${pick.total}. Kỹ năng ${pick.skill}, tin cậy ${pick.reliability}, ngân sách ${pick.budget}.`
            : "Không có ứng viên khả dụng. Việc vào hàng đợi.",
          priority: "P2",
          attempts: 0,
          history: [{ at, text: pick ? `Điều phối thử giao ${pick.name}, điểm ${pick.total}.` : "Không có người, đưa hàng đợi." }],
          updatedAt: at,
        };
        set({
          projects,
          missions: [
            {
              id: missionId,
              projectId: project.id,
              title: task.title,
              brief: task.context,
              kind: "generic",
              createdAt: at,
            },
            ...state.missions,
          ],
          tasks: [task, ...state.tasks],
          activity: pushActivity(state.activity, task.history[0]!.text, pick ? "ok" : "warn", at),
          notice: task.history[0]!.text,
        });
      },
      sendChat: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const at = nowIso();
        const state = get();
        const human: ChatMessage = { id: nid("MSG"), at, role: "chairman", text: trimmed };
        const intent = interpret(trimmed);
        set({ messages: [...state.messages, human].slice(-100) });
        if (intent.type === "mission") {
          const existing = get().projects.find((item) => item.name === "Việc từ phòng CEO");
          get().createMission({
            projectId: existing?.id ?? "new",
            projectName: "Việc từ phòng CEO",
            title: intent.title,
            brief: intent.brief,
            kind: intent.kind,
            priority: "P1",
          });
          return;
        }
        const roster = mergeRoster(get().staffOver);
        let reply = helpText();
        if (intent.type === "report") reply = reportText(roster, get().tasks);
        if (intent.type === "queue") reply = queueText(roster, get().tasks);
        if (intent.type === "find") reply = findText(roster, trimmed);
        if (intent.type === "exhaust" || intent.type === "restore") {
          const person = mentionedStaff(roster, trimmed);
          if (!person) reply = "Tôi không thấy tên nhân sự trong câu. Ghi đúng tên, ví dụ: hết hạn mức Claude.";
          else if (intent.type === "exhaust") {
            get().exhaustStaff(person.id);
            reply = `Đã ghi ${person.name} hết hạn mức vận hành và chuyển các việc đang mở, giữ nguyên ngữ cảnh.`;
          } else {
            get().restoreStaff(person.id, "active");
            reply = `${person.name} trở lại danh sách ứng viên. Việc đã giao cho người khác không bị thu hồi.`;
          }
        }
        const ceo: ChatMessage = { id: nid("MSG"), at, role: "ceo", text: reply };
        set({ messages: [...get().messages, ceo].slice(-100) });
      },
      affectTask: (taskId, reason) => {
        const at = nowIso();
        const state = get();
        const current = state.tasks.find((task) => task.id === taskId);
        if (!current) return;
        let staffOver = state.staffOver;
        let roster = mergeRoster(staffOver);
        if (reason === "quota" && current.assigneeId) {
          staffOver = {
            ...staffOver,
            [current.assigneeId]: { ...staffOver[current.assigneeId], budget: 0, status: "quota_exhausted" },
          };
          roster = mergeRoster(staffOver);
        }
        const updated = applyHandover(roster, current, reason, at);
        set({
          staffOver,
          tasks: state.tasks.map((task) => (task.id === taskId ? updated : task)),
          activity: pushActivity(state.activity, `${current.title}: ${updated.history.at(-1)?.text ?? reason}`, updated.status === "queued" ? "warn" : "info", at),
          notice: updated.history.at(-1)?.text ?? "Đã cập nhật việc.",
        });
      },
      setTaskStatus: (taskId, status) => {
        const at = nowIso();
        const state = get();
        const current = state.tasks.find((task) => task.id === taskId);
        if (!current) return;
        let staffOver = state.staffOver;
        if (status === "done") staffOver = bump(staffOver, current.assigneeId, "ok");
        if (status === "failed") staffOver = bump(staffOver, current.assigneeId, "bad");
        const progress = status === "done" ? 100 : status === "review" ? Math.max(current.progress, 80) : status === "running" ? Math.max(current.progress, 10) : current.progress;
        const text =
          status === "done"
            ? "Đánh dấu hoàn thành. Ngữ cảnh được giữ trong hồ sơ việc."
            : status === "failed"
              ? "Đánh dấu thất bại và trừ tỷ lệ thành công của người nhận."
              : status === "review"
                ? "Chuyển sang bước soát."
                : "Bắt đầu thực hiện.";
        const updated: Task = {
          ...current,
          status,
          progress,
          updatedAt: at,
          history: [...current.history, { at, text }],
        };
        set({
          staffOver,
          tasks: state.tasks.map((task) => (task.id === taskId ? updated : task)),
          activity: pushActivity(state.activity, `${current.title}: ${text}`, status === "done" ? "ok" : status === "failed" ? "warn" : "info", at),
          notice: text,
        });
      },
      exhaustStaff: (id) => {
        const at = nowIso();
        const state = get();
        const staffOver = {
          ...state.staffOver,
          [id]: { ...state.staffOver[id], budget: 0, status: "quota_exhausted" as const },
        };
        const roster = mergeRoster(staffOver);
        const tasks = state.tasks.map((task) =>
          task.assigneeId === id && isOpen(task.status) ? applyHandover(roster, task, "quota", at) : task,
        );
        const name = staffById(roster, id)?.name ?? id;
        set({
          staffOver,
          tasks,
          activity: pushActivity(state.activity, `${name} hết hạn mức vận hành. Việc đang mở được chuyển, không xóa ngữ cảnh.`, "warn", at),
          notice: `${name} đã hết hạn mức. Việc đang mở được chuyển hoặc đưa vào hàng đợi.`,
        });
      },
      restoreStaff: (id, status = "active") => {
        const at = nowIso();
        const state = get();
        const current = state.staffOver[id] ?? {};
        const budget = status === "active" ? Math.max(current.budget ?? 0, 80) : current.budget ?? 0;
        const staffOver = { ...state.staffOver, [id]: { ...current, status, budget } };
        const name = staffById(mergeRoster(staffOver), id)?.name ?? id;
        const text =
          status === "active"
            ? `${name} trở lại danh sách ứng viên. Việc cũ không bị thu hồi.`
            : status === "offline"
              ? `${name} chuyển ngoại tuyến và không nhận việc mới.`
              : `${name} chuyển sang chờ kích hoạt.`;
        set({
          staffOver,
          activity: pushActivity(state.activity, text, "info", at),
          notice: text,
        });
      },
      setBudget: (id, budget) => {
        const value = Math.max(0, Math.min(100, Math.round(budget)));
        if (value <= 0) {
          get().exhaustStaff(id);
          return;
        }
        const state = get();
        const current = state.staffOver[id] ?? {};
        const wasOut = current.status === "quota_exhausted";
        set({
          staffOver: {
            ...state.staffOver,
            [id]: { ...current, budget: value, status: wasOut ? "active" : current.status },
          },
          notice: wasOut ? "Đã nạp lại ngân sách và đưa vào danh sách ứng viên." : "Đã cập nhật ngân sách vận hành nội bộ.",
        });
      },
      setSkill: (id, skill, value) => {
        const state = get();
        const current = state.staffOver[id] ?? {};
        const score = Math.max(0, Math.min(100, Math.round(value)));
        set({
          staffOver: {
            ...state.staffOver,
            [id]: { ...current, skills: { ...current.skills, [skill]: score } },
          },
          notice: "Đã lưu điểm vận hành nội bộ.",
        });
      },
      propose: (input) => {
        const at = nowIso();
        const state = get();
        const person = staffById(mergeRoster(state.staffOver), input.staffId);
        if (!person) return;
        const proposal: Proposal = {
          id: nid("PRP"),
          at,
          staffId: person.id,
          fromRank: person.rank,
          toRank: input.toRank,
          title: input.title.trim() || RANK_LABEL[input.toRank],
          reason: input.reason.trim(),
          status: "pending",
        };
        set({
          proposals: [proposal, ...state.proposals],
          activity: pushActivity(state.activity, `CEO đề xuất điều chuyển ${person.name} thành ${proposal.title}. Chờ Chủ tịch duyệt.`, "info", at),
          notice: "Đề xuất đang chờ Chủ tịch phê duyệt.",
        });
      },
      decideProposal: (id, accept) => {
        const at = nowIso();
        const state = get();
        const proposal = state.proposals.find((item) => item.id === id);
        if (!proposal || proposal.status !== "pending") return;
        let staffOver = state.staffOver;
        if (accept) {
          staffOver = {
            ...staffOver,
            [proposal.staffId]: {
              ...staffOver[proposal.staffId],
              rank: proposal.toRank,
              title: proposal.title,
            },
          };
        }
        set({
          staffOver,
          proposals: state.proposals.map((item) =>
            item.id === id ? { ...item, status: accept ? "approved" : "rejected" } : item,
          ),
          activity: pushActivity(
            state.activity,
            accept ? `Chủ tịch duyệt điều chuyển ${proposal.title}.` : "Chủ tịch bác đề xuất điều chuyển.",
            accept ? "ok" : "warn",
            at,
          ),
          notice: accept ? "Đã duyệt điều chuyển." : "Đã bác đề xuất.",
        });
      },
      addProject: (name, summary) => {
        const at = nowIso();
        const project: Project = {
          id: nid("PRJ"),
          name: name.trim() || "Dự án mới",
          summary: summary.trim(),
          createdAt: at,
          status: "active",
        };
        set({
          projects: [project, ...get().projects],
          activity: pushActivity(get().activity, `Mở dự án ${project.name}.`, "info", at),
          notice: "Đã tạo dự án.",
        });
      },
      setProjectStatus: (id, status) => {
        set({
          projects: get().projects.map((project) => (project.id === id ? { ...project, status } : project)),
        });
      },
      setOrgName: (orgName) => set({ settings: { ...get().settings, orgName } }),
      setKey: (name, value) => {
        const settings = get().settings;
        set({
          settings: { ...settings, keys: { ...settings.keys, [name]: value } },
          notice: "Đã lưu trên trình duyệt này. Khóa không được gửi đi.",
        });
      },
      importSnapshot: (snapshot) => {
        set({
          ...snapshot,
          notice: "Đã nhập bản dữ liệu. Khóa vẫn chỉ nằm trên máy này.",
        });
      },
      reset: () => {
        set({
          ...buildSeed(),
          settings: EMPTY_SETTINGS,
          proposals: [],
          notice: "Đã khôi phục dữ liệu mẫu.",
        });
      },
    }),
    {
      name: "ai-company-os-v1",
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage() : localStorage)),
      skipHydration: true,
      partialize: (state) => ({
        staffOver: state.staffOver,
        projects: state.projects,
        missions: state.missions,
        tasks: state.tasks,
        activity: state.activity,
        messages: state.messages,
        proposals: state.proposals,
        settings: state.settings,
      }),
    },
  ),
);

export function useRoster() {
  const over = useOs((state) => state.staffOver);
  return useMemo(() => mergeRoster(over), [over]);
}
