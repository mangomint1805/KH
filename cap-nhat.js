/* Minto Quiz — "Có gì mới". Thêm mục mới lên ĐẦU danh sách; bản mới nhất tự hiện một lần trên trang giáo viên. */
(function () {
  'use strict';
  var NEWS = [
    { v: '1.9.1', d: '2026-10-28', items: [
      'Màn chiếu thấp (1024×768, 1366×768 — loại máy chiếu hay gặp ở lớp): câu hỏi dài không còn đẩy 4 ô đáp án tràn xuống dưới. Chữ câu hỏi, ô đáp án, đồng hồ và biểu đồ kết quả tự co theo chiều cao màn hình.',
      'Câu hỏi dài (trên 100 ký tự) tự dùng cỡ chữ nhỏ hơn một chút, cả màn chiếu và điện thoại.',
      'Phòng chờ đông (trên 14 bạn): tên nhỏ lại, mã QR thu bớt để còn chỗ; quá đông thì danh sách tên tự cuộn, không đẩy nút Bắt đầu ra khỏi màn hình.',
      'Điện thoại màn hình nhỏ: 4 ô đáp án thấp lại một chút cho vừa, không phải cuộn.'
    ] },
    { v: '1.9', d: '2026-10-28', items: [
      'Theme Băng hoại dùng bài nhạc nền "Gion", theme Thiên thần dùng bài "Approval desire" (thay cho nhạc tự tạo). Hai theme còn lại giữ nhạc cũ.',
      'Bài nhạc chạy liền mạch từ phòng chờ sang lúc trả lời, không bị phát lại từ đầu mỗi câu; 5 giây cuối nhạc nhanh lên một chút. Bảng xếp hạng vẫn tạm tắt nhạc như cũ.',
      'Thanh âm lượng nhạc nền và nút tắt nhạc dùng được cho cả hai bài này.'
    ] },
    { v: '1.8.1', d: '2026-10-28', items: [
      'Tiếng báo khi có bạn chọn đáp án to và rõ hơn hẳn (trước bị nhạc nền che mất). Mỗi lần có bạn trả lời, nhạc nền tự nhỏ lại một chút cho tiếng báo nghe rõ.'
    ] },
    { v: '1.8', d: '2026-10-28', items: [
      'Mỗi theme có nhạc nền và âm báo riêng: Tím Kahoot giữ như cũ; Hành baro kiểu nhạc idol sôi động, tiếng lấp lánh; Thiên thần kiểu hộp nhạc, tiếng chuông và bong bóng dễ thương; Băng hoại kiểu synthwave, tiếng laser điện tử. Đổi theme giữa chừng là nhạc đổi theo.',
      'Bấm 🎵 ở góc trái dưới màn chiếu để mở bảng âm thanh: bật/tắt và kéo chỉnh âm lượng nhạc nền, âm báo riêng từng cái. Kéo thanh âm báo sẽ phát thử một tiếng. Máy nhớ mức âm lượng cho lần sau.',
      'Điện thoại học sinh: câu hỏi chữ to hơn, căn giữa; chữ trên ô đáp án cũng to hơn.',
      'Chỗ trống ------- trong câu không còn bị ngắt làm hai dòng (cả màn chiếu và điện thoại).'
    ] },
    { v: '1.7.1', d: '2026-10-28', items: [
      'Sửa lỗi: khi dùng theme Hành baro, Thiên thần hoặc Băng hoại, điện thoại học sinh không hiện nền xanh (đúng) / đỏ (sai). Giờ theme nào cũng hiện đúng màu.',
      'Theme Thiên thần: dải "Tham gia tại… PIN" phía trên đậm hơn, chữ trắng dễ đọc.',
      'Màn đếm ngược và tạm dừng đổi màu theo theme, không còn phủ tím.',
      'Hành baro: nền xanh ngọc đậm hơn một chút cho chữ trắng rõ hơn; đáp án sai mờ hẳn đi; nút chính màu hồng. Thiên thần: nút chính màu hồng đậm.'
    ] },
    { v: '1.7', d: '2026-10-28', items: [
      'Thêm 3 theme giống web Minto English: Hành baro (xanh ngọc), Thiên thần (hồng – lavender), Băng hoại (xanh đêm neon). Chọn lúc tạo phòng, hoặc bấm 🎨 / phím T để đổi giữa chừng.',
      'Điện thoại học sinh tự đổi màu theo theme của màn chiếu.',
      'Máy thầy nhớ theme lần trước; lần đầu thì lấy theo theme thầy đang dùng trên web Minto English.',
      'Đăng nhập Google trên iPhone (Safari, Zalo) dùng bản sửa lỗi mới của web chính.'
    ] },
    { v: '1.6', d: '2026-10-28', items: [
      'Phòng chờ: mã QR to gần gấp đôi, PIN nằm bên trái, QR bên phải.',
      'Màu xanh dương của ô đáp án đổi sang xanh trời, không còn lẫn với nền tím.',
      'Bảng xếp hạng không còn nhạc nền.',
      'Khi cả lớp đã trả lời, màn chiếu hiện "Everyone\'s locked in! ✅".'
    ] },
    { v: '1.5', d: '2026-10-27', items: [
      'Bảng xếp hạng đẹp hơn: điểm đếm tăng ở chỗ cũ trước, rồi mới đổi chỗ.',
      'Bạn từ ngoài top 5 lội ngược dòng: bay từ dưới lên, nhãn "🚀 Lội ngược dòng ▲n", viền sáng vàng và tiếng vút lên.',
      'Bạn bị đẩy khỏi top 5 trượt xuống mờ dần; mũi tên tụt hạng màu cam cho dễ phân biệt.',
      'Bạn ngoài top 5 mà vượt từ 3 bậc trở lên được nhắc tên dưới bảng để cổ vũ.'
    ] },
    { v: '1.4', d: '2026-10-27', items: [
      'Hình cho câu hỏi (ví dụ Part 1 tả tranh): trong trang soạn, bấm "🖼 Thêm hình" ở từng câu. Hình chỉ hiện trên màn chiếu, máy tự thu nhỏ cho nhẹ.',
      'Nút ⏸ Tạm dừng giữa câu (hoặc phím P): đồng hồ đứng yên, điện thoại học sinh báo "Thầy tạm dừng xíu nha" và chưa bấm được. Thời gian dừng không bị tính vào điểm tốc độ.',
      'Lớp đông bấm cùng lúc thì tiếng "bụp" không còn dồn dập loạn xạ.'
    ] },
    { v: '1.3', d: '2026-10-27', items: [
      'Phòng chờ: mã QR to hơn, nằm ngay đầu màn chiếu.',
      'Đang chơi: thanh "Tham gia tại … · PIN" trên cùng màn chiếu như Kahoot, bạn vào trễ vẫn thấy chỗ vào. Bấm biểu tượng QR để phóng to mã QR.',
      'Mỗi lần có bạn chọn đáp án, máy thầy kêu một tiếng "bụp" nhỏ, càng nhiều bạn trả lời tiếng càng cao.'
    ] },
    { v: '1.2', d: '2026-10-26', items: [
      'Lịch sử kết quả: chơi xong mỗi ván, bảng điểm tự lưu lại. Mở từ nút "📒 Lịch sử kết quả" trên trang bộ câu hỏi để xem lại từng buổi, tải CSV hoặc xoá buổi.',
      'Cộng dồn điểm nhiều buổi theo tên học sinh: chọn các buổi muốn cộng, xem tổng điểm, số lần top 1, top 3, số câu đúng. Tên gõ khác dấu hay chữ hoa vẫn được gộp; bạn nào gõ khác hẳn thì tick rồi bấm Gộp.',
      'Chống gian lận: điện thoại không khai được giờ bấm sớm hơn lúc mở câu để lấy đủ điểm tốc độ.'
    ] },
    { v: '1.1', d: '2026-10-26', items: [
      'Giao diện giống Kahoot hơn: nền tím có hình trôi, đếm ngược 3–2–1 trước câu đầu, chữ "Hết giờ!", ô đáp án đúng nhấp nháy, cột biểu đồ mọc lên.',
      'Nhạc mới: nhạc phòng chờ vui hơn, nhạc lúc trả lời dồn dập và nhanh dần ở 5 giây cuối, trống dồn trước bục vinh danh.',
      'Bảng xếp hạng có hiệu ứng đổi chỗ, điểm đếm tăng dần, mũi tên cho bạn vừa lên hạng.',
      'Điện thoại học sinh: lời khen, lời an ủi kiểu thầy kèm emoji (cả lúc gỡ lại sau câu sai, đứt chuỗi, lên hay tụt hạng, câu cuối), nền xanh khi đúng, đỏ khi sai, hiện "kém bạn phía trên bao nhiêu điểm", pháo giấy khi lên bục.',
      'Mạng yếu: điện thoại báo "Đang gửi…" và tự gửi lại khi chập chờn, điểm tốc độ tính theo lúc bấm nên mạng chậm vài giây không bị trừ điểm, tự vẽ lại màn hình khi có mạng hay mở lại màn hình; máy thầy mất mạng thì hiện thanh đỏ và tạm dừng.'
    ] },
    { v: '1.0', d: '2026-10-26', items: [
      'Ra mắt Minto Quiz: trò chơi trắc nghiệm trực tiếp trên lớp kiểu Kahoot, miễn phí.',
      'Tạo bộ câu hỏi bằng file Excel mẫu Kahoot, CSV, Word, PDF hoặc dán văn bản đề.',
      'Học sinh vào bằng điện thoại qua mã PIN hoặc QR, không cần đăng nhập.',
      'Tính điểm theo tốc độ như Kahoot, thưởng chuỗi đúng, tải kết quả CSV cuối game.'
    ] }
  ];
  var KEY = 'qz.news.seen';
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function open() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(30,35,43,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px';
    d.innerHTML = '<div class="card" style="max-width:520px;width:100%;max-height:80vh;overflow:auto"><h2 style="margin-top:0">✨ Có gì mới</h2>' +
      NEWS.map(function (n) { return '<h3 style="margin:14px 0 4px">Bản ' + esc(n.v) + ' <small class="muted">· ' + esc(n.d) + '</small></h3><ul style="margin:0;padding-left:20px">' + n.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>'; }).join('') +
      '<div style="text-align:right;margin-top:14px"><button class="btn pri">Đã hiểu</button></div></div>';
    d.onclick = function (e) { if (e.target === d || e.target.tagName === 'BUTTON') d.remove(); };
    document.body.appendChild(d);
    try { localStorage.setItem(KEY, NEWS[0].v); } catch (e) {}
  }
  function auto() { var s = ''; try { s = localStorage.getItem(KEY) || ''; } catch (e) {} if (s !== NEWS[0].v) open(); }
  window.MNEWS = { open: open, auto: auto, list: NEWS };
})();
