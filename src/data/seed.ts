import { mergeRoster, staffById } from "@/data/roster";
import { planTasks } from "@/lib/engine";
import type { Activity, ChatMessage, Mission, Project, StaffOver, Task } from "@/lib/types";

export const SEED_AT = "2026-11-20T02:00:00.000Z";

const BRIEF =
  "Sửa ứng dụng học tiếng Trung, lộ trình HSK 1. Người học bị kẹt sau bài giới thiệu và không sang được bài từ vựng. Giữ dữ liệu đang có, không viết lại từ đầu.";

export function buildSeed() {
  const staffOver: Record<string, StaffOver> = {
    sora: { budget: 0, status: "quota_exhausted" },
    midjourney: { budget: 14 },
    manus: { status: "standby" },
    dola: { status: "standby" },
    openclaw: { status: "standby" },
    claude: { ok: 12, bad: 1 },
    chatgpt: { ok: 15, bad: 1 },
    codex: { ok: 9, bad: 1 },
    aider: { ok: 6, bad: 1 },
    playwright: { ok: 11, bad: 0 },
    deepseek: { ok: 8, bad: 1 },
    grok: { ok: 7, bad: 1 },
  };
  const roster = mergeRoster(staffOver);
  const project: Project = {
    id: "PRJ-HSK",
    name: "Ứng dụng học tiếng Trung",
    summary: "Sửa lỗi kẹt lộ trình HSK 1 mà không làm mất dữ liệu người học.",
    createdAt: SEED_AT,
    status: "active",
  };
  const mission: Mission = {
    id: "MSN-HSK1",
    projectId: project.id,
    title: "Sửa lỗi lộ trình HSK 1",
    brief: BRIEF,
    kind: "software",
    createdAt: SEED_AT,
  };
  const planned = planTasks({
    roster,
    kind: "software",
    brief: BRIEF,
    projectId: project.id,
    missionId: mission.id,
    priority: "P1",
    now: SEED_AT,
  });
  const tasks: Task[] = planned.map((task, index) =>
    index === 0 ? { ...task, status: "running", progress: 35 } : task,
  );
  const names = tasks
    .map((task) => {
      const person = staffById(roster, task.assigneeId);
      return `${task.phase}. ${task.title}: ${person?.name ?? "hàng đợi"}`;
    })
    .join("\n");
  const activity: Activity[] = [
    {
      id: "ACT-SEED",
      at: SEED_AT,
      tone: "info",
      text: "Bộ điều phối lập kế hoạch MSN-HSK1 và phân công theo điểm năng lực, ngân sách vận hành và trạng thái. Đây là tính toán nội bộ, chưa gọi API nhà cung cấp.",
    },
  ];
  const messages: ChatMessage[] = [
    {
      id: "MSG-SEED",
      at: SEED_AT,
      role: "ceo",
      text: `Chủ tịch, tôi là vai CEO trong sơ đồ — bộ não điều phối đang chạy nội bộ, chưa kết nối API ChatGPT.\n\nViệc mẫu «${mission.title}» đã được tách và giao:\n${names}\n\nCursor có điểm lập trình cao nhưng ngân sách vận hành thấp nên không được ưu tiên nhận pha sửa mã. Sora đang hết hạn mức nội bộ. Dola AI và OpenClaw đang chờ vì chưa đủ hồ sơ xác minh.\n\nAnh ra lệnh tiếp ở ô chat, hoặc mở Trung tâm giao việc.`,
    },
  ];
  return { staffOver, projects: [project], missions: [mission], tasks, activity, messages };
}
