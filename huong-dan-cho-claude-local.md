# Việc còn lại cho Minto Quiz (giao cho Claude Code trên máy)

Người đặt việc: Minto (GitHub `mangomint1805`). Đọc hết trước khi làm.

## Bối cảnh

Game trắc nghiệm kiểu Kahoot **Minto Quiz** đã viết xong và đã kiểm thử trên Firebase Emulator, nằm trong repo **`mangomint1805/KH`**, nhánh `claude/admiring-goldberg-4frcv9`. Các file chính:

- `play.html` (học sinh), `host.html` (màn chiếu), `admin.html` (soạn bộ câu hỏi)
- `FIREBASE.md`: các bước cài trong Firebase Console
- `firebase/dan-vao-rtdb.txt`: đoạn luật Realtime Database để dán (sinh từ `firebase/database.rules.quiz.json` bằng `node test/build-rules.js`)
- `firebase/firestore.rules.quiz.txt`: đoạn luật Firestore cho `quizzes/{id}`

Phiên làm trên cloud không có quyền ghi vào repo `mangomint1805.github.io` và không vào được Firebase Console, nên còn mấy việc dưới đây.

## 1. Repo `KH`: gộp vào `main` và bật Pages

1. Xem lại nhánh `claude/admiring-goldberg-4frcv9`. Nếu ổn thì gộp vào `main` (mở PR hoặc merge thẳng, tuỳ thầy chọn).
2. Nhắc thầy bật GitHub Pages: repo `KH` → Settings → Pages → Deploy from a branch → `main` / `(root)`.
3. Sau khi Pages chạy, mở thử `https://mangomint1805.github.io/KH/`, `…/KH/admin.html`, `…/KH/host.html`. Console không được có lỗi, trừ lỗi quyền Firebase nếu thầy chưa dán luật.

## 2. Repo `mangomint1805.github.io`: thêm link cho giáo viên

Trang host và trang soạn câu hỏi **không được hiện cho học sinh**. Trang chủ `index.html` hiện không có mục riêng cho giáo viên. Link giáo viên đang nằm ở hai chỗ, thêm Minto Quiz vào đúng hai chỗ đó:

- **`acc.js`**, hàm `render()`: dòng `isGV(a.email) ? '<a href="/gv.html">🧑‍🏫 Bảng theo dõi lớp</a>' : ''`. Thêm link `/KH/admin.html` (chữ `🎮 Minto Quiz`) ngay sau, cũng nằm trong điều kiện `isGV`. Khối `.ma-l` là một hàng flex. Nếu thêm vào mà chật quá trên điện thoại thì cho xuống dòng (`flex-wrap`) hoặc gộp gọn lại. Chụp màn hình bảng ⚙ ở bề ngang 375px để kiểm tra.
- **`gv.html`**, thanh điều hướng (khoảng dòng 114, chỗ có `🏠 Trang chủ`, `TOEIC`, `IELTS`): thêm link `KH/admin.html` với chữ `🎮 Minto Quiz`.

Lưu ý:
- `acc.js` đang được nạp với `?v=7` ở nhiều trang, kể cả 3 trang trong repo `KH`. Sửa `acc.js` thì tăng số phiên bản ở mọi chỗ nạp nó (tìm `acc.js?v=` trong cả hai repo) để trình duyệt không dùng bản cũ.
- Không ghi email giáo viên ra code. `acc.js` đang so mã băm qua `isGV`, giữ nguyên cách đó.
- Không ghi "Ms Hoa", tên lớp hay tên học viên trên trang công khai.

## 3. README và "Có gì mới" ở repo `mangomint1805.github.io`

- README: thêm một dòng giới thiệu Minto Quiz kèm link `https://mangomint1805.github.io/KH/`. Ở mục **Luật bảo mật Firebase**, ghi thêm: Realtime Database có thêm nhánh `quiz/` (luật nằm ở repo `KH`, file `firebase/database.rules.quiz.json`), Firestore có thêm `quizzes/` (chỉ thầy đọc/ghi). Không viết lịch sử thay đổi trong README.
- "Có gì mới": xem các web khác (`toeic/`, `cam/`, `summary-new/`) làm mục này thế nào (`cap-nhat.js`). Nếu trang chủ hoặc `gv.html` có cơ chế tương tự thì thêm một mục ngắn: *"Có Minto Quiz: chơi trắc nghiệm trực tiếp trên lớp kiểu Kahoot, miễn phí."* Nếu không có thì bỏ qua, vì repo `KH` đã có `cap-nhat.js` riêng.
- Đẩy code xong thì xem kết quả workflow `kiem-tra.yml` (nó mở từng trang `.html` bằng Playwright). Nếu đỏ thì sửa cho xanh.

## 4. Luật Firebase: giúp thầy ghép cho đúng, không tự Publish

Agent không vào được Console, thầy sẽ tự dán. Các bước đã ghi trong `KH/FIREBASE.md`. Có thể giúp thêm như sau:

- **Realtime Database:** nhờ thầy copy luật **đang chạy** trong Console dán vào chat. Ghép đoạn `firebase/dan-vao-rtdb.txt` vào ngay sau `"rules": {`, cùng cấp với `online`, `log`, `who`. Kiểm tra JSON hợp lệ (đếm ngoặc, dấu phẩy), rồi đưa lại **bản hoàn chỉnh** để thầy dán đè trong Console. Không được bỏ hay sửa phần đang có. Nếu luật hiện tại có `.read` hoặc `.write` ở gốc thì báo thầy trước, vì nó có thể mở rộng quyền cho nhánh `quiz/`.
- **Firestore:** file `firestore.rules` trong repo chỉ là bản tham khảo cũ, **không Publish đè**. Đoạn `quizzes` chỉ cần dán thêm vào bên trong `match /databases/{database}/documents { … }` của luật đang chạy. Luật đang chạy có hàm `gv()`, nên có thể rút gọn thành `allow read, write: if gv();`, kết quả như nhau.
- **Anonymous Auth:** nhắc thầy bật ở Authentication → Sign-in method → Anonymous. Không bật thì học sinh không vào phòng được (điện thoại báo *"Phòng chơi chưa được mở"*).

## 5. Thử thật trên lớp (sau khi làm xong 1 đến 4)

1. Thầy mở `…/KH/admin.html`, đăng nhập Google, tải file `Kahoot - Unit 1 Lesson 1 Practice (TOA117110).xlsx` → 12 câu, đáp án 1B 2A 3D 4B 5C 6D 7D 8C 9A 10C 11B 12B → **Lưu & tạo phòng**.
2. Dùng 1–2 điện thoại quét QR, nhập tên, chơi vài câu. Tải CSV ở cuối game.
3. Nếu lỗi: mở DevTools ở trang host. `PERMISSION_DENIED` thì xem lại luật ở bước 4. `auth/admin-restricted-operation` trên điện thoại thì Anonymous chưa bật.

## Báo lại cho thầy

- Đã gộp và bật Pages chưa, link chạy được chưa.
- Đã thêm link giáo viên ở đâu (kèm ảnh chụp bảng ⚙ trên điện thoại).
- Bản luật RTDB hoàn chỉnh (nếu thầy đã đưa luật đang chạy).
- Kết quả workflow kiểm tra của cả hai repo.
