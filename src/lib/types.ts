export const SKILL_KEYS = [
  "P",
  "L",
  "K",
  "N",
  "W",
  "D",
  "H",
  "V",
  "A",
  "T",
  "M",
  "G",
  "E",
  "S",
  "O",
  "U",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export const SKILL_LABEL: Record<SkillKey, string> = {
  P: "Lập trình",
  L: "Gỡ lỗi",
  K: "Kiến trúc",
  N: "Nghiên cứu",
  W: "Viết nội dung",
  D: "Dịch thuật",
  H: "Hình ảnh",
  V: "Video",
  A: "Âm thanh",
  T: "Dữ liệu",
  M: "Tự động hóa",
  G: "AI Agent",
  E: "Kiểm thử",
  S: "Bảo mật",
  O: "Văn phòng",
  U: "Giao diện",
};

export type Rank = "ceo" | "director" | "lead" | "specialist";
export type Access = "web" | "api-free" | "api-paid" | "oss" | "trial" | "mixed";
export type Cap = "yes" | "partial" | "no" | "unverified";
export type Presence = "active" | "quota_exhausted" | "degraded" | "offline" | "standby";
export type Meter = "account" | "local" | "library";
export type MissionKind =
  | "software"
  | "research"
  | "image"
  | "video"
  | "audio"
  | "writing"
  | "translate"
  | "data"
  | "qa"
  | "auto"
  | "generic";
export type TaskStatus = "queued" | "assigned" | "handed_off" | "running" | "review" | "done" | "failed";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type FailReason = "quota" | "timeout" | "rate_limit" | "api_error" | "auth_error";

export type Staff = {
  id: string;
  name: string;
  developer: string;
  country: string;
  website: string;
  groups: string[];
  department: string;
  rank: Rank;
  title: string;
  access: Access;
  accessNote: string;
  summary: string;
  strength: string;
  weakness: string;
  api: Cap;
  automation: Cap;
  fileEdit: Cap;
  multiFile: Cap;
  tools: Cap;
  skills: Record<SkillKey, number>;
  budget: number;
  meter: Meter;
  checkedAt: string;
  source: string;
};

export type StaffOver = {
  status?: Presence;
  budget?: number;
  rank?: Rank;
  title?: string;
  skills?: Partial<Record<SkillKey, number>>;
  ok?: number;
  bad?: number;
};

export type LiveStaff = Staff & {
  status: Presence;
  ok: number;
  bad: number;
};

export type Task = {
  id: string;
  projectId: string;
  missionId: string;
  phase: string;
  title: string;
  detail: string;
  skill: SkillKey;
  assigneeId: string | null;
  triedIds: string[];
  status: TaskStatus;
  progress: number;
  context: string;
  result?: string;
  priority: Priority;
  attempts: number;
  history: { at: string; text: string }[];
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  summary: string;
  createdAt: string;
  status: "active" | "paused" | "done";
};

export type Mission = {
  id: string;
  projectId: string;
  title: string;
  brief: string;
  kind: MissionKind;
  createdAt: string;
};

export type Activity = {
  id: string;
  at: string;
  text: string;
  tone: "info" | "warn" | "ok";
};

export type Proposal = {
  id: string;
  at: string;
  staffId: string;
  fromRank: Rank;
  toRank: Rank;
  title: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
};

export type ChatMessage = {
  id: string;
  at: string;
  role: "chairman" | "ceo";
  text: string;
  source?: "local" | "gemini" | "deepseek" | "groq" | "openrouter";
  model?: string;
};

export type Settings = {
  orgName: string;
  keys: Record<string, string>;
};

export const ACCESS_LABEL: Record<Access, string> = {
  web: "Website miễn phí",
  "api-free": "API miễn phí",
  "api-paid": "API trả phí",
  oss: "Mã nguồn mở / local",
  trial: "Bản dùng thử",
  mixed: "Nhiều lớp truy cập",
};

export const CAP_LABEL: Record<Cap, string> = {
  yes: "Có",
  partial: "Một phần",
  no: "Không",
  unverified: "Chưa xác minh",
};

export const RANK_LABEL: Record<Rank, string> = {
  ceo: "Giám đốc điều hành",
  director: "Giám đốc chuyên môn",
  lead: "Trưởng phòng",
  specialist: "Chuyên viên",
};

export const PRESENCE_LABEL: Record<Presence, string> = {
  active: "Sẵn sàng",
  degraded: "Sắp chạm hạn mức",
  quota_exhausted: "Hết hạn mức",
  offline: "Ngoại tuyến",
  standby: "Chờ kích hoạt",
};

export const REASON_LABEL: Record<FailReason, string> = {
  quota: "Hết hạn mức",
  timeout: "Quá thời gian chờ",
  rate_limit: "Bị giới hạn tần suất",
  api_error: "Lỗi API",
  auth_error: "Lỗi xác thực",
};

export const KIND_LABEL: Record<MissionKind, string> = {
  software: "Sửa và xây phần mềm",
  research: "Nghiên cứu",
  image: "Hình ảnh",
  video: "Video",
  audio: "Âm thanh và giọng nói",
  writing: "Viết nội dung",
  translate: "Dịch thuật",
  data: "Phân tích dữ liệu",
  qa: "Kiểm thử",
  auto: "Tự động hóa",
  generic: "Việc tổng hợp",
};

export const GROUPS = [
  "AI tổng quát",
  "Lập trình",
  "Coding Agent",
  "Nghiên cứu",
  "Thiết kế",
  "Hình ảnh",
  "Video",
  "Âm thanh",
  "Dịch thuật",
  "Viết nội dung",
  "Dữ liệu",
  "Tự động hóa",
  "AI Agent",
  "Kiểm thử",
  "Bảo mật",
  "Quản lý dự án",
  "Văn phòng",
  "Cơ sở dữ liệu",
  "Hạ tầng",
  "Giáo dục",
] as const;

export const CHECKED_AT = "2026-11-20";

export const CHIEFS: Record<string, string> = {
  "Điều hành": "chatgpt",
  "Văn phòng": "chatgpt",
  "Quản lý dự án": "chatgpt",
  "Kiến trúc": "claude",
  "Kiểm thử": "claude",
  "Bảo mật": "claude",
  "Lập trình": "deepseek",
  "Coding Agent": "deepseek",
  "Hạ tầng": "deepseek",
  "Dữ liệu": "deepseek",
  "Cơ sở dữ liệu": "deepseek",
  "Tự động hóa": "deepseek",
  "AI Agent": "deepseek",
  "Thiết kế": "gemini",
  "Hình ảnh": "gemini",
  "Video": "gemini",
  "Âm thanh": "gemini",
  "Nghiên cứu": "grok",
  "Giáo dục": "grok",
  "Tri thức": "grok",
  "Dịch thuật": "perplexity",
  "AI tổng quát": "perplexity",
};
