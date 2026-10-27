# Minto Quiz

Trò chơi trắc nghiệm trực tiếp trên lớp, kiểu Kahoot, cho Minto English. Chạy trên GitHub Pages và Firebase. Không cần máy chủ riêng, không tốn phí.

- **Học sinh:** `https://mangomint1805.github.io/KH/` (hoặc quét QR trên màn chiếu). Nhập PIN và tên, không cần đăng nhập.
- **Giáo viên, soạn bộ câu hỏi:** `https://mangomint1805.github.io/KH/admin.html`
- **Giáo viên, màn chiếu:** `https://mangomint1805.github.io/KH/host.html`

Hai trang giáo viên cần đăng nhập Google bằng tài khoản giáo viên (dùng chung đăng nhập với các web khác dưới `mangomint1805.github.io`).

Cài đặt Firebase lần đầu: xem [FIREBASE.md](FIREBASE.md).

## Cách dùng

1. **Soạn bộ câu hỏi** (`admin.html`): bấm **+ Bộ mới**, kéo thả file vào. Nhận được:
   - Excel theo mẫu Kahoot (`.xlsx`): tiêu đề ở hàng 8, cột B câu hỏi, C–F đáp án, G thời gian, H đáp án đúng (`2`, hoặc `1,3` nếu nhiều đáp án).
   - CSV cùng các cột (có hoặc không có dòng tiêu đề, phân cách bằng `,` `;` hoặc tab).
   - Văn bản dạng đề (`.txt`, `.docx`, `.pdf`, hoặc dán thẳng): `1. …` rồi `(A) … (B) …` hoặc `A. …` mỗi dòng một đáp án, dòng `Answer: B` / `Đáp án: B` / `Correct answer: B`. Cũng nhận bảng đáp án ở cuối (`Answer key` rồi `1-B 2-A …`).

   File chỉ được đọc trên máy của thầy, không gửi lên đâu. Sau khi đọc, sửa trực tiếp trong bảng: nội dung, đáp án đúng, thời gian (5–240 giây), điểm (thường / gấp đôi / không tính). Câu lỗi được tô đỏ, sửa xong mới lưu được. Có thể thêm, xoá, đổi thứ tự, nhân đôi câu, nhân bản cả bộ, xuất ngược ra Excel mẫu Kahoot.
2. **Tạo phòng** (`host.html`): chọn bộ, bấm **Tạo phòng**. Màn hình hiện PIN 6 số và QR.
3. **Chơi:** bấm **Bắt đầu**. Mỗi câu: hiện câu hỏi 3 giây, mở 4 ô màu kèm đồng hồ. Hết giờ, cả lớp đã trả lời, hoặc bấm **Bỏ qua** thì khoá và công bố đáp án kèm biểu đồ. Sau đó là bảng xếp hạng top 5.
4. **Cuối game:** bục top 3, nút **Tải kết quả CSV** (tên, điểm từng câu, đúng/sai, thời gian trả lời).

Phím tắt trên màn host: **Space / Enter** sang bước tiếp, **F** toàn màn hình. Góc trái dưới có nút bật/tắt nhạc nền và âm báo (âm thanh tự tạo bằng WebAudio).

## Tính điểm

- Đúng: `round(1000 × (1 − (thời gian trả lời / thời gian giới hạn) / 2))`, tức 500–1000 điểm. Câu gấp đôi nhân 2, câu không tính điểm được 0.
- Thưởng chuỗi đúng liên tiếp: +100 mỗi câu từ câu thứ 2, tối đa +500 (tắt được khi tạo phòng).
- Thời gian trả lời tính theo giờ máy chủ Firebase, không theo đồng hồ điện thoại.

## Tình huống đặc biệt

- Học sinh tải lại trang hoặc rớt mạng: tự vào lại đúng phòng, giữ nguyên điểm.
- Thầy tải lại màn host: tự mở lại phòng đang chơi.
- Vào trễ giữa game: vẫn vào được, các câu đã qua tính 0 điểm.
- Trùng tên: tự thêm số phía sau (`An 2`).
- Dữ liệu phòng tự xoá sau 24 giờ (khi thầy mở lại trang host), hoặc bấm **Đóng phòng** cuối game.

## Cấu trúc

```
index.html          → chuyển tới play.html
play.html           màn học sinh        js/play.js
host.html           màn chiếu           js/host.js
admin.html          soạn bộ câu hỏi     js/admin.js
js/parse.js         đọc Excel / CSV / văn bản đề
js/common.js        Firebase, đồng hồ máy chủ, âm thanh, tính điểm
cap-nhat.js         mục "Có gì mới"
firebase/           luật Realtime Database và Firestore để dán vào Console
test/               kiểm thử (bộ đọc câu hỏi, chơi thử cả trận trên Firebase Emulator)
```

Dữ liệu Realtime Database, nhánh `quiz/{pin}/`: `meta`, `state`, `qpub/{câu}` (câu hỏi, không có đáp án), `key/{câu}` (đáp án, chỉ ghi khi công bố), `players/{uid}`, `answers/{câu}/{uid}`, `scores/{uid}`, `kick/{uid}`. Bộ câu hỏi lưu ở Firestore `quizzes/{id}`.

Thư viện tải từ CDN, có ghi phiên bản: Firebase 10.12.2, SheetJS 0.18.5, mammoth 1.6.0, pdf.js 3.11.174, qrcode-generator 1.4.4.

## Chạy thử trên máy

```bash
node test/parse.test.js                       # bộ đọc câu hỏi
node test/build-rules.js                      # ghép luật cho Emulator
cd test/emu && npx firebase-tools emulators:start --project minto-english
node test/server.js                           # cửa sổ khác: http://127.0.0.1:8000/KH/
node test/e2e.js "Kahoot - ….xlsx"            # chơi thử cả trận: 1 host + 4 người chơi
node test/e2e-beta.js "Kahoot - ….xlsx"       # như trên cho bản beta/ (thêm hình, tạm dừng, thanh tham gia)
node test/e2e-board.js "Kahoot - ….xlsx"      # 7 người, xem hiệu ứng bảng xếp hạng (lội ngược dòng)
```

`test/server.js` thay `/acc.js` bằng `test/mock-acc.js` để nối vào Emulator.

## Nguồn tham khảo

- [Rahoot](https://github.com/Ralex91/Rahoot) (MIT, © Ralex91): tham khảo luồng chơi và bố cục màn host / người chơi. Không chép code; phần realtime viết lại bằng Firebase.
- [supabase-community/kahoot-alternative](https://github.com/supabase-community/kahoot-alternative) (MIT): tham khảo cách chia dữ liệu game, người chơi, câu trả lời.
- Không dùng code từ ClassQuiz (MPL-2.0) hay Kuizzy (GPL-3.0).
