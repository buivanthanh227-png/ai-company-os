import type { LiveStaff, Meter } from "@/lib/types";

export function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function rate(ok: number, bad: number) {
  const total = ok + bad;
  if (!total) return "Chưa có việc đóng";
  return `${Math.round((100 * ok) / total)}% (${ok}/${total})`;
}

export function officialQuota(meter: Meter) {
  if (meter === "local") return "Không áp hạn mức token cloud. Trần là phần cứng máy chạy.";
  if (meter === "library") return "Không có hạn mức tài khoản. Đây là thư viện hoặc khung phần mềm.";
  return "Chưa xác minh hạn mức token, credit hoặc số tác vụ công khai.";
}

export function quotaLabel(person: Pick<LiveStaff, "meter">) {
  return officialQuota(person.meter);
}

export const COST_NOTE = "0 — chưa nối API, không phát sinh chi phí.";
