# Đặc tả kỹ thuật: orchestrateTask

**Trạng thái:** Đã triển khai một phần lớp phân công và chuyển giao thủ công trong Chat CEO. Worker gọi AI ngoài, hàng đợi bền vững, thực thi đa provider tự động và Critic loop vẫn chưa triển khai.  
**Phạm vi:** Giai đoạn 2; backend-first, provider-agnostic, ưu tiên model miễn phí.  
**Nguyên tắc:** Không tự thực thi hành động bên ngoài, không gọi model trả phí, không ghi đè dữ liệu gốc khi chưa được duyệt.

## 1. Mục tiêu và ranh giới

### Trạng thái runtime hiện tại

- Chat CEO tự tạo mission khi nhận yêu cầu có tính chất công việc và lập các pha theo loại việc.
- Task có thể được phân công cho nhân sự theo điểm kỹ năng, trạng thái và hồ sơ năng lực; Grok/Cursor đang không khả dụng bị loại khỏi phân công mới.
- Với AI dùng qua website, người dùng có thể sao chép brief, mở website của AI được giao, xác nhận đã chuyển và gửi kết quả về để CEO soát.
- Ảnh/tệp gốc chưa tự chuyển sang website AI bên ngoài; Chủ tịch phải đính kèm lại thủ công.
- Trạng thái handed_off chỉ có nghĩa người dùng xác nhận đã gửi yêu cầu, không chứng minh AI bên ngoài đã bắt đầu hoặc hoàn thành.
- API Gemini/OpenRouter hiện vẫn là chat trả lời; chưa có công cụ thực thi chỉnh sửa ảnh hay gọi Claude/DeepSeek/Dola qua API trong luồng nhiệm vụ.


orchestrateTask nhận yêu cầu đã được người dùng chấp thuận, tách thành task có cấu trúc, chọn vai trò/model, chạy theo dependency, kiểm tra chất lượng và tổng hợp báo cáo.

Phân biệt trạng thái:
- planned: mới lập kế hoạch/phân công nội bộ.
- needs_approval: chờ người dùng duyệt.
- queued: đủ điều kiện vào hàng đợi.
- dispatched: request đã gửi tới provider.
- running: request thực sự đang xử lý.
- succeeded: output hợp lệ đã lưu.
- review_required: cần người xem xét.
- failed/cancelled/retry_wait: lỗi, đã hủy hoặc chờ retry.

Gán task cho một vai trò AI nội bộ không đồng nghĩa AI bên ngoài đã thực thi. Không hiển thị “Đang chạy” nếu chưa có request thực.

## 2. Hợp đồng dữ liệu

```ts
type TaskStatus =
  | "planned" | "needs_approval" | "queued" | "dispatched"
  | "running" | "succeeded" | "failed" | "cancelled"
  | "retry_wait" | "review_required";

type TaskRole =
  | "researcher" | "planner" | "implementer" | "critic" | "synthesizer";

type OrchestratedTask = {
  schemaVersion: 1;
  id: string;                 // UUID server tạo
  runId: string;
  parentTaskId: string | null;
  title: string;              // <= 160 ký tự
  objective: string;          // <= 4.000 ký tự
  role: TaskRole;
  provider: "gemini" | "openrouter" | "manual";
  model: string | null;
  dependsOn: string[];
  status: TaskStatus;
  priority: "low" | "normal" | "high";
  attempt: number;
  maxAttempts: number;        // mặc định 2, hard cap 3
  budget: {
    maxInputTokens: number;
    maxOutputTokens: number;
    maxTotalTokens: number;
    estimatedCostUsd: number | null;
    approvedCostUsd: number | null;
  };
  approval: {
    required: boolean;
    approvedAt: string | null;
    approvedBy: string | null;
  };
  input: { summary: string; artifactRefs: string[] };
  output: { summary: string; artifactRefs: string[] } | null;
  error: { code: string; safeMessage: string } | null;
  createdAt: string;
  updatedAt: string;
};
```

Không lưu API key, bearer token, session cookie hoặc raw provider headers trong task, log hay artifact.

## 3. Kết quả phân rã và kiểm tra schema

Planner phải trả JSON gồm schema version, mục tiêu tổng, danh sách task, dependency và tiêu chí hoàn tất. Server xác thực bằng schema runtime (Zod), giới hạn mặc định 8 task, tối đa 20 task, độ dài trường và tổng payload.

Từ chối kế hoạch nếu JSON sai schema, ID trùng, dependency không tồn tại/vòng lặp, task tự phụ thuộc, vượt ngân sách hoặc yêu cầu quyền/chi phí chưa được duyệt. Artifact/context là dữ liệu không tin cậy, không phải system instruction.

## 4. Điều phối và trạng thái

1. Tạo run ở planned và lưu kế hoạch bất biến.
2. Nếu có hành động bên ngoài hoặc chi phí, chuyển needs_approval.
3. Chỉ enqueue task khi mọi dependency succeeded.
4. Worker claim task bằng lease/CAS; cập nhật trạng thái có version để chống ghi đè đồng thời.
5. Gửi provider request với timeout tổng/từng attempt; retry lỗi tạm thời (network, timeout, 408, 429, 5xx), tối đa 2 lần mặc định.
6. Lưu output đã validate, provider/model, duration và token count nếu provider trả về.
7. Task lỗi chỉ block task phụ thuộc; task độc lập có thể tiếp tục nếu còn ngân sách.
8. Run kết thúc khi mọi task ở trạng thái terminal; synthesizer tổng hợp báo cáo có bằng chứng.

Idempotency key: `runId:taskId:attempt`. Refresh trình duyệt không được gửi lại request.

## 5. Chọn model và ngân sách

- Mặc định dùng provider/model miễn phí đã cấu hình và kiểm tra.
- Chọn theo vai trò, structured output, context window và độ tin cậy.
- Model miễn phí không khả dụng thì chuyển needs_approval hoặc failed; không tự chuyển sang model trả phí.
- Ước tính chi phí trước khi gọi nếu có bảng giá đáng tin cậy; nếu không rõ ghi unknown, không bịa số.
- Dừng trước khi gọi nếu vượt approvedCostUsd, thiếu phê duyệt hoặc không xác định điều kiện giá model trả phí.
- Ghi token thực tế khi provider trả metadata; không suy ra chi phí nếu thiếu đơn giá áp dụng.

## 6. Critic và vòng sửa

Critic trả JSON: verdict (pass/revise/fail), issues và requiredChanges. Critic nhận yêu cầu gốc, tiêu chí nghiệm thu, output và nguồn tham chiếu.
- Tối đa 1 vòng sửa tự động mặc định.
- Critic không sửa artifact gốc; chỉ tạo revision mới.
- Bất đồng provider hoặc thiếu nguồn đáng tin cậy thì review_required.
- Không chạy critic nếu vượt ngân sách hoặc phải gọi model trả phí chưa duyệt.

## 7. Nhật ký và báo cáo

Event append-only: run.created, plan.validated, approval.requested/granted, task.queued, provider.requested/responded, task.reviewed/completed/failed, run.completed.

Lưu timestamp UTC, IDs, provider/model, attempt, duration, status, token count nếu có, safe error code và artifact refs. Không lưu prompt nhạy cảm đầy đủ.

Báo cáo cuối chia: hoàn thành có bằng chứng; chưa hoàn thành/bị chặn; critic và bất đồng; provider/model thực tế; số lượt gọi; token/chi phí thực tế hoặc “chưa đo được”; phê duyệt còn thiếu.

## 8. Phê duyệt, hủy và rollback

Phải xin duyệt trước model/provider trả phí, gửi email/đăng bài/thanh toán, thay đổi tài khoản/quyền, ghi hệ thống bên ngoài hoặc Production, tạo tài nguyên có thể tính phí.

Hủy run ngăn task queued chưa gửi; task đang gọi provider được đánh dấu cancel-requested và kết thúc khi request dừng/timeout. Không tuyên bố hủy thành công nếu tác vụ bên ngoài đã được thực hiện.

Rollback tạo revision mới hoặc khôi phục snapshot trước đó, không xóa lịch sử. Với mã nguồn chỉ tạo branch/PR; không merge Production khi chưa được duyệt. Với dữ liệu cần snapshot và version check.

## 9. Bảo mật và tiêu chí nghiệm thu

- Provider keys chỉ ở server; mọi thao tác run phải xác thực và scope theo userId.
- Kiểm tra quyền riêng cho approval/cancel/retry.
- Giới hạn concurrency, payload, thời gian, số task, retry và ngân sách.
- Redact secrets, prompt injection defense, không chia sẻ dữ liệu sang provider mới nếu chưa được phép.
- Unit tests: schema, DAG, state transitions, idempotency, retry, cancellation, approval/budget gate, redaction.
- Integration tests provider mock, không dùng secret thật/model trả phí.
- Kiểm tra cô lập dữ liệu giữa hai user.
- UI phân biệt planned/dispatched/running/succeeded/failed/needs_approval.
- Feature flag tắt mặc định; chỉ bật sau QA Preview và phê duyệt chủ sở hữu.
