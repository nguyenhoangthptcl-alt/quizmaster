# AI QuizMaster - Hướng dẫn cài đặt (khoảng 10 phút)

## Cấu trúc thư mục (đưa nguyên cả thư mục lên GitHub)
```
index.html          <- TRANG HỌC SINH (gửi link này cho học sinh)
giaovien.html       <- TRANG GIÁO VIÊN + ADMIN (đăng ký / đăng nhập)
config.js           <- dán thông số Firebase vào đây (làm 1 lần)
common.js, sgk.js, giaovien.js
firebase-rules.json <- luật bảo mật, dán vào Firebase (Bước 1.4)
sgk/                <- SGK (.md), tóm tắt bổ sung, câu hỏi mẫu, index.json
assets/hero.jpg
```

## Bước 1 - Tạo Firebase (miễn phí)
1. Vào https://console.firebase.google.com -> **Add project** (tắt Google Analytics cũng được).
2. **Project settings (bánh răng) -> Your apps -> biểu tượng `</>` (Web)** -> đặt tên -> Register. Chép các giá trị `apiKey, authDomain, databaseURL, projectId, appId` dán vào `config.js`.
   - Nếu chưa thấy `databaseURL`: làm bước 1.4 trước rồi quay lại chép (dạng `https://xxx-default-rtdb.<vùng>.firebasedatabase.app`).
3. **Build -> Authentication -> Get started -> Sign-in method**, bật **2 mục**:
   - **Email/Password** (cho tài khoản giáo viên)
   - **Anonymous** (cho học sinh vào phòng không cần tài khoản)
4. **Build -> Realtime Database -> Create database** (chọn Singapore, "locked mode") -> tab **Rules** -> xóa hết, dán toàn bộ nội dung file `firebase-rules.json` -> **Publish**.
5. **Authentication -> Settings -> Authorized domains -> Add domain**: thêm `ten-github.github.io`.

## Bước 2 - Đưa lên GitHub Pages
Tạo repository (Public) -> kéo thả TOÀN BỘ file và thư mục (kể cả `sgk/`, `assets/`) -> Commit -> Settings -> Pages -> Branch `main` / root -> Save.
- Link học sinh: `https://ten-github.github.io/ten-repo/`
- Link giáo viên: `https://ten-github.github.io/ten-repo/giaovien.html`

## Bước 3 - Tài khoản
- **Người đăng ký đầu tiên tự động là Admin** -> thầy hãy đăng ký ngay tại `giaovien.html`.
- Giáo viên khác đăng ký -> Admin vào tab **Quản lý tài khoản** để *Duyệt / Khóa / Đặt lại mật khẩu / Nâng quyền / Xóa*. (Có công tắc "đăng ký tự duyệt" nếu muốn mở rộng.)
- Admin cũng có thể tạo sẵn tài khoản cho giáo viên và xem/xóa các phòng thi còn tồn.

## Bước 4 - Gemini API key
Đăng nhập -> **Cài đặt** -> dán key từ https://aistudio.google.com -> **Kiểm tra kết nối AI**. Key lưu trong tài khoản (chỉ chủ tài khoản đọc được).

## Cách dùng
1. **Tạo đề**: chọn Môn - Lớp - Sách, rồi chọn phạm vi:
   - **Theo bài**: AI chỉ nhận nội dung đúng bài đó.
   - **Theo chương**: nội dung các bài trong chương, số câu chia đều cho các bài.
   - **Nhiều bài tự chọn / Cả cuốn / Tự nhập nội dung**.
   - Khung "Nội dung AI được phép dùng" cho thấy chính xác AI được đọc gì; có thể dán thêm nội dung bài học.
   - Mỗi câu gắn nhãn "Bài N"; câu AI lỡ ra ngoài phạm vi sẽ bị loại tự động.
2. **Mở phòng thi** -> hiện mã 6 số, mã QR, link kèm mã. Học sinh vào `index.html`, nhập mã + tên.
3. Máy thầy là máy điều khiển: giữ trang mở trong suốt buổi thi. Cuối buổi tải bảng điểm CSV.

## Thêm môn khác (Toán, Lý, Hóa, ...)
Tab **Tài liệu SGK -> Thêm tài liệu**: chọn môn, lớp, tải file `.md/.txt` (hoặc dán). File cần có dạng:
```
### CHƯƠNG I: Tên chương
- **Bài 1: Tên bài**
  - nội dung kiến thức...
```
(Có nút tải file mẫu.) Tài liệu thêm xong dùng chung cho các giáo viên, và chức năng chọn Bài/Chương hoạt động giống Công nghệ. Muốn có sẵn trong repo: bỏ file vào `sgk/` và khai báo thêm 1 dòng trong `sgk/index.json`.

## Lưu ý
- Một số bài trong file .md Công nghệ chỉ có tiêu đề hoặc rất ít ý (ví dụ Bài 10, 11, 14, 16, 21 của lớp 11). Hệ thống sẽ cảnh báo; thầy nên dán thêm nội dung vào khung kiến thức để câu hỏi tốt hơn.
- "Lấy câu mẫu" chỉ có số ít câu theo bài (kho có sẵn). Bài nào chưa có thì cần API key để AI ra đề.
- Quên mật khẩu: Admin dùng "Đặt lại MK" (hệ thống không gửi email).
- Tên mô hình Gemini thay đổi thường xuyên; nếu báo lỗi, đổi tên ở Cài đặt (xem danh sách tại aistudio.google.com).
