# GitHub Pages

Bản điều hành chạy hoàn toàn trên trình duyệt. Dữ liệu (việc, hạn mức nội bộ, hội thoại) nằm trong localStorage của máy người xem. GitHub Pages không có máy chủ, không giữ hàng đợi chung và không được đưa khóa API vào kho mã.

## Cách trang được xuất

Thư mục phát hành là bản tĩnh, `base` là `/ai-company-os/`.

```bash
PAGES_BASE=/ai-company-os/ npm run build
```

Sau đó lấy `index.html` do bản dựng trả về và các tệp trong thư mục tĩnh `assets`. Đặt chúng ở gốc nhánh `gh-pages`, kèm file `.nojekyll` để GitHub không bỏ tệp có dấu gạch dưới.

Trang dùng query `?view=` trên `index.html`, nên không cần rewrite đường dẫn. Tải lại khi đang mất mạng không được, vì chưa có service worker. Khi trang đã mở, mất mạng vẫn thao tác được.

## Bật Pages

Trong repository: Settings → Pages → Branch: `gh-pages` → folder `/` → Save.

Địa chỉ dự kiến: `https://buivanthanh227-png.github.io/ai-company-os/`

Khóa API không có trong mã nguồn. Ô khóa ở Cài đặt chỉ lưu trên trình duyệt của người dùng.
