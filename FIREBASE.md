# Cài đặt Firebase cho Minto Quiz

Thầy làm 4 bước này **một lần** trong [Firebase Console](https://console.firebase.google.com/project/minto-english), dự án `minto-english`. Mất khoảng 5 phút.

## 1. Bật đăng nhập ẩn danh

Học sinh vào chơi không cần tài khoản Google. Web tự cấp cho mỗi điện thoại một mã ẩn danh, để luật Firebase biết ai đang trả lời.

1. Mở **Authentication** → thẻ **Sign-in method**.
2. Bấm **Add new provider** → chọn **Anonymous** → bật **Enable** → **Save**.

## 2. Thêm luật Realtime Database (thêm vào, không thay cả file)

1. Mở **Realtime Database** → thẻ **Rules**.
2. Tìm dòng `"rules": {` ở đầu.
3. Đặt con trỏ ngay **sau** dòng đó, xuống dòng, rồi dán **toàn bộ** nội dung file [`firebase/dan-vao-rtdb.txt`](firebase/dan-vao-rtdb.txt). Đoạn này bắt đầu bằng `"quiz": {` và kết thúc bằng `},` (có dấu phẩy).
4. Bấm **Publish**. Nếu Console báo lỗi cú pháp, thường là do dán sai chỗ: đoạn `"quiz"` phải nằm cùng cấp với `"online"`, `"log"`, `"who"`.

Luật này làm gì:
- Chỉ tài khoản Google của thầy được tạo phòng, đổi câu hỏi, công bố đáp án và ghi điểm.
- Học sinh chỉ ghi được tên của mình lúc vào phòng, và câu trả lời của mình **một lần mỗi câu**, trong lúc câu đang mở. Hết giờ (máy chủ tính, không theo đồng hồ điện thoại) là bị chặn.
- Học sinh không đọc được câu trả lời của bạn khác. Đáp án đúng chỉ được ghi lên khi thầy công bố.
- Phòng quá 6 giờ thì không vào mới được nữa.

> **Cập nhật 28/10 (theme):** luật Realtime Database có thêm dòng `"theme"` trong phần `meta`. Thầy dán lại đoạn `"quiz"` mới từ file `firebase/dan-vao-rtdb.txt` (thay đoạn cũ). Chưa dán thì vẫn chơi được, chỉ là điện thoại học sinh giữ màu tím mặc định.

## 3. Thêm luật Firestore cho bộ câu hỏi, lịch sử kết quả và hình

1. Mở **Firestore Database** → thẻ **Rules**.
2. Tìm dòng `match /databases/{database}/documents {`.
3. Dán nội dung file [`firebase/firestore.rules.quiz.txt`](firebase/firestore.rules.quiz.txt) ngay **sau** dòng đó (bên trong cặp ngoặc). Giữ nguyên các `match` đang có.
4. Bấm **Publish**.

Chỉ tài khoản của thầy đọc và ghi được bộ câu hỏi (`quizzes`), lịch sử kết quả (`quizResults`) và hình của câu hỏi (`quizImg`). Nội dung câu hỏi và tên học sinh không nằm trong repo.

Nếu trước đây thầy đã dán phần `quizzes` rồi thì chỉ cần dán thêm các khối còn thiếu (`match /quizResults/{id}`, `match /quizImg/{id}`) ở cuối file. Chưa dán `quizImg` thì thêm hình sẽ báo lỗi quyền, các phần khác vẫn chạy.

## 4. Bật GitHub Pages cho repo KH

1. Vào repo `KH` trên GitHub → **Settings** → **Pages**.
2. **Source**: Deploy from a branch → **Branch**: `main`, thư mục `/ (root)` → **Save**.
3. Sau 1–2 phút, web chạy ở `https://mangomint1805.github.io/KH/`.

Tên miền `mangomint1805.github.io` đã nằm trong danh sách cho phép của Firebase Auth nên không cần thêm.

## Kiểm tra nhanh sau khi cài

1. Mở `https://mangomint1805.github.io/KH/admin.html`, đăng nhập Google, tải file Excel mẫu, bấm **Lưu & tạo phòng**.
2. Dùng điện thoại quét QR, nhập tên. Tên hiện lên màn host là xong.

Nếu điện thoại báo *"Phòng chơi chưa được mở (thầy cần bật đăng nhập ẩn danh)"* thì xem lại bước 1. Nếu báo *"Không vào được phòng này"* ngay từ đầu thì xem lại bước 2.
