# AI COMPANY OS

Trung tâm điều hành nhiều công cụ trí tuệ nhân tạo. Giao diện hiện có danh mục AI, lập kế hoạch, phân công theo kỹ năng và chuyển giao. Khi Neon/Postgres được kết nối, trạng thái workspace được đồng bộ giữa các thiết bị; trình duyệt vẫn giữ một bản cache cục bộ.

Danh mục kiểm tra ngày 2026-11-20. Hạn mức token công khai mà phiên kiểm tra không xác minh được thì ghi «chưa xác minh», không bịa số. Dấu trên thẻ nhân sự là ký tự nội bộ, không phải logo thương hiệu. Website chính thức nằm trong hồ sơ.

## Đang chạy thật

- Toàn bộ menu, tìm kiếm, lọc, hồ sơ, sơ đồ tổ chức, bảng điều hành bên phải.
- Bộ chấm điểm và phân công cục bộ; chuyển giao mô phỏng khi hết hạn mức, timeout, rate limit, lỗi API hoặc lỗi xác thực.
- Cache trên trình duyệt, xuất Excel, CSV và JSON.
- Snapshot workspace được đồng bộ lên Postgres khi Neon được kết nối và migration hoàn tất.
- Backend gateway Gemini Router đã được bổ sung trong Giai đoạn 2: Gemini chính, OpenRouter dự phòng; server functions yêu cầu xác thực.

## Chưa được xác minh trên môi trường production

- Cần kết nối Neon/Postgres và chạy migration `app_state` để bật đồng bộ dữ liệu nhiều thiết bị.
- Chưa có bằng chứng Vercel production đã được cấu hình biến môi trường và gọi thành công Gemini/OpenRouter.
- Chat CEO đã có chế độ AI Router gọi Gemini/OpenRouter qua server; chế độ lệnh nội bộ cũ vẫn còn. AI Chat chưa tự phân công hoặc thay đổi dữ liệu.
- Chưa có hàng đợi bền, số liệu token/chi phí thực tế hoặc rate limit dùng chung giữa các serverless instances.
- Thanh ngân sách 0–100 vẫn là thước nội bộ, không phải token nhà cung cấp.
- Hạn mức chính thức để «chưa xác minh» nếu không có số công khai đã kiểm ngày 2026-11-20.

## Cách dùng

1. Mở trang. Menu bên trái là các phòng. Trên điện thoại, bấm nút menu.
2. Giao việc ở **Trung tâm giao việc** hoặc **Chat với CEO**.
3. Theo dõi và giả lập sự cố ở **Theo dõi nhiệm vụ**: hết hạn mức, quá thời gian, giới hạn tần suất, lỗi API, lỗi xác thực.
4. Xuất hồ sơ ở **Cài đặt**: Excel, CSV, JSON. File không chứa khóa.
5. Dữ liệu lưu trên trình duyệt. Nút khôi phục dữ liệu mẫu xóa việc đã tạo trên máy đó.

## Cài đặt mã nguồn

Cần Node.js 22. Không có khóa API nào trong kho.

```bash
npm install
npm run dev
```

`npm run build` tạo bản máy chủ. Bản GitHub Pages dùng biến `PAGES_BASE`, xem [docs/github-pages.md](docs/github-pages.md).

Không dán khóa thật vào mã nguồn hoặc trình duyệt. Giai đoạn 2 đọc khóa từ Vercel Environment Variables; xem [docs/phase-2-gemini-router.md](docs/phase-2-gemini-router.md).

## Giai đoạn 2

Xem mục «Kiến trúc giai đoạn 2» trong Kho tài liệu của ứng dụng. Tóm tắt: cổng máy chủ giữ khóa, hàng đợi bền, mỗi nhà cung cấp là một đầu nối. Không khóa lõi vào một framework. GitHub Pages chỉ phù hợp giao diện tĩnh; điều phối thật cần máy chủ.

