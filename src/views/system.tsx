import { useState } from "react";
import { PageHeader } from "@/components/bits";
import { Button, Field, Panel, TextInput } from "@/components/ui";
import { catalogRows } from "@/lib/catalog";
import { when } from "@/lib/format";
import { useOs, useRoster } from "@/lib/store";
import type { Snapshot } from "@/lib/store";
import { buildXlsx, downloadBlob, toCsv } from "@/lib/xlsx";
import { checkAiConnection } from "@/lib/ai.functions";

const DOCS = [
  {
    title: "Cái gì đang chạy thật",
    body: "Tìm nhân sự, lọc chuyên môn, lập kế hoạch, chấm điểm, phân công, chuyển giao khi hết hạn mức, thử lại khi timeout hoặc lỗi API, hàng đợi khi không còn người, lưu trạng thái trên trình duyệt và xuất Excel đều chạy trên dữ liệu của hệ thống. Tải lại trang không mất việc đã giao.",
  },
  {
    title: "Cái gì đang mô phỏng",
    body: "Bộ lập kế hoạch, chấm điểm nhân sự, phân công và chuyển giao vẫn dùng logic cục bộ. Gateway Gemini Router đã được bổ sung ở backend: Gemini là tuyến chính, OpenRouter là tuyến dự phòng; khóa chỉ đọc từ biến môi trường máy chủ. Chỉ được xem là AI chạy thật sau khi deploy backend, bật xác thực, cấu hình khóa và phép thử kết nối trả về provider/model. Ngân sách 0–100 vẫn là thước nội bộ, không phải token nhà cung cấp.",
  },
  {
    title: "Quy tắc chuyển giao",
    body: "Khi người A hết hạn mức, hệ ghi trạng thái, giữ nguyên bối cảnh và tiến độ, rồi chọn người B cùng kỹ năng còn khả dụng. Nếu B cũng không nhận được, chuyển C. Nếu không còn ai, việc vào hàng đợi chứ không bị xóa. Timeout, giới hạn tần suất và lỗi API được thử lại một lần với cùng người. Lỗi xác thực chuyển ngay. Khi A hoạt động lại, A trở thành ứng viên cho việc mới, không giật lại việc đã bàn giao.",
  },
  {
    title: "Năm lớp truy cập",
    body: "Website miễn phí, API miễn phí, API trả phí, mã nguồn mở chạy local, và bản dùng thử là năm lớp khác nhau. Một trang web cho chat miễn phí không được hiểu là API miễn phí. Hệ thống không tự mua gói.",
  },
  {
    title: "Kiến trúc giai đoạn 2",
    body: "Backend Vercel dùng Nitro/TanStack Start sẵn có. Gateway Gemini Router được đặt trong module server-only; khóa nằm trong Environment Variables, không vào trình duyệt hay git. Gemini là tuyến chính; OpenRouter free router là tuyến dự phòng khi lỗi mạng, timeout, rate limit hoặc 5xx. Server function yêu cầu authMiddleware. Hàng đợi bền, nhật ký token/chi phí và giới hạn tốc độ dùng chung giữa các instance vẫn là các phần tiếp theo. GitHub Pages chỉ phát bản giao diện tĩnh, không chạy gateway này.",
  },
  {
    title: "Triển khai",
    body: "Ứng dụng cần được deploy bằng server build lên Vercel. Sau đó thêm GEMINI_API_KEY và OPENROUTER_API_KEY trong Project Settings → Environment Variables, bật và cấu hình Better Auth, rồi redeploy. Trong Cài đặt, bấm Kiểm tra kết nối AI. GitHub Pages không thể thực thi server functions.",
  },
];

export function DocsView() {
  return (
    <div>
      <PageHeader kicker="Tài liệu" title="Kho vận hành" lede="Đọc trước khi giao việc thật. Phần mô phỏng và phần đã chạy được ghi tách." />
      <div className="flex flex-col gap-3">
        {DOCS.map((doc) => (
          <Panel key={doc.title}>
            <h2 className="text-sm font-medium">{doc.title}</h2>
            <p className="mt-2 text-sm text-muted">{doc.body}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function ActivityView() {
  const activity = useOs((state) => state.activity);
  return (
    <div>
      <PageHeader kicker="Nhật ký" title="Lịch sử hoạt động" lede="Mỗi lần phân công, chuyển giao và duyệt đều được ghi." />
      <ol className="flex flex-col gap-2">
        {activity.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-elevated p-3">
            <p className="font-mono text-xs text-faint">{when(item.at)}</p>
            <p className="mt-1 text-sm text-fg">{item.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ReportsView() {
  const roster = useRoster();
  const tasks = useOs((state) => state.tasks);
  const done = tasks.filter((task) => task.status === "done").length;
  const queued = tasks.filter((task) => task.status === "queued");
  const tired = roster.filter((person) => person.budget < 20).slice(0, 8);
  return (
    <div>
      <PageHeader kicker="Báo cáo" title="Báo cáo CEO cho Chủ tịch" lede="Sinh từ dữ liệu đang có. Không ước chi phí API vì chưa nối khóa." />
      <Panel>
        <p className="text-sm text-muted">Danh mục {roster.length} nhân sự. Việc đã đóng: {done}. Việc trong hàng đợi: {queued.length}. Chi phí thực tế: 0.</p>
        <h2 className="mt-4 text-sm font-medium">Người sắp hoặc đã hết ngân sách vận hành</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
          {tired.map((person) => (
            <li key={person.id}>{person.name} — {person.budget}/100 — {person.department}</li>
          ))}
        </ul>
        <h2 className="mt-4 text-sm font-medium">Việc chưa có người</h2>
        {queued.length === 0 ? <p className="mt-2 text-sm text-muted">Không có.</p> : null}
        <ul className="mt-2 text-sm text-muted">
          {queued.map((task) => (
            <li key={task.id}>{task.title}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-faint">Đề nghị: kích hoạt người đang chờ chỉ sau khi có nguồn xác minh. Không mua gói trả phí từ màn này.</p>
      </Panel>
    </div>
  );
}

export function SettingsView() {
  const roster = useRoster();
  const settings = useOs((state) => state.settings);
  const setOrgName = useOs((state) => state.setOrgName);
  const reset = useOs((state) => state.reset);
  const importSnapshot = useOs((state) => state.importSnapshot);
  const [armed, setArmed] = useState(false);
  const [org, setOrg] = useState(settings.orgName);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [aiError, setAiError] = useState("");

  async function runAiCheck() {
    setAiChecking(true);
    setAiStatus("");
    setAiError("");
    try {
      const result = await checkAiConnection();
      const provider = result.provider === "gemini" ? "Google Gemini" : "OpenRouter";
      setAiStatus(`Kết nối thành công: ${provider} · ${result.model}${result.fallbackUsed ? " · đã dùng tuyến dự phòng" : ""}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setAiError(
        message === "AI_NOT_CONFIGURED"
          ? "Chưa cấu hình GEMINI_API_KEY hoặc OPENROUTER_API_KEY trong Vercel."
          : message === "Unauthorized"
            ? "Cần đăng nhập hợp lệ trước khi gọi AI."
            : "Chưa kết nối được AI. Kiểm tra biến môi trường, xác thực và nhật ký Vercel.",
      );
    } finally {
      setAiChecking(false);
    }
  }

  function exportExcel() {
    downloadBlob(buildXlsx(catalogRows(roster)), "nhan-su-ai.xlsx");
  }
  function exportCsv() {
    downloadBlob(new Blob([toCsv(catalogRows(roster))], { type: "text/csv;charset=utf-8" }), "nhan-su-ai.csv");
  }
  function exportJson() {
    const state = useOs.getState();
    const safe: Snapshot = {
      staffOver: state.staffOver,
      projects: state.projects,
      missions: state.missions,
      tasks: state.tasks,
      activity: state.activity,
      messages: state.messages,
      proposals: state.proposals,
      settings: { ...state.settings, keys: {} },
    };
    downloadBlob(new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" }), "ai-company-os.json");
  }

  return (
    <div>
      <PageHeader kicker="Hệ thống" title="Cài đặt và tích hợp" lede="API key được giữ ở biến môi trường phía máy chủ Vercel, không nhập trong trình duyệt." />
      <div className="grid gap-3 xl:grid-cols-2">
        <Panel className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Tổ chức</h2>
          <Field label="Tên hiển thị">
            <TextInput value={org} onChange={(event) => setOrg(event.target.value)} />
          </Field>
          <Button onClick={() => setOrgName(org.trim() || "AI COMPANY OS")}>Lưu tên</Button>
        </Panel>
        <Panel className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Xuất dữ liệu</h2>
          <p className="text-sm text-muted">Excel mở được bằng bảng tính. File không chứa khóa.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportExcel}>Tải Excel</Button>
            <Button variant="secondary" onClick={exportCsv}>Tải CSV</Button>
            <Button variant="secondary" onClick={exportJson}>Tải JSON</Button>
          </div>
          <label className="mt-2 text-sm text-muted">
            Nhập JSON đã xuất
            <input
              className="mt-1 block w-full text-sm"
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const data = JSON.parse(await file.text()) as Snapshot;
                if (!data.tasks || !data.staffOver) return;
                importSnapshot({ ...data, settings: { ...data.settings, keys: settings.keys } });
              }}
            />
          </label>
        </Panel>
        <Panel className="flex flex-col gap-3 xl:col-span-2">
          <h2 className="text-sm font-medium">Gemini Router · kiểm tra kết nối thật</h2>
          <p className="text-sm text-muted">Ưu tiên Google Gemini. Khi Gemini gặp lỗi mạng, timeout, giới hạn tần suất hoặc lỗi máy chủ, hệ thống thử OpenRouter nếu đã cấu hình. Khóa không được lưu trong trình duyệt.</p>
          <p className="text-xs text-faint">Vercel Environment Variables: GEMINI_API_KEY, OPENROUTER_API_KEY. Có thể đặt GEMINI_MODEL và OPENROUTER_MODEL để chọn model.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runAiCheck} disabled={aiChecking}>{aiChecking ? "Đang kiểm tra..." : "Kiểm tra kết nối AI"}</Button>
            {aiStatus ? <p className="text-sm text-success">{aiStatus}</p> : null}
            {aiError ? <p className="text-sm text-danger">{aiError}</p> : null}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-sm font-medium">Khôi phục dữ liệu mẫu</h2>
          <p className="mt-2 text-sm text-muted">Xóa việc, hội thoại và điểm anh đã sửa trên máy này.</p>
          <div className="mt-3">
            {armed ? (
              <Button variant="danger" onClick={() => { reset(); setArmed(false); }}>Xác nhận khôi phục</Button>
            ) : (
              <Button variant="secondary" onClick={() => setArmed(true)}>Khôi phục dữ liệu mẫu</Button>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
