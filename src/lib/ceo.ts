import { staffById } from "@/data/roster";
import { detectKind, presenceOf, rankForSkill } from "@/lib/engine";
import type { LiveStaff, MissionKind, SkillKey, Task } from "@/lib/types";
import { PRESENCE_LABEL, SKILL_LABEL } from "@/lib/types";

export type Intent =
  | { type: "report" }
  | { type: "queue" }
  | { type: "help" }
  | { type: "restore" }
  | { type: "exhaust" }
  | { type: "find" }
  | { type: "mission"; title: string; brief: string; kind: MissionKind };

const SKILL_WORDS: [RegExp, SkillKey][] = [
  [/giao diện|\bui\b|frontend/, "U"],
  [/kiểm thử|test/, "E"],
  [/bảo mật|security/, "S"],
  [/hình ảnh|hình\b|logo|poster/, "H"],
  [/video|clip|phim/, "V"],
  [/giọng|âm thanh|nhạc|lồng tiếng/, "A"],
  [/dịch/, "D"],
  [/nghiên cứu|nguồn|phản biện/, "N"],
  [/dữ liệu|sql|excel/, "T"],
  [/tự động/, "M"],
  [/agent|tác nhân/, "G"],
  [/gỡ lỗi|debug|bug/, "L"],
  [/kiến trúc/, "K"],
  [/viết|nội dung|bài/, "W"],
  [/văn phòng|báo cáo/, "O"],
  [/lập trình|code|mã nguồn|sửa mã/, "P"],
];

export function interpret(text: string): Intent {
  const raw = text.trim();
  const t = raw.toLowerCase();
  if (!raw) return { type: "help" };
  if (/báo cáo|tình hình|tổng quan|sức khỏe hệ/.test(t)) return { type: "report" };
  if (/hàng đợi|việc tồn|kẹt việc/.test(t)) return { type: "queue" };
  if (/trợ giúp|\bhelp\b|làm được gì|cú pháp/.test(t)) return { type: "help" };
  if (/khôi phục|kích hoạt lại|trở lại danh sách/.test(t)) return { type: "restore" };
  if (/hết hạn|cắt hạn|ngắt hạn/.test(t)) return { type: "exhaust" };
  if (/ai nào|ai giỏi|nhân sự nào|chọn ai|ứng viên/.test(t)) return { type: "find" };
  if (/giao việc|nhiệm vụ|hãy |làm |sửa |xây |viết |dịch |tạo |thiết kế/.test(t) || raw.length > 48) {
    return { type: "mission", title: raw.slice(0, 90), brief: raw, kind: detectKind(raw) };
  }
  return { type: "help" };
}

export function mentionedStaff(roster: LiveStaff[], text: string) {
  const t = text.toLowerCase();
  return (
    roster
      .filter((person) => t.includes(person.name.toLowerCase()) || t.includes(person.id.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null
  );
}

export function skillInText(text: string): SkillKey | null {
  const t = text.toLowerCase();
  for (const [pattern, key] of SKILL_WORDS) {
    if (pattern.test(t)) return key;
  }
  return null;
}

export function helpText() {
  return [
    "Tôi nhận lệnh tiếng Việt và thực hiện trên dữ liệu của hệ thống, không gọi API ngoài.",
    "• Giao một việc bằng câu bình thường, ví dụ: Sửa ứng dụng học tiếng Trung, kẹt bài HSK 1.",
    "• «báo cáo» — tình hình nhân sự và việc.",
    "• «hàng đợi» — việc chưa có người.",
    "• «ai giỏi kiểm thử» — xếp hạng theo một kỹ năng.",
    "• «hết hạn mức Claude» — ghi hết ngân sách và chuyển việc đang mở.",
    "• «khôi phục Claude» — đưa lại vào danh sách ứng viên, không lấy lại việc cũ.",
  ].join("\n");
}

export function reportText(roster: LiveStaff[], tasks: Task[]) {
  const ready = roster.filter((person) => presenceOf(person) === "active").length;
  const low = roster.filter((person) => presenceOf(person) === "degraded").length;
  const empty = roster.filter((person) => presenceOf(person) === "quota_exhausted").length;
  const wait = roster.filter((person) => presenceOf(person) === "standby").length;
  const open = tasks.filter((task) => task.status === "queued" || task.status === "assigned" || task.status === "running" || task.status === "review");
  const queued = tasks.filter((task) => task.status === "queued");
  const done = tasks.filter((task) => task.status === "done").length;
  const lines = [
    `Nhân sự: ${ready} sẵn sàng, ${low} sắp chạm hạn mức, ${empty} hết hạn mức, ${wait} đang chờ kích hoạt.`,
    `Việc: ${open.length} còn mở, ${queued.length} trong hàng đợi, ${done} đã xong. Chi phí API thực tế: 0 vì chưa nối khóa.`,
  ];
  if (queued.length) {
    lines.push(`Hàng đợi: ${queued.map((task) => task.title).join("; ")}.`);
  }
  const risk = roster.filter((person) => presenceOf(person) === "quota_exhausted" || presenceOf(person) === "degraded").slice(0, 6);
  if (risk.length) {
    lines.push(
      `Cần lưu ý: ${risk.map((person) => `${person.name} (${PRESENCE_LABEL[presenceOf(person)]})`).join(", ")}.`,
    );
  }
  lines.push("Điểm năng lực là điểm vận hành nội bộ, không phải bảng xếp hạng chính thức của nhà cung cấp.");
  return lines.join("\n");
}

export function queueText(roster: LiveStaff[], tasks: Task[]) {
  const queued = tasks.filter((task) => task.status === "queued");
  if (!queued.length) return "Hàng đợi trống. Mọi việc đang mở đều đã có người, hoặc đã xong.";
  return queued
    .map((task) => {
      const who = staffById(roster, task.assigneeId)?.name ?? "chưa có người";
      return `• ${task.title} (${SKILL_LABEL[task.skill]}) — ${who}`;
    })
    .join("\n");
}

export function findText(roster: LiveStaff[], text: string) {
  const skill = skillInText(text);
  if (!skill) {
    return "Anh nói rõ kỹ năng cần xếp hạng, ví dụ: ai giỏi lập trình, kiểm thử, hình ảnh, nghiên cứu.";
  }
  const ranked = rankForSkill(roster, skill).slice(0, 5);
  const lines = ranked.map((row, index) => {
    const flag = row.eligible ? `điểm ${row.total}` : `loại — ${row.blocked}`;
    return `${index + 1}. ${row.name} — ${flag} (kỹ năng ${row.skill}, tin cậy ${row.reliability}, ngân sách ${row.budget})`;
  });
  return `Xếp hạng ${SKILL_LABEL[skill]}:\n${lines.join("\n")}`;
}
