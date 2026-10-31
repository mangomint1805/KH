/* Minto Quiz — 📝 bài về nhà (màn học sinh, hw.html?id=…).
   Đề ở Firestore quizHW/{id} (không kèm đáp án). Học sinh làm theo tốc độ của mình, nộp một lần vào quizHWSub/{id}_{uid};
   nộp xong mới đọc được đáp án quizHWKey/{id} để xem điểm và xem lại từng câu. */
import { $, esc, qtHtml, show, player, bgfx, confetti, SDK, SHAPES, LETTERS, CLASSES, classLabel } from './common.js?v=17';

const ID = (new URLSearchParams(location.search).get('id') || '').replace(/[^\w-]/g, '').slice(0, 40);
const LS = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
let P = null, F = null, db = null, H = null, a = [], ms = [], cur = 0, t0 = 0, qAt = 0, tmr = 0, who = null, sending = false;
const pk = () => 'qz.hw.' + ID + '.' + P.uid;

function msg(ic, t, s) { show('sMsg'); $('mIc').textContent = ic; $('mT').textContent = t; $('mS').textContent = s || ''; }
function errText(e) {
  const c = (e && (e.code || e.message)) || '';
  if (/permission/i.test(c)) return 'Bài này chưa mở cho học sinh (thầy cần bật quyền bài về nhà).';
  if (/network|unavailable|offline/i.test(c)) return 'Mạng đang yếu, thử lại nhé.';
  return 'Có lỗi (' + c + '), thử lại nhé.';
}

async function boot() {
  if (!ID) return msg('🤔', 'Thiếu mã bài', 'Mở đúng link thầy gửi nha.');
  try {
    P = await player();
    F = await import(SDK + 'firebase-firestore.js');
    db = F.getFirestore(P.auth.app);
    if (window.QZ_EMU && !db._qzEmu) { F.connectFirestoreEmulator(db, '127.0.0.1', 8080); db._qzEmu = 1; }
    const d = await F.getDoc(F.doc(db, 'quizHW', ID));
    if (!d.exists()) return msg('🔍', 'Không tìm thấy bài này', 'Link có thể bị sai hoặc thầy đã xoá bài.');
    H = d.data();
  } catch (e) { console.error(e); return msg('😵', 'Không mở được bài', errText(e)); }
  document.title = H.title + ' · Bài về nhà';
  // đã nộp rồi: xem lại kết quả
  try { const s = await F.getDoc(F.doc(db, 'quizHWSub', ID + '_' + P.uid)); if (s.exists()) return result(s.data()); } catch (e) { console.warn(e); }
  if (Date.now() > H.due) return msg('⌛', 'Đã hết hạn nộp', 'Hạn nộp là ' + new Date(H.due).toLocaleString('vi-VN') + '.');
  const saved = (() => { try { return JSON.parse(LS.get(pk()) || 'null'); } catch (e) { return null; } })();
  if (saved && saved.who && saved.a && saved.a.length === H.n) { who = saved.who; a = saved.a; ms = saved.ms; cur = saved.cur || 0; t0 = saved.t0 || Date.now(); $('who').textContent = who.name; return ask(); }
  form();
}

function form() {
  show('sJoin');
  $('jT').textContent = H.title;
  $('jS').textContent = H.n + ' câu · hạn nộp ' + new Date(H.due).toLocaleString('vi-VN') + (H.timed ? ' · có tính giờ từng câu' : ' · làm theo tốc độ của em') + ' · chỉ nộp được 1 lần';
  const opts = CLASSES.slice(); if (H.lop && !opts.some((c) => c[0] === H.lop)) opts.unshift([H.lop, classLabel(H.lop)]);
  $('lop').innerHTML = '<option value="">— Chọn lớp —</option>' + opts.map((c) => '<option value="' + esc(c[0]) + '">' + esc(c[1]) + '</option>').join('');
  $('lop').value = LS.get('qz.hw.lop') || H.lop || '';
  let nm = LS.get('qz.hw.name'); if (!nm) { try { const x = JSON.parse(LS.get('mt.acc') || 'null'); nm = (LS.get('cam20.name') || (x && x.name) || LS.get('qz.name') || '').trim(); } catch (e) {} }
  $('name').value = nm.slice(0, 40);
  $('go').onclick = () => {
    const name = $('name').value.replace(/\s+/g, ' ').trim().slice(0, 40), lop = $('lop').value;
    if (name.length < 2) { $('jerr').textContent = 'Nhập họ tên của em nha.'; return; }
    if (!lop) { $('jerr').textContent = 'Chọn lớp của em nha.'; return; }
    LS.set('qz.hw.name', name); LS.set('qz.hw.lop', lop);
    who = { name, lop }; $('who').textContent = name;
    a = Array(H.n).fill(-1); ms = Array(H.n).fill(0); cur = 0; t0 = Date.now();
    keep(); ask();
  };
}
function keep() { LS.set(pk(), JSON.stringify({ who, a, ms, cur, t0 })); }

function ask() {
  clearInterval(tmr);
  const q = H.qs[cur];
  show('sQ'); qAt = Date.now();
  $('qNum').textContent = 'Câu ' + (cur + 1) + '/' + H.n;
  $('qQ').innerHTML = qtHtml(q.t); $('qQ').classList.toggle('long', String(q.t || '').length > 100);
  const g = $('qGrid'); g.innerHTML = '';
  q.o.forEach((txt, i) => {
    if (!txt) return;
    const b = document.createElement('button');
    b.className = 'pbtn k' + i + (a[cur] === i ? ' chosen' : ''); b.type = 'button';
    b.innerHTML = '<span class="lt">' + SHAPES[i] + ' ' + LETTERS[i] + '</span><span class="tx">' + esc(txt) + '</span>';
    b.onclick = () => { if (H.timed && a[cur] >= 0) return; a[cur] = i; ms[cur] += Date.now() - qAt; qAt = Date.now(); keep(); g.querySelectorAll('.pbtn').forEach((x) => x.classList.toggle('chosen', x === b)); if (H.timed) setTimeout(next, 350); };
    g.appendChild(b);
  });
  $('bPrev').hidden = H.timed || cur === 0;
  $('bPrev').onclick = () => { cur--; keep(); ask(); };
  $('bNext').textContent = cur + 1 === H.n ? 'Nộp bài ✓' : H.timed ? 'Bỏ qua →' : 'Câu tiếp →';
  $('bNext').onclick = next;
  $('qBar').style.width = ((cur + 1) / H.n * 100) + '%';
  $('qTime').textContent = '';
  if (H.timed) {
    const lim = (q.time || 20) * 1000;
    const tick = () => { const left = Math.max(0, lim - (Date.now() - qAt)); $('qTime').textContent = '⏱ ' + Math.ceil(left / 1000) + 's'; if (!left) { clearInterval(tmr); next(); } };
    tick(); tmr = setInterval(tick, 250);
  }
}
function next() {
  clearInterval(tmr);
  if (a[cur] < 0) ms[cur] += Date.now() - qAt;
  if (cur + 1 < H.n) { cur++; keep(); return ask(); }
  const miss = a.filter((x) => x < 0).length;
  if (!H.timed && miss && !confirm('Còn ' + miss + ' câu chưa chọn. Nộp bài luôn?')) return;
  submit();
}
async function submit() {
  if (sending) return; sending = true;
  msg('📤', 'Đang nộp bài…', '');
  const sub = { hw: ID, uid: P.uid, name: who.name, lop: who.lop, a, ms: ms.map((x) => Math.round(x)), t0, at: Date.now() };
  try { await F.setDoc(F.doc(db, 'quizHWSub', ID + '_' + P.uid), sub); }
  catch (e) {
    sending = false; console.error(e);
    // có thể đã nộp rồi (bấm hai lần, mạng chập chờn)
    try { const s = await F.getDoc(F.doc(db, 'quizHWSub', ID + '_' + P.uid)); if (s.exists()) { LS.del(pk()); return result(s.data(), true); } } catch (x) {}
    show('sQ'); $('bNext').textContent = 'Nộp lại ✓';
    alertBar(Date.now() > H.due ? 'Đã quá hạn nộp mất rồi 😢' : errText(e));
    return;
  }
  LS.del(pk());
  result(sub, true);
}
function alertBar(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 4000); }

async function result(sub, fresh) {
  show('sRes');
  $('who').textContent = sub.name;
  $('rT').textContent = H.title;
  let C = null;
  try { const k = await F.getDoc(F.doc(db, 'quizHWKey', ID)); if (k.exists()) C = (k.data().c || []).map((x) => x.c || []); } catch (e) { console.warn(e); }
  const A = sub.a || [];
  if (!C) { $('rS').textContent = '✓'; $('rM').textContent = 'Đã nộp lúc ' + new Date(sub.at).toLocaleString('vi-VN') + '. Chưa xem được đáp án, thử tải lại trang sau nha.'; $('rv').innerHTML = ''; return; }
  const ok = A.map((v, i) => v >= 0 && (C[i] || []).includes(v)), sc = ok.filter(Boolean).length, n = H.n;
  $('rS').textContent = sc + '/' + n;
  const pct = n ? sc / n : 0;
  $('rM').textContent = (pct >= 0.9 ? 'Xuất sắc luôn 🤩' : pct >= 0.7 ? 'Làm tốt lắm 👏' : pct >= 0.5 ? 'Ổn áp, xem lại mấy câu sai nha 💪' : 'Xem lại đáp án bên dưới rồi ôn thêm nha 📚') + ' · Nộp lúc ' + new Date(sub.at).toLocaleString('vi-VN');
  $('rv').innerHTML = H.qs.map((q, i) => {
    const v = A[i], right = (C[i] || []).map((k) => LETTERS[k] + '. ' + esc(q.o[k] || '')).join(' / ');
    return '<div class="it ' + (ok[i] ? 'ok' : 'no') + '"><b>' + (i + 1) + '.</b> ' + qtHtml(q.t) + '<div class="muted" style="margin-top:4px">' +
      (ok[i] ? '✅ ' + right : (v >= 0 ? '❌ Em chọn: ' + LETTERS[v] + '. ' + esc(q.o[v] || '') : '⏭ Em chưa chọn') + '<br>✅ Đáp án: ' + right) + '</div></div>';
  }).join('');
  if (fresh && pct >= 0.7) confetti($('fx'), 4000);
}

bgfx(6);
boot();
