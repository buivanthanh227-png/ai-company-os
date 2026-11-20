# Giai đoạn 2 — Gemini Router

## Phạm vi của lát cắt đầu tiên

- Backend gọi Gemini API từ server, không gọi trực tiếp từ trình duyệt.
- Nếu Gemini không khả dụng do lỗi mạng, timeout, rate limit hoặc lỗi máy chủ, gateway thử OpenRouter.
- Nếu chỉ cấu hình OpenRouter, gateway có thể chạy qua `openrouter/free`.
- API key chỉ đọc từ biến môi trường của Vercel/server.
- Server function dùng `authMiddleware`; không mở endpoint AI công khai cho khách chưa xác thực.
- Chat CEO hiện tại vẫn giữ bộ điều phối cục bộ. Lát cắt này cung cấp gateway và phép thử kết nối; việc chuyển hội thoại CEO sang AI thật là bước kế tiếp sau khi xác minh cấu hình triển khai.

## Biến môi trường Vercel

Thiết lập trong Project → Settings → Environment Variables. Không đặt các biến bí mật có tiền tố `VITE_`.

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `GEMINI_API_KEY` | Có nếu dùng Gemini chính | API key tạo từ Google AI Studio |
| `GEMINI_MODEL` | Không | Mặc định `gemini-2.5-flash` |
| `OPENROUTER_API_KEY` | Khuyến nghị | API key OpenRouter để dự phòng |
| `OPENROUTER_MODEL` | Không | Mặc định `openrouter/free` |
| `BETTER_AUTH_URL` | Khi bật đăng nhập | URL triển khai chính thức, ví dụ `https://your-domain.vercel.app` |
| `BETTER_AUTH_SECRET` | Khi bật đăng nhập | Chuỗi bí mật ngẫu nhiên, tối thiểu 32 ký tự |
| `GROK_AUTH_ISSUER` | Khi bật đăng nhập production | URL issuer của OAuth broker |
| `GROK_AUTH_CLIENT_ID` | Khi bật đăng nhập production | Client ID riêng của ứng dụng |
| `GROK_AUTH_CLIENT_SECRET` | Khi bật đăng nhập production | Client secret riêng của ứng dụng |
| `DATABASE_URL` | Khi dùng Neon/Postgres | Connection string PostgreSQL |
| `VITE_AUTH_ENABLED` | Có trong môi trường production | Đặt `true` và cấu hình thông tin OAuth broker theo `src/lib/auth/server.ts` |

Sau khi thêm biến môi trường, redeploy để serverless functions nhận cấu hình mới.

## Luồng xử lý

1. Trình duyệt gọi server function cùng phiên đăng nhập.
2. `authMiddleware` xác minh phiên; không tin user ID do client tự gửi.
3. Server kiểm tra dữ liệu đầu vào và giới hạn độ dài.
4. Gemini được gọi trước bằng header `x-goog-api-key`.
5. Khi Gemini timeout, lỗi mạng, 408, 409, 429 hoặc 5xx, gateway mới thử OpenRouter.
6. OpenRouter dùng endpoint tương thích OpenAI và model `openrouter/free` mặc định.
7. API key và nội dung lỗi thô của nhà cung cấp không được trả về client.

## Điều kiện để gọi AI thật

- Deploy ứng dụng trên Vercel bằng cấu hình server build, không phải bản GitHub Pages tĩnh.
- Bật đăng nhập và cấu hình Better Auth cùng OAuth broker (`GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET`). Nếu `DATABASE_URL` được đặt nhưng xác thực bị tắt, middleware chủ động từ chối request.
- Cấu hình ít nhất một API key ở Vercel.
- Mở Cài đặt và chạy phép thử kết nối AI. Kết quả phải trả về provider/model thật.

## Hạn chế hiện tại

- Chưa có hàng đợi bền, ghi nhận token/chi phí thực tế, giới hạn tốc độ dùng chung giữa các instance hoặc dashboard lịch sử gọi API.
- Fallback là chuyển provider khi lỗi phù hợp; không bảo đảm OpenRouter luôn có model miễn phí khả dụng.
- Free tier của OpenRouter có giới hạn riêng; model miễn phí có thể bị giới hạn bởi nhà cung cấp. Không xem đây là SLA.
- Chat CEO và việc phân công vẫn chạy logic cục bộ cho tới lát cắt tích hợp kế tiếp.
