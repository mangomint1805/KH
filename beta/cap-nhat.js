/* Minto Quiz — "Có gì mới". Thêm mục mới lên ĐẦU danh sách; bản mới nhất tự hiện một lần trên trang giáo viên. */
(function () {
  'use strict';
  var NEWS = [
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
