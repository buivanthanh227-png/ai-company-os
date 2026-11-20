# Checklist Neon/Postgres trên Preview — chưa cấp phát tài nguyên

**Trạng thái:** Chỉ là checklist. KHÔNG tạo Neon project, database branch, Marketplace integration hoặc tài nguyên tính phí. Cần chủ sở hữu phê duyệt riêng trước khi thực hiện.

## A. Điều kiện trước khi thử

- [ ] PR chứa migration/persistence đã review và CI xanh.
- [ ] Xác nhận Vercel project, team, region và môi trường Preview đích.
- [ ] Xác nhận Deployment Protection/SSO vẫn bật.
- [ ] Export/backup dữ liệu PGlite cần giữ; phân biệt dữ liệu thật và dữ liệu mẫu.
- [ ] Migration forward và rollback plan đã review.
- [ ] Ước tính chi phí Neon/compute/storage/egress; nếu không rõ thì dừng.
- [ ] Preview phải dùng database branch riêng; tuyệt đối không dùng Production URL.

## B. Cấu hình Preview (chỉ sau phê duyệt)

- [ ] Tạo database branch Preview tách biệt Production.
- [ ] Đưa connection string vào Vercel integration/secret env; không đưa vào GitHub, log hoặc chat.
- [ ] Chỉ bật DATABASE_URL cho Preview.
- [ ] Giữ VITE_AUTH_ENABLED/SINGLE_USER_MODE theo chế độ xác thực đã duyệt; không tắt auth để vượt lỗi.
- [ ] Kiểm tra migration chạy lặp an toàn, không xóa dữ liệu ngoài dự kiến.
- [ ] Xác minh function kết nối đúng Preview branch.

## C. Kiểm thử nghiệm thu

- [ ] Build và migration Preview thành công.
- [ ] User A tạo/đọc/cập nhật workspace được.
- [ ] User B không đọc/ghi workspace của User A.
- [ ] Redeploy vẫn giữ dữ liệu.
- [ ] Mất kết nối DB trả lỗi an toàn, không lộ connection string.
- [ ] Kiểm tra timeout, pool limit, connection exhaustion và logs.
- [ ] So sánh với PGlite, lưu bằng chứng.
- [ ] Chỉ kết luận đồng bộ đa thiết bị hoạt động sau khi kiểm tra hai phiên trình duyệt/thiết bị riêng.

## D. Quay lại PGlite (chỉ khi rollback được duyệt)

1. Dừng ghi dữ liệu và thông báo cửa sổ bảo trì.
2. Export snapshot mới nhất từ Postgres trước khi đổi adapter.
3. Chọn rõ nguồn dữ liệu có thẩm quyền; không tự ghi đè PGlite bằng snapshot cũ.
4. Đưa Preview về cấu hình PGlite theo migration/adapter đã review; gỡ DATABASE_URL khỏi Preview khi xác nhận không còn phụ thuộc.
5. Redeploy và chạy smoke tests đọc/ghi, auth, cô lập user.
6. Đối chiếu số bản ghi/checksum/export và ghi nhận sai khác.
7. Chỉ xóa database branch sau khi chủ sở hữu duyệt và xác nhận không còn cần rollback.

## E. Dừng ngay nếu

- Có nguy cơ dùng nhầm Production URL.
- Chi phí hoặc hạn mức không xác định.
- Migration có thao tác phá hủy mà không có backup.
- Auth fail-open, rò rỉ dữ liệu giữa user hoặc SSO protection bị thay đổi.
- Không chứng minh được cách khôi phục dữ liệu.
