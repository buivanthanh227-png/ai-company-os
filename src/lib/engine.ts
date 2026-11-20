import type {
  FailReason,
  LiveStaff,
  MissionKind,
  Presence,
  Priority,
  SkillKey,
  Task,
  TaskStatus,
} from "@/lib/types";
import { REASON_LABEL, SKILL_LABEL } from "@/lib/types";

export type Breakdown = {
  id: string;
  name: string;
  eligible: boolean;
  blocked?: string;
  skill: number;
  reliability: number;
  budget: number;
  penalty: number;
  bias: number;
  total: number;
};

export type PhaseTemplate = {
  phase: string;
  title: string;
  skill: SkillKey;
  detail: string;
};

const OPEN: TaskStatus[] = ["queued", "assigned", "handed_off", "running", "review"];

export function isOpen(status: TaskStatus) {
  return OPEN.includes(status);
}

export function presenceOf(staff: Pick<LiveStaff, "status" | "budget">): Presence {
  if (staff.status === "offline" || staff.status === "standby") return staff.status;
  if (staff.budget <= 0 || staff.status === "quota_exhausted") return "quota_exhausted";
  if (staff.budget < 20 || staff.status === "degraded") return "degraded";
  return "active";
}

export function reliabilityOf(ok: number, bad: number) {
  const n = ok + bad;
  if (n === 0) return 70;
  return Math.round((100 * ok) / n);
}

export function rankForSkill(
  roster: LiveStaff[],
  skill: SkillKey,
  usedIds: string[] = [],
  banIds: string[] = [],
): Breakdown[] {
  return roster
    .map((s) => {
      const presence = presenceOf(s);
      const skillPts = s.skills[skill] ?? 0;
      const reliability = reliabilityOf(s.ok, s.bad);
      const budget = Math.max(0, Math.min(100, s.budget));
      const penalty = usedIds.includes(s.id) ? 24 : 0;
      const bias = (skill === "W" || skill === "O") && s.rank === "ceo" ? 3 : 0;
      const total =
        Math.round((skillPts * 0.7 + reliability * 0.15 + budget * 0.15 - penalty + bias) * 10) / 10;
      let blocked: string | undefined;
      if (banIds.includes(s.id)) blocked = "Vừa bàn giao, không giao lại ngay";
      else if (presence === "quota_exhausted") blocked = "Hết hạn mức";
      else if (presence === "offline") blocked = "Ngoại tuyến";
      else if (presence === "standby") blocked = "Đang chờ kích hoạt";
      return {
        id: s.id,
        name: s.name,
        eligible: !blocked,
        blocked,
        skill: skillPts,
        reliability,
        budget,
        penalty,
        bias,
        total,
      };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.total - a.total || a.name.localeCompare(b.name, "vi");
    });
}

export function detectKind(text: string): MissionKind {
  const t = text.toLowerCase();
  if (/video|clip|phim|chuyển động/.test(t)) return "video";
  if (/hình|ảnh|logo|poster|minh họa|thiết kế đồ/.test(t)) return "image";
  if (/giọng|nhạc|âm thanh|lồng tiếng|podcast/.test(t)) return "audio";
  if (/dịch\b|song ngữ|bản địa hóa/.test(t)) return "translate";
  if (/nghiên cứu|tìm hiểu|khảo sát|đối chiếu/.test(t)) return "research";
  if (/kiểm thử|test\b|e2e|playwright/.test(t)) return "qa";
  if (/dữ liệu|biểu đồ|thống kê|csv|excel/.test(t)) return "data";
  if (/tự động hóa|workflow|n8n|zapier/.test(t)) return "auto";
  if (/viết|nội dung|bài đăng|email|kịch bản/.test(t)) return "writing";
  if (/code|mã nguồn|sửa|lỗi|bug|app|ứng dụng|phần mềm|giao diện/.test(t)) return "software";
  return "generic";
}

export function phasesFor(kind: MissionKind, brief: string): PhaseTemplate[] {
  const bite = brief.trim().slice(0, 180);
  const withBrief = (text: string) => `${text} Bối cảnh: ${bite}`;
  if (kind === "software") {
    return [
      { phase: "A", title: "Phân tích mã nguồn", skill: "K", detail: withBrief("Đọc cấu trúc, phụ thuộc và rủi ro.") },
      { phase: "B", title: "Tìm nguyên nhân lỗi", skill: "L", detail: withBrief("Khoanh đúng chỗ hỏng, chưa sửa vội.") },
      { phase: "C", title: "Đề xuất phương án sửa", skill: "K", detail: withBrief("Đưa phương án tối thiểu, người khác với pha phân tích nếu có.") },
      { phase: "D", title: "Thực hiện sửa mã", skill: "P", detail: withBrief("Sửa đúng phạm vi, giữ ngữ cảnh các pha trước.") },
      { phase: "E", title: "Kiểm thử", skill: "E", detail: withBrief("Viết và chạy kiểm thử cho đường vừa sửa.") },
      { phase: "F", title: "Đánh giá độc lập", skill: "N", detail: withBrief("Phản biện bởi người chưa sửa mã.") },
      { phase: "G", title: "Đóng gói và báo cáo", skill: "W", detail: withBrief("Tổng hợp nghiệm thu cho Chủ tịch.") },
    ];
  }
  if (kind === "research") {
    return [
      { phase: "A", title: "Khoanh phạm vi", skill: "N", detail: withBrief("Chốt câu hỏi và tiêu chí nguồn.") },
      { phase: "B", title: "Thu thập nguồn", skill: "N", detail: withBrief("Lấy nguồn đối chiếu được, ghi ngày.") },
      { phase: "C", title: "Phản biện", skill: "N", detail: withBrief("Tìm điểm yếu của kết luận nháp.") },
      { phase: "D", title: "Báo cáo", skill: "W", detail: withBrief("Viết ngắn, tách sự kiện và suy đoán.") },
    ];
  }
  if (kind === "image") {
    return [
      { phase: "A", title: "Phân tích ảnh và yêu cầu", skill: "H", detail: withBrief("Xác định vùng cần sửa, phần phải giữ nguyên và tiêu chí ảnh đầu ra.") },
      { phase: "B", title: "Chỉnh sửa ảnh gốc", skill: "H", detail: withBrief("Thực hiện chỉnh sửa trực tiếp trên ảnh gốc, không chỉ tạo ảnh mới.") },
      { phase: "C", title: "Soát chất lượng ảnh", skill: "H", detail: withBrief("Kiểm tra vùng đã chỉnh, ánh sáng, bóng, viền và tính tự nhiên.") },
      { phase: "D", title: "Nghiệm thu và báo cáo", skill: "W", detail: withBrief("Nêu công cụ, phần đã sửa, phần còn lỗi và bàn giao tệp ảnh đầu ra.") },
    ];
  }
  if (kind === "video") {
    return [
      { phase: "A", title: "Kịch bản ngắn", skill: "W", detail: withBrief("Chốt thời lượng và thông điệp.") },
      { phase: "B", title: "Dựng hình động", skill: "V", detail: withBrief("Tạo cảnh theo kịch bản.") },
      { phase: "C", title: "Lồng tiếng", skill: "A", detail: withBrief("Thêm lời nếu brief yêu cầu.") },
      { phase: "D", title: "Duyệt kỹ thuật", skill: "E", detail: withBrief("Kiểm tra nhịp, chữ và lỗi hình.") },
    ];
  }
  if (kind === "audio") {
    return [
      { phase: "A", title: "Chốt lời thoại", skill: "W", detail: withBrief("Văn bản đọc, giọng và tốc độ.") },
      { phase: "B", title: "Tạo âm thanh", skill: "A", detail: withBrief("Thu hoặc sinh giọng.") },
      { phase: "C", title: "Nghe đối chiếu", skill: "E", detail: withBrief("So với bản chữ, ghi chỗ lệch.") },
    ];
  }
  if (kind === "writing") {
    return [
      { phase: "A", title: "Dàn ý", skill: "W", detail: withBrief("Cấu trúc và giọng văn.") },
      { phase: "B", title: "Viết bản đủ", skill: "W", detail: withBrief("Viết đủ ý, chưa trang trí.") },
      { phase: "C", title: "Biên tập độc lập", skill: "N", detail: withBrief("Người khác soát sự kiện và mạch.") },
    ];
  }
  if (kind === "translate") {
    return [
      { phase: "A", title: "Dịch sát nghĩa", skill: "D", detail: withBrief("Giữ thuật ngữ nhất quán.") },
      { phase: "B", title: "Biên tập địa phương", skill: "D", detail: withBrief("Người khác đọc như người bản ngữ.") },
      { phase: "C", title: "Soát thuật ngữ", skill: "N", detail: withBrief("Đối chiếu tên riêng và số liệu.") },
    ];
  }
  if (kind === "data") {
    return [
      { phase: "A", title: "Kiểm tra số liệu", skill: "T", detail: withBrief("Nguồn, đơn vị, giá trị thiếu.") },
      { phase: "B", title: "Phân tích", skill: "T", detail: withBrief("Chỉ kết luận những gì số liệu chịu được.") },
      { phase: "C", title: "Diễn giải", skill: "W", detail: withBrief("Viết lại cho Chủ tịch, không thêm số.") },
    ];
  }
  if (kind === "qa") {
    return [
      { phase: "A", title: "Lập ca kiểm thử", skill: "E", detail: withBrief("Ca chính và ca biên.") },
      { phase: "B", title: "Thực thi", skill: "E", detail: withBrief("Chạy và lưu kết quả.") },
      { phase: "C", title: "Báo cáo lỗi", skill: "L", detail: withBrief("Tách lỗi tái hiện được và cảm tính.") },
    ];
  }
  if (kind === "auto") {
    return [
      { phase: "A", title: "Vẽ luồng", skill: "M", detail: withBrief("Đầu vào, đầu ra, điểm dừng người.") },
      { phase: "B", title: "Dựng tự động hóa", skill: "M", detail: withBrief("Nối bước, chưa bật lịch thật nếu thiếu khóa.") },
      { phase: "C", title: "Chạy thử an toàn", skill: "E", detail: withBrief("Dữ liệu giả, không gửi ra ngoài.") },
    ];
  }
  return [
    { phase: "A", title: "Làm rõ việc", skill: "K", detail: withBrief("Tách mục tiêu và ràng buộc.") },
    { phase: "B", title: "Thực hiện", skill: "W", detail: withBrief("Làm phần chính.") },
    { phase: "C", title: "Soát chéo", skill: "N", detail: withBrief("Người khác kiểm tra.") },
    { phase: "D", title: "Báo cáo", skill: "O", detail: withBrief("Tóm tắt cho Chủ tịch.") },
  ];
}

export function planTasks(input: {
  roster: LiveStaff[];
  kind: MissionKind;
  brief: string;
  projectId: string;
  missionId: string;
  priority: Priority;
  now: string;
}): Task[] {
  const phases = phasesFor(input.kind, input.brief);
  const used: string[] = [];
  return phases.map((phase) => {
    const ranked = rankForSkill(input.roster, phase.skill, used);
    const editPhase = input.kind === "image" && (phase.phase === "B" || phase.phase === "C");
    const pick = ranked.find((row) => {
      if (!row.eligible) return false;
      if (!editPhase) return true;
      const person = input.roster.find((staff) => staff.id === row.id);
      return person?.fileEdit === "yes";
    }) ?? null;
    if (pick) used.push(pick.id);
    const lines = [
      input.brief.trim(),
      `Pha ${phase.phase}: ${phase.detail}`,
      pick
        ? `Phân công ${pick.name} với điểm ${pick.total} (kỹ năng ${pick.skill}, độ tin cậy ${pick.reliability}, ngân sách ${pick.budget}).`
        : "Không có ứng viên khả dụng. Việc vào hàng đợi, ngữ cảnh được giữ.",
    ];
    return {
      id: `${input.missionId}-${phase.phase}`,
      projectId: input.projectId,
      missionId: input.missionId,
      phase: phase.phase,
      title: phase.title,
      detail: phase.detail,
      skill: phase.skill,
      assigneeId: pick?.id ?? null,
      triedIds: [],
      status: pick ? "assigned" : "queued",
      progress: 0,
      context: lines.join("\n"),
      priority: input.priority,
      attempts: 0,
      history: [
        {
          at: input.now,
          text: pick
            ? `CEO phân công ${pick.name} cho pha ${phase.phase} · ${SKILL_LABEL[phase.skill]} · điểm ${pick.total}.`
            : `Pha ${phase.phase} vào hàng đợi vì không còn người khả dụng.`,
        },
      ],
      updatedAt: input.now,
    };
  });
}

export function applyHandover(roster: LiveStaff[], task: Task, reason: FailReason, now: string): Task {
  const label = REASON_LABEL[reason];
  const from = roster.find((s) => s.id === task.assigneeId);
  const fromName = from?.name ?? "chưa có người";
  const retryable = reason === "timeout" || reason === "rate_limit" || reason === "api_error";
  if (retryable && task.assigneeId && task.attempts < 1 && presenceOf(from ?? { status: "offline", budget: 0 }) !== "quota_exhausted") {
    return {
      ...task,
      attempts: task.attempts + 1,
      status: "running",
      updatedAt: now,
      history: [
        ...task.history,
        { at: now, text: `Thử lại lần ${task.attempts + 1} với ${fromName}. Lý do: ${label}. Ngữ cảnh giữ nguyên.` },
      ],
    };
  }
  const ban = task.assigneeId ? [task.assigneeId] : [];
  const tried = task.assigneeId ? [...new Set([...task.triedIds, task.assigneeId])] : task.triedIds;
  const next = rankForSkill(roster, task.skill, tried, ban).find((r) => r.eligible) ?? null;
  if (!next) {
    return {
      ...task,
      assigneeId: null,
      triedIds: tried,
      status: "queued",
      attempts: task.attempts,
      updatedAt: now,
      context: `${task.context}\n[${now}] Hàng đợi. Lý do: ${label}. Người trước: ${fromName}. Tiến độ ${task.progress}%. Không làm lại từ đầu.`,
      history: [...task.history, { at: now, text: `Không còn ứng viên sau ${fromName}. Lý do: ${label}. Đưa vào hàng đợi.` }],
    };
  }
  return {
    ...task,
    assigneeId: next.id,
    triedIds: tried,
    status: "assigned",
    attempts: 0,
    updatedAt: now,
    context: `${task.context}\n[${now}] Chuyển ${fromName} → ${next.name}. Lý do: ${label}. Tiến độ ${task.progress}%. Ngữ cảnh giữ nguyên.`,
    history: [
      ...task.history,
      { at: now, text: `Chuyển giao ${fromName} → ${next.name}. Lý do: ${label}. Điểm ${next.total}.` },
    ],
  };
}

export function topSkills(staff: LiveStaff, count = 3) {
  return (Object.entries(staff.skills) as [SkillKey, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
}
