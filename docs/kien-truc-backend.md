# Kiến trúc backend — giai đoạn 2

Giai đoạn 1 đã có luật điều phối và dữ liệu nhân sự trên giao diện. Giai đoạn 2 đưa luật đó ra máy chủ.

## Nguyên tắc

- Không đưa khóa API vào JavaScript, vào git, hay vào GitHub Pages.
- Không khóa lõi vào một nhà cung cấp hoặc một framework tác nhân.
- Việc đang dở phải sống lâu hơn một phiên trình duyệt.

## Các phần

1. Cổng API. Nhận lệnh của Chủ tịch, trả trạng thái việc.
2. Kho bí mật. Đọc khóa khi gọi nhà cung cấp, ghi nhật ký không kèm khóa.
3. Hàng đợi. SQLite lúc đầu, PostgreSQL khi có nhiều worker. Mỗi việc giữ bối cảnh, tiến độ, người đã đi qua, số lần thử, lý do lỗi.
4. Đầu nối. Cùng một hợp đồng: gửi việc, nhận kết quả, báo hết hạn, timeout, rate limit, lỗi xác thực. OpenAI, Anthropic, Google, xAI, Groq, OpenRouter và công cụ local đều là đầu nối.
5. Bộ chọn người. Giữ công thức hiện tại: kỹ năng riêng, độ tin cậy, ngân sách, phạt nếu đã làm pha trước.
6. Worker. Có thể gọi LangGraph, CrewAI hoặc n8n bên dưới. Lõi vẫn chạy nếu bỏ một trong các công cụ đó.

## Không làm

- Không tự mua gói.
- Không coi website miễn phí là API miễn phí.
- Không bịa hạn mức token khi nhà cung cấp không công bố.
