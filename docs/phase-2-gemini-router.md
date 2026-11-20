# Giai đoạn 2 — Gemini Router

## Phạm vi của lát cắt đầu tiên

- Backend gọi Gemini API từ server, không gọi trực tiếp từ trình duyệt.
- Nếu Gemini không khả dụng do lỗi mạng, timeout, rate limit hoặc lỗi máy chủ, gateway thử OpenRouter.
- Nếu chỉ cấu hình OpenRouter, gateway có thể chạy qua `openrouter/free`.
- API key chỉ đọc từ biến môi trường của Vercel/server.
- Server function dùng `authMiddleware`; không mở endpoint AI công khai cho khách chưa xác thực.
- Chat CEO đã có chế độ AI Router: Gemini trước, OpenRouter dự phòng; gửi tối đa 8 lượt hội thoại gần nhất và bản tóm tắt trạng thái dự án/nhiệm vụ. Chế độ lệnh nội bộ cũ vẫn được giữ để xem báo cáo và tạo việc theo luật cục bộ.
- Chat AI chỉ tư vấn/trả lời, chưa tự tạo task hay sửa dữ liệu. Phân công chính thức vẫn qua Trung tâm giao việc.

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

## Chat CEO — lát cắt 2.2

- Chọn **AI Router** để gọi server function; câu trả lời hiển thị nguồn Gemini hoặc OpenRouter.
- Chọn **Lệnh nội bộ** để giữ hành vi cũ: báo cáo, xem hàng đợi, tìm nhân sự, thay đổi trạng thái vận hành và tạo nhiệm vụ theo parser nội bộ.
- Nếu gateway chưa cấu hình hoặc nhà cung cấp không khả dụng, chế độ AI tự quay về bộ điều phối nội bộ và hiển thị thông báo.
- Context gửi lên AI gồm số liệu tổng hợp nhân sự/dự án/nhiệm vụ, tối đa 10 nhiệm vụ và 8 dự án gần đây; không gửi toàn bộ kho dữ liệu.
- Nội dung hội thoại và context được gửi tới nhà cung cấp AI đang xử lý. Không đưa bí mật, mật khẩu hoặc dữ liệu nhạy cảm vào chat.

## Hạn chế hiện tại

- Chưa có hàng đợi bền, ghi nhận token/chi phí thực tế, giới hạn tốc độ dùng chung giữa các instance hoặc dashboard lịch sử gọi API.
- Fallback là chuyển provider khi lỗi phù hợp; không bảo đảm OpenRouter luôn có model miễn phí khả dụng.
- Free tier của OpenRouter có giới hạn riêng; model miễn phí có thể bị giới hạn bởi nhà cung cấp. Không xem đây là SLA.
- AI Chat chưa có quyền gọi công cụ để tự tạo nhiệm vụ, thay đổi trạng thái hoặc commit mã; các hành động đó vẫn cần quy trình riêng.

## Giai đoạn 3 — dữ liệu bền vững và chế độ cá nhân

- Bảng `app_state` lưu snapshot workspace theo user id trong Postgres.
- Trình duyệt hydrate cache trước, sau đó lấy snapshot máy chủ; mọi thay đổi tiếp theo được debounce và đồng bộ về máy chủ.
- API lưu/đọc snapshot dùng `authMiddleware`, giới hạn cấu trúc dữ liệu và kích thước tối đa 1 MB.
- Với bản cá nhân một chủ sở hữu, có thể dùng Vercel Deployment Protection (SSO) làm cổng truy cập: đặt `VITE_AUTH_ENABLED=false`, `SINGLE_USER_MODE=true`; chỉ cho phép trên Vercel production/preview. Không gắn custom domain không có bảo vệ SSO.
- Nếu cần nhiều người dùng, không bật single-owner mode; cấu hình Better Auth + OAuth broker riêng cho ứng dụng.

### Kết nối Neon

1. Trong Vercel, mở Marketplace → Neon và cài resource cho project `ai-company-os`.
2. Chọn region gần function region `iad1` (US East / AWS us-east-1 nếu được cung cấp).
3. Kết nối ít nhất môi trường Production; bật Preview nếu muốn thử PR với database branch riêng.
4. Neon integration phải tự thêm `DATABASE_URL` vào project. Không sao chép connection string vào Git hoặc chat.
5. Sau khi kết nối, redeploy để `npm run build` chạy migration `migrations/0001_app_state.sql`.

### Biến môi trường cho bản cá nhân

| Biến | Giá trị |
|---|---|
| `VITE_AUTH_ENABLED` | `false` |
| `SINGLE_USER_MODE` | `true` |
| `DATABASE_URL` | Do Neon integration tự cấp |
| `GEMINI_API_KEY` | Khóa Google AI Studio |
| `OPENROUTER_API_KEY` | Khóa OpenRouter |

Giữ Vercel Deployment Protection ở trạng thái SSO enabled cho các URL `.vercel.app`; không mở website qua custom domain không được bảo vệ.
