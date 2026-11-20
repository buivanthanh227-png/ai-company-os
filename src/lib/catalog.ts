import type { LiveStaff } from "@/lib/types";
import {
  ACCESS_LABEL,
  CAP_LABEL,
  PRESENCE_LABEL,
  RANK_LABEL,
  SKILL_KEYS,
  SKILL_LABEL,
} from "@/lib/types";
import { presenceOf, topSkills } from "@/lib/engine";
import { COST_NOTE, officialQuota, rate } from "@/lib/format";

export function catalogRows(roster: LiveStaff[]) {
  const header = [
    "Mã",
    "Tên",
    "Website",
    "Nhà phát triển",
    "Quốc gia",
    "Nhóm chuyên môn",
    "Phòng",
    "Cấp",
    "Chức vụ",
    "Chức năng",
    "Năng lực nổi bật",
    "Điểm mạnh",
    "Điểm yếu",
    "Lớp truy cập",
    "Ghi chú truy cập",
    "Hạn mức chính thức",
    "Cách đo",
    "API",
    "Tự động hóa",
    "Đọc và sửa file",
    "Nhiều file",
    "Công cụ ngoài",
    "Ngày kiểm tra",
    "Nguồn",
    "Ngân sách vận hành nội bộ (0-100, không phải token)",
    "Trạng thái",
    "Tỷ lệ thành công nội bộ",
    "Chi phí thực tế",
    ...SKILL_KEYS.map((key) => `Điểm ${SKILL_LABEL[key]}`),
  ];
  const body = roster.map((person) => [
    person.id,
    person.name,
    person.website || "Chưa xác minh",
    person.developer,
    person.country,
    person.groups.join(", "),
    person.department,
    RANK_LABEL[person.rank],
    person.title,
    person.summary,
    topSkills(person, 3)
      .map(([key, score]) => `${SKILL_LABEL[key]} ${score}`)
      .join(", "),
    person.strength,
    person.weakness,
    ACCESS_LABEL[person.access],
    person.accessNote,
    officialQuota(person.meter),
    person.meter === "account" ? "Tài khoản hoặc API" : person.meter === "local" ? "Máy cục bộ" : "Thư viện",
    CAP_LABEL[person.api],
    CAP_LABEL[person.automation],
    CAP_LABEL[person.fileEdit],
    CAP_LABEL[person.multiFile],
    CAP_LABEL[person.tools],
    person.checkedAt,
    person.source,
    String(person.budget),
    PRESENCE_LABEL[presenceOf(person)],
    rate(person.ok, person.bad),
    COST_NOTE,
    ...SKILL_KEYS.map((key) => String(person.skills[key])),
  ]);
  return [header, ...body];
}
