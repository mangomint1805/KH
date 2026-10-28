/* Minto Quiz — màn host (thầy chiếu lên lớp).
   Luồng chơi tham khảo Rahoot (https://github.com/Ralex91/Rahoot, MIT); phần realtime viết lại bằng Firebase RTDB. */
import { $, esc, qtHtml, base, isTeacher, serverClock, points, streakBonus, Sound, confetti, bgfx, countUp, simWeak, COLORS, SHAPES, LETTERS, THEMES, themeOf, applyTheme, savedTheme } from './common.js?v=7';

const SHOW_MS = 3000, LS_KEY = 'qz.host';
let B = null, D = null, now = () => Date.now();
let PIN = '', meta = null, quiz = null, state = {}, players = {}, answers = {}, keys = {};
let unsub = [], ansOff = null, timer = 0, autoT = 0, wake = null;
// hình của câu hỏi (Firestore quizImg/{id}), tải sẵn lúc tạo phòng
const IMGS = {}; let imgP = Promise.resolve();
function loadImgs() {
  const ids = [...new Set(quiz.qs.map((Q) => Q.img).filter(Boolean))];
  if (!ids.length) return Promise.resolve();
  return window.MACC.fs().then((x) => Promise.all(ids.map((id) => x.F.getDoc(x.F.doc(x.db, 'quizImg', id)).then((d) => { if (d.exists()) IMGS[id] = d.data().d; }).catch((e) => console.warn('img', id, e)))));
}
function imgTag(Q, cls) { return Q.img && IMGS[Q.img] ? '<img class="' + cls + '" src="' + IMGS[Q.img] + '" alt="">' : ''; }
// (8) tạm dừng: lúc dừng, state.phase = 'show' nhưng vẫn giữ startAt/endAt (luật cũ chấp nhận, điện thoại không gửi được đáp án).
// Khoảng dừng lưu trên máy thầy để trừ ra khi tính thời gian trả lời.
let PZ = {};
function pzLoad() { try { PZ = JSON.parse(localStorage.getItem('qz.pz.' + PIN) || '{}'); } catch (e) { PZ = {}; } }
function pzSave() { try { localStorage.setItem('qz.pz.' + PIN, JSON.stringify(PZ)); } catch (e) {} }
function pausedMs(q, at) { return (PZ[q] || []).reduce((t, [a, b]) => t + (a < at ? Math.min(b, at) - a : 0), 0); }
const isPaused = () => state.phase === 'show' && state.endAt != null;

const main = $('main');
function r(p) { return D.ref(B.db, 'quiz/' + PIN + (p ? '/' + p : '')); }
// Thanh "Tham gia tại …" trên cùng khi đang chơi (giống Kahoot), bấm biểu tượng QR để phóng to
const QR_IC = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm13-2h3v3h-3zm-5 0h3v3h-3zm3 3h3v3h-3zm-3 3h3v2h-3zm5 0h3v2h-3z"/></svg>';
function qrSvg(cell) { try { const g = window.qrcode(0, 'M'); g.addData(playUrl(true)); g.make(); return g.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true }); } catch (e) { return ''; } }
function paintStrip() {
  const el = $('jstrip'); if (!el) return;
  const on = !!PIN && !!state.phase && state.phase !== 'lobby' && state.phase !== 'end';
  el.hidden = !on;
  if (!on || el.dataset.pin === PIN) return;
  el.dataset.pin = PIN;
  el.innerHTML = '<button type="button" class="qrbtn" title="Hiện mã QR">' + QR_IC + '</button><span>Tham gia tại <b>' + esc(shortUrl()) + '</b> · PIN <b class="jpin">' + PIN + '</b></span>';
  el.querySelector('.qrbtn').onclick = bigQr;
}
function bigQr() {
  const ov = document.createElement('div'); ov.className = 'overlay qrov';
  ov.innerHTML = '<div class="qrcard"><div class="qr">' + qrSvg(8) + '</div><div class="lbl">Tham gia tại <b>' + esc(shortUrl()) + '</b></div><div class="pin">' + PIN + '</div><div class="muted">Bấm vào đâu cũng được để đóng</div></div>';
  ov.onclick = () => ov.remove();
  document.body.appendChild(ov);
}
// ---------- theme ----------
let THEME = applyTheme(savedTheme()); Sound.setTheme(THEME);
function paintThemes() { document.querySelectorAll('.thm').forEach((b) => b.classList.toggle('on', b.dataset.t === THEME)); }
function setTheme(id) {
  THEME = applyTheme(id); Sound.setTheme(THEME); paintThemes();
  try { localStorage.setItem('qz.theme', THEME); } catch (e) {}
  if (PIN && meta) { meta.theme = THEME; D.update(r('meta'), { theme: THEME }).catch((e) => console.warn('theme', e)); }
}
function nextTheme() { const i = THEMES.findIndex((t) => t.id === THEME); setTheme(THEMES[(i + 1) % THEMES.length].id); toast('Theme: ' + themeOf(THEME).n); }
function stat(t) { $('stat').textContent = t || ''; }
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }
function fail(e) { console.error(e); toast('Lỗi: ' + ((e && (e.code || e.message)) || 'không rõ')); }
function playUrl(withPin) { return new URL('play.html' + (withPin ? '?pin=' + PIN : ''), location.href).href; }
function shortUrl() { return new URL('.', location.href).href.replace(/^https?:\/\//, '').replace(/\/$/, ''); }

// ---------- đăng nhập thầy ----------
async function boot() {
  try { B = await base(); } catch (e) { main.innerHTML = '<div class="loading err">Không tải được dịch vụ đăng nhập. Kiểm tra mạng rồi tải lại trang.</div>'; return; }
  D = B.D;
  const u = B.auth.currentUser;
  if (!u || !isTeacher(u.email)) {
    main.innerHTML = '<div class="loading"><div class="card" style="text-align:center;max-width:420px"><h2>Trang dành cho giáo viên</h2><p class="muted">' +
      (u ? 'Tài khoản ' + esc(u.email) + ' không có quyền mở trang này.' : 'Đăng nhập Google bằng tài khoản giáo viên để tạo phòng.') +
      '</p><button class="btn pri" id="gIn">Đăng nhập Google</button></div></div>';
    $('gIn').onclick = () => window.MACC.quick();
    window.MACCPAINT = () => { const x = window.MACC.user(); if (x && isTeacher(x.email)) location.reload(); };
    return;
  }
  now = serverClock(D, B.db);
  watchNet(); simWeak(D, B.db, 'host');
  $('ctrl').hidden = false;
  cleanup();
  const params = new URLSearchParams(location.search);
  const old = (() => { try { return localStorage.getItem(LS_KEY) || ''; } catch (e) { return ''; } })();
  if (old && !params.get('quiz')) {
    const ok = await resume(old).catch((e) => { console.error(e); return false; });
    if (ok) return;
  }
  pick(params.get('quiz'));
}

// Mất mạng: hiện thanh đỏ trên cùng; Firebase tự gửi lại khi có mạng, trò chơi tạm dừng tới lúc đó.
function watchNet() {
  let seen = false, bar = null;
  D.onValue(D.ref(B.db, '.info/connected'), (s) => {
    const on = s.val() === true;
    if (on) { seen = true; if (bar) { bar.remove(); bar = null; toast('Đã có mạng lại ✓'); } return; }
    if (!seen || bar) return;
    bar = document.createElement('div'); bar.className = 'netbar'; bar.textContent = '⚠ Máy thầy mất mạng — trò chơi tạm dừng, sẽ tự tiếp tục khi có mạng lại';
    document.body.appendChild(bar);
  });
}

// Xoá phòng quá 24 giờ (không có máy chủ nên trang host tự dọn mỗi lần mở)
async function cleanup() {
  try {
    const s = await D.get(D.ref(B.db, 'quiz')); const all = s.val() || {}, up = {};
    Object.keys(all).forEach((pin) => { const m = all[pin] && all[pin].meta; if (!m || !m.at || Date.now() - m.at > 24 * 3600e3) up[pin] = null; });
    if (Object.keys(up).length) await D.update(D.ref(B.db, 'quiz'), up);
  } catch (e) { console.warn('cleanup', e); }
}

// ---------- chọn bộ câu hỏi ----------
async function pick(want) {
  main.innerHTML = '<div class="wrap" style="width:100%"><h1>Chọn bộ câu hỏi</h1><div id="qs" class="qlist"><div class="muted">Đang tải…</div></div>' +
    '<label style="display:flex;gap:8px;align-items:center;margin-top:18px"><input type="checkbox" id="optStreak" checked> Thưởng chuỗi trả lời đúng liên tiếp (+100 mỗi câu, tối đa +500)</label>' +
    '<div class="themes" id="themes"><b>Theme:</b>' + THEMES.map((t) => '<button type="button" class="thm" data-t="' + t.id + '"><i style="background:' + t.sw + '"></i>' + esc(t.n) + '</button>').join('') + '</div>' +
    '<p class="muted" style="margin-top:18px">Chưa có bộ câu hỏi? <a href="admin.html">Tạo hoặc nhập từ file</a>.</p></div>';
  paintThemes();
  $('themes').querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => setTheme(b.dataset.t); });
  try {
    const x = await window.MACC.fs();
    const qs = await x.F.getDocs(x.F.collection(x.db, 'quizzes'));
    const L = []; qs.forEach((d) => L.push({ id: d.id, ...d.data() }));
    L.sort((a, b) => (b.upd || 0) - (a.upd || 0));
    $('qs').innerHTML = L.length ? L.map((q) => '<div class="card qrow"><div class="t"><b>' + esc(q.title || '(chưa đặt tên)') + '</b><span class="muted">' + (q.qs || []).length + ' câu</span></div><button class="btn pri" data-id="' + esc(q.id) + '">Tạo phòng</button></div>').join('') : '<div class="muted">Chưa có bộ câu hỏi nào.</div>';
    $('qs').querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => create(L.find((q) => q.id === b.dataset.id)); });
    if (want) { const q = L.find((x) => x.id === want); if (q) create(q); }
  } catch (e) { $('qs').innerHTML = '<div class="err">Không đọc được bộ câu hỏi (' + esc(e.code || e.message) + ').</div>'; }
}

async function create(q) {
  if (!q || !q.qs || !q.qs.length) return toast('Bộ câu hỏi trống.');
  Sound.unlock();
  quiz = q;
  let pin = '';
  for (let i = 0; i < 20 && !pin; i++) {
    const p = String(100000 + Math.floor(Math.random() * 900000));
    if (!(await D.get(D.ref(B.db, 'quiz/' + p + '/meta'))).exists()) pin = p;
  }
  PIN = pin;
  meta = { title: String(q.title || 'Minto Quiz').slice(0, 120), n: q.qs.length, qz: q.id, streak: $('optStreak').checked, theme: THEME, at: D.serverTimestamp() };
  imgP = loadImgs(); pzLoad();
  try { await D.set(r(), { meta, state: { phase: 'lobby', q: -1, qs: '-1' } }); }
  catch (e) {
    // luật Realtime Database cũ chưa có trường theme: tạo phòng không kèm theme (điện thoại dùng màu tím mặc định)
    delete meta.theme;
    try { await D.set(r(), { meta, state: { phase: 'lobby', q: -1, qs: '-1' } }); console.warn('Luật RTDB chưa có meta/theme, xem FIREBASE.md'); }
    catch (e2) { return fail(e2); }
  }
  meta.at = Date.now();
  try { localStorage.setItem(LS_KEY, PIN); } catch (e) {}
  history.replaceState(null, '', location.pathname);
  attach();
}

async function resume(pin) {
  PIN = pin;
  const s = await D.get(r()); const room = s.val();
  if (!room || !room.meta) { try { localStorage.removeItem(LS_KEY); } catch (e) {} return false; }
  meta = room.meta;
  if (meta.theme) { THEME = applyTheme(meta.theme); Sound.setTheme(THEME); }
  const x = await window.MACC.fs();
  const d = await x.F.getDoc(x.F.doc(x.db, 'quizzes', meta.qz));
  if (!d.exists()) return false;
  quiz = { id: d.id, ...d.data() };
  // bộ câu hỏi có thể đã bị sửa sau khi tạo phòng: giữ nguyên số câu như lúc tạo
  quiz.qs = quiz.qs.slice(0, meta.n);
  if (quiz.qs.length < meta.n) return false;
  keys = room.key || {}; answers = room.answers || {};
  imgP = loadImgs(); pzLoad();
  await imgP;
  attach();
  return true;
}

function attach() {
  unsub.forEach((f) => f()); unsub = [];
  $('title').textContent = meta.title;
  unsub.push(D.onValue(r('players'), (s) => { const old = players; players = s.val() || {}; if (Object.keys(players).some((k) => !old[k]) && state.phase === 'lobby') Sound.join(); onPlayers(); }));
  unsub.push(D.onValue(r('state'), (s) => {
    const first = !state.phase;
    state = s.val() || { phase: 'lobby' };
    paintStrip();
    if (first) restore();
  }));
  unsub.push(D.onValue(r('meta'), (s) => { if (!s.exists()) { toast('Phòng đã bị xoá.'); try { localStorage.removeItem(LS_KEY); } catch (e) {} setTimeout(() => location.reload(), 1200); } }));
  keepAwake();
}

// mở lại trang host giữa chừng: dựng lại đúng màn hình
function restore() {
  const p = state.phase, q = state.q;
  if (p === 'lobby') return lobby();
  if (p === 'show') return isPaused() ? pauseView(q) : goShow(q);
  if (p === 'answer') return now() < state.endAt ? answerView(q) : goReveal(q);
  if (p === 'reveal') return goReveal(q);
  if (p === 'board') return boardView(q);
  if (p === 'end') return endView();
}

function onPlayers() {
  const n = Object.keys(players).length;
  stat('PIN ' + PIN + ' · ' + n + ' người chơi');
  if (state.phase === 'lobby') lobbyNames();
  if (state.phase === 'answer') updAnswered();
}

// ---------- phòng chờ ----------
function lobby() {
  Sound.mode('lobby');
  const qr = qrSvg(8);
  main.innerHTML = '<div class="lobby2"><div class="joinbar"><div class="jl"><div class="lbl">Vào <b>' + esc(shortUrl()) + '</b><br>hoặc quét mã QR 👉</div>' +
    '<div class="lbl" style="margin-top:14px">Mã PIN</div><div class="pin">' + PIN + '</div></div>' + (qr ? '<div class="qr">' + qr + '</div>' : '') + '</div>' +
    '<div class="lobbyrow"><span class="count" id="cnt">0 người chơi</span><span class="brand">Minto Quiz</span>' +
    '<button class="btn big pri" id="bStart" disabled>Bắt đầu ▶</button></div><div class="names" id="names"></div>' +
    '<p class="hint" id="hint">Đang chờ học sinh vào phòng<span class="waitdots"></span> Bấm × để mời một bạn ra (ví dụ tên không phù hợp).</p></div>';
  $('bStart').onclick = () => start();
  lobbyNames();
}
function lobbyNames() {
  const el = $('names'); if (!el) return;
  const L = Object.entries(players).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  $('cnt').textContent = L.length + ' người chơi';
  $('bStart').disabled = !L.length;
  el.innerHTML = L.map(([id, p]) => '<span class="nm">' + esc(p.name) + '<button title="Mời ra" data-k="' + esc(id) + '">×</button></span>').join('');
  el.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => kick(b.dataset.k); });
}
function kick(uid) {
  const p = players[uid]; if (!p) return;
  if (!confirm('Mời "' + p.name + '" ra khỏi phòng?')) return;
  D.update(r(), { ['players/' + uid]: null, ['kick/' + uid]: true, ['scores/' + uid]: null }).catch(fail);
}

let starting = false;
// Đếm ngược 3–2–1 trước câu đầu (giống Kahoot), phím Space không bấm được hai lần
function start() {
  if (!Object.keys(players).length || starting) return;
  starting = true; Sound.mode(null); Sound.go();
  const ov = document.createElement('div'); ov.className = 'overlay'; document.body.appendChild(ov);
  let n = 3;
  const step = () => {
    if (n === 0) { ov.remove(); starting = false; goShow(0); return; }
    ov.innerHTML = '<div class="t">' + esc(meta.title) + '</div><div class="big" key="' + n + '">' + n + '</div><div class="t" style="font-size:26px">Chuẩn bị nhé!</div>';
    Sound.count(n); n--; setTimeout(step, 1000);
  };
  step();
}

// ---------- câu hỏi ----------
async function goShow(q) {
  clearTimeout(autoT); clearInterval(timer); stopAns();
  const Q = quiz.qs[q];
  await Promise.race([imgP, new Promise((ok) => setTimeout(ok, 4000))]);
  try {
    await D.update(r(), {
      ['qpub/' + q]: { t: Q.t, o: Q.o.map((x) => x || ''), time: Q.time, pts: Q.pts },
      state: { phase: 'show', q, qs: String(q) },
    });
  } catch (e) { return fail(e); }
  state = { phase: 'show', q };
  Sound.mode(null); Sound.whoosh();
  main.innerHTML = qHead(q) + '<div class="qbanner">' + (q + 1 === quiz.qs.length && quiz.qs.length > 1 ? hsay(HL.lastQ, PIN) : 'Câu ' + (q + 1) + ' / ' + quiz.qs.length) + '</div>' + (imgTag(Q, 'qimg big') ? '<div class="qtext sm">' + qtHtml(Q.t) + '</div><div class="qimgbox">' + imgTag(Q, 'qimg big') + '</div>' : '<div class="qtext" style="flex:1;display:flex;align-items:center;justify-content:center">' + qtHtml(Q.t) + '</div>') +
    (Q.pts === 2 ? '<div class="tag2">⭐ Câu điểm gấp đôi</div>' : Q.pts === 0 ? '<div class="tag2" style="background:#fff;color:var(--dim)">Câu này không tính điểm</div>' : '') +
    '<div class="prog"><i id="pg"></i></div>';
  requestAnimationFrame(() => requestAnimationFrame(() => { const pg = $('pg'); if (pg) pg.style.width = '100%'; }));
  autoT = setTimeout(() => goAnswer(q), SHOW_MS);
}
function qHead(q) { return '<div class="qmeta"><span>Câu ' + (q + 1) + '/' + quiz.qs.length + '</span><span class="muted">PIN ' + PIN + '</span></div>'; }

async function goAnswer(q) {
  clearTimeout(autoT);
  const Q = quiz.qs[q], startAt = Math.round(now()) + 300, endAt = startAt + Q.time * 1000;
  try { await D.set(r('state'), { phase: 'answer', q, qs: String(q), startAt, endAt }); } catch (e) { return fail(e); }
  state = { phase: 'answer', q, qs: String(q), startAt, endAt };
  answerView(q);
}

function answerView(q, still) {
  const Q = quiz.qs[q];
  if (!still) Sound.mode('q');
  const C = 2 * Math.PI * 58;
  main.innerHTML = qHead(q) + '<div class="qtext' + (imgTag(Q, 'x') ? ' sm' : '') + '">' + qtHtml(Q.t) + '</div>' +
    '<div class="mid"><div class="ring" id="ring"><svg viewBox="0 0 140 140"><circle class="bgc" cx="70" cy="70" r="58"/><circle class="fg" id="arc" cx="70" cy="70" r="58" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg><div class="timer" id="tm">' + Q.time + '</div></div><div id="pics">' + imgTag(Q, 'qimg') + '</div><div class="answered"><b id="na">0</b>đã trả lời<br><button class="btn" id="bPause" style="margin-top:10px" title="Tạm dừng (phím P)">⏸ Tạm dừng</button> <button class="btn" id="bSkip" style="margin-top:10px">Bỏ qua ⏭</button></div></div>' +
    '<div class="hgrid">' + Q.o.map((o, i) => o ? '<div class="hopt k' + i + '"><span class="shape">' + SHAPES[i] + '</span>' + esc(o) + '</div>' : '<div></div>').join('') + '</div>';
  $('bSkip').onclick = () => goReveal(q);
  $('bPause').onclick = () => pause();
  stopAns();
  let heard = -1, lastBeep = 0;
  ansOff = D.onValue(r('answers/' + q), (s) => {
    answers[q] = s.val() || {};
    const n = Object.keys(answers[q]).filter((k) => players[k]).length;
    // lần đầu là dữ liệu có sẵn (vd. tải lại trang): không kêu; lớp đông bấm dồn: cách nhau ít nhất 120ms
    if (heard >= 0 && n > heard && state.phase === 'answer' && Date.now() - lastBeep > 120) { Sound.answer(n); lastBeep = Date.now(); }
    heard = n;
    updAnswered();
  });
  let last = -1;
  clearInterval(timer);
  if (still) return;
  timer = setInterval(() => {
    const ms = Math.max(0, state.endAt - now()), left = Math.min(Q.time, Math.ceil(ms / 1000)), tm = $('tm');
    if (tm) { tm.textContent = left; $('ring').classList.toggle('low', left <= 5); $('arc').style.strokeDashoffset = (C * (1 - Math.min(1, ms / (Q.time * 1000)))).toFixed(1); }
    if (left !== last && left <= 5 && left > 0) { Sound.tick(); Sound.hurry(true); }
    last = left;
    if (now() > state.endAt + 500) goReveal(q);
  }, 200);
}
let pauseOv = null;
async function pause() {
  if (state.phase !== 'answer') return;
  const q = state.q, at = Math.round(now());
  clearInterval(timer); Sound.mode(null);
  PZ.cur = { q, at }; pzSave();
  const st = { phase: 'show', q, qs: String(q), startAt: state.startAt, endAt: state.endAt };
  try { await D.set(r('state'), st); } catch (e) { delete PZ.cur; pzSave(); answerView(q); return fail(e); }
  state = st;
  pauseView(q);
}
function pauseView(q) {
  clearInterval(timer); clearTimeout(autoT);
  if (!$('tm')) answerView(q, true);
  const left = Math.max(0, Math.ceil((state.endAt - (PZ.cur ? PZ.cur.at : now())) / 1000));
  const tm = $('tm'); if (tm) tm.textContent = left;
  if (pauseOv) pauseOv.remove();
  pauseOv = document.createElement('div'); pauseOv.className = 'overlay pauseov';
  pauseOv.innerHTML = '<div class="pic">⏸</div><div class="t">Tạm dừng · còn ' + left + ' giây</div><div class="pbtns"><button class="btn pri" id="bResume">▶ Tiếp tục</button><button class="btn" id="bSkip2">Bỏ qua ⏭</button></div><div class="ph">Phím Space hoặc P để tiếp tục</div>';
  document.body.appendChild(pauseOv);
  $('bResume').onclick = unpause; $('bSkip2').onclick = () => goReveal(q);
}
function closePause() { if (pauseOv) { pauseOv.remove(); pauseOv = null; } }
async function unpause() {
  if (!isPaused()) return;
  const q = state.q, t = Math.round(now()), from = PZ.cur && PZ.cur.q === q ? PZ.cur.at : t;
  const dur = Math.max(0, t - from);
  const st = { phase: 'answer', q, qs: String(q), startAt: state.startAt, endAt: state.endAt + dur };
  try { await D.set(r('state'), st); } catch (e) { return fail(e); }
  (PZ[q] = PZ[q] || []).push([from, t]); delete PZ.cur; pzSave();
  state = st; closePause();
  answerView(q);
}
function updAnswered() {
  const q = state.q, a = answers[q] || {}, n = Object.keys(a).filter((k) => players[k]).length, total = Object.keys(players).length;
  const el = $('na'); if (el) el.textContent = n + '/' + total;
  if (state.phase === 'answer' && total && n >= total) goReveal(q);
}
function stopAns() { if (ansOff) { ansOff(); ansOff = null; } }

let revealing = -1;
async function goReveal(q) {
  if (revealing === q) return;
  revealing = q;
  clearInterval(timer); stopAns(); Sound.mode(null); closePause();
  const wasOpen = state.phase === 'answer' || isPaused();
  if (isPaused()) { const t = Math.round(now()), from = PZ.cur ? PZ.cur.at : t; (PZ[q] = PZ[q] || []).push([from, t]); delete PZ.cur; pzSave(); }
  const Q = quiz.qs[q];
  let ov = null;
  if (wasOpen) {
    Sound.timeup();
    ov = document.createElement('div'); ov.className = 'overlay';
    const all = Object.keys(answers[q] || {}).filter((k) => players[k]).length >= Object.keys(players).length;
    ov.innerHTML = '<div class="timesup">' + (all ? "Everyone's locked in! ✅" : 'Hết giờ! ⏰') + '</div>';
    document.body.appendChild(ov);
  }
  const t0 = Date.now();
  try {
    if (wasOpen) await D.update(r('state'), { phase: 'reveal' });
    state.phase = 'reveal';
    const s = await D.get(r('answers/' + q)); answers[q] = s.val() || {};
    if (!keys[q]) keys[q] = { c: Q.c.slice(), s: state.startAt, e: state.endAt };
    const res = compute();
    const up = { ['key/' + q]: keys[q] };
    Object.keys(players).forEach((uid) => {
      const x = res.by[uid], it = x.q[q] || {};
      up['scores/' + uid] = { s: x.s, k: x.k, r: x.r, n: res.n, q, p: it.pts || 0, b: it.b || 0, ok: !!it.ok, c: Q.c.slice() };
    });
    await D.update(r(), up);
  } catch (e) { fail(e); }
  revealing = -1;
  if (ov) { await new Promise((ok) => setTimeout(ok, Math.max(0, 1300 - (Date.now() - t0)))); ov.remove(); }
  Sound.reveal();
  revealView(q);
}

// Lời thầy trên màn chiếu (sửa được qua form lời nhắn)
const HL = {
  allOk: ['Cả lớp đúng hết luôn, tự hào ghê 🥹', '100% đúng, quá đỉnh 💯', 'Everyone got it! 🥹', 'Perfect score, class! 💯'],
  allNo: ['Cả lớp sai hết vậy đó hả 😭', 'Ủa cả lớp?? Câu này thầy giảng lại nha 😭', 'Houston, we have a problem 😭', 'Everyone missed it?? 😭'],
  lastQ: ['Câu cuối cùng rồi nè 🔥', 'Câu cuối, lật kèo là ở đây 😤', 'Final question! 🔥'],
};
const hsay = (arr, seed) => arr[String(seed).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % arr.length];
function revealView(q) {
  const Q = quiz.qs[q], a = answers[q] || {}, cnt = [0, 0, 0, 0];
  Object.keys(a).forEach((k) => { if (players[k] && a[k] && cnt[a[k].a] != null) cnt[a[k].a]++; });
  const mx = Math.max(1, ...cnt), tot = cnt.reduce((x, y) => x + y, 0), right = Q.c.reduce((x, i) => x + (cnt[i] || 0), 0);
  const vibe = tot >= 2 && Q.c.length < 4 ? (right === tot ? hsay(HL.allOk, PIN + q) : right === 0 ? hsay(HL.allNo, PIN + q) : '') : '';
  main.innerHTML = qHead(q) + '<div class="qtext">' + qtHtml(Q.t) + '</div>' + (vibe ? '<div class="vibe">' + esc(vibe) + '</div>' : '') +
    '<div class="chart" id="chart">' + Q.o.map((o, i) => o ? '<div class="col' + (Q.c.includes(i) ? '' : ' dim') + '"><span class="n">' + cnt[i] + (Q.c.includes(i) ? ' ✔' : '') + '</span><div class="b k' + i + '" style="--h:' + Math.max(8, Math.round(cnt[i] / mx * 120)) + 'px"></div><div class="s k' + i + '">' + SHAPES[i] + '</div></div>' : '').join('') + '</div>' +
    '<div class="hgrid">' + Q.o.map((o, i) => o ? '<div class="hopt k' + i + (Q.c.includes(i) ? ' win' : ' dim') + '"><span class="shape">' + SHAPES[i] + '</span>' + esc(o) + (Q.c.includes(i) ? '<span class="ok">✔</span>' : '') + '</div>' : '<div></div>').join('') + '</div>' +
    '<div style="text-align:right"><button class="btn big pri" id="bNext">' + (q + 1 < quiz.qs.length ? 'Bảng xếp hạng ▶' : 'Xem kết quả 🏆') + '</button></div>';
  $('bNext').onclick = next;
  requestAnimationFrame(() => requestAnimationFrame(() => { const c = $('chart'); if (c) c.classList.add('go'); }));
}

async function goBoard(q) {
  try { await D.update(r('state'), { phase: 'board' }); } catch (e) { return fail(e); }
  state.phase = 'board';
  boardView(q);
}
function boardView(q) {
  Sound.mode(null); // bảng xếp hạng: không nhạc nền
  const res = compute(), H = 74, TOP = 5;
  // thứ hạng trước câu này (theo điểm trước câu) để biết ai lên, ai xuống
  const prev = res.list.map((x) => ({ x, ps: x.s - ((x.q[q] && x.q[q].pts) || 0) })).sort((a, b) => b.ps - a.ps || a.x.name.localeCompare(b.x.name));
  const prevRank = {}; prev.forEach((p, i) => { prevRank[p.x.uid] = i; });
  const top = res.list.slice(0, TOP);
  const anim = q > 0;
  // bạn rớt khỏi top 5: vẫn vẽ để thấy bị đẩy xuống
  const dropped = anim ? prev.filter((p, i) => i < TOP && res.list.indexOf(p.x) >= TOP).map((p) => p.x) : [];
  const rows = top.concat(dropped);
  let below = 0;
  const startTop = (x) => { const pi = prevRank[x.uid]; return !anim || pi < TOP ? (anim ? pi : res.list.indexOf(x)) * H : (TOP + below++) * H + 30; };
  // lội ngược dòng: trước ngoài top 5, giờ vào top 5
  const climb = (x) => anim && prevRank[x.uid] >= TOP && res.list.indexOf(x) < TOP;
  // bạn tiến nhiều nhất ngoài top 5 (vượt từ 3 bậc): nhắc tên ở dưới bảng
  const riser = anim ? res.list.slice(TOP).map((x) => ({ x, up: prevRank[x.uid] - res.list.indexOf(x) })).filter((o) => o.up >= 3).sort((a, b) => b.up - a.up)[0] : null;
  const lead = res.list[0];
  main.innerHTML = '<h1 style="text-align:center;margin:0">Bảng xếp hạng</h1>' +
    '<div class="lead" id="lead"></div>' +
    '<div class="board2" id="bd" style="height:' + (Math.max(1, top.length) * H) + 'px">' +
    (rows.length ? rows.map((x) => {
      const it = x.q[q] || {}, ni = res.list.indexOf(x), up = anim ? prevRank[x.uid] - ni : 0, out = ni >= TOP, c = climb(x);
      return '<div class="r' + (x.r === 1 && !out ? ' first' : '') + (c ? ' cl' : '') + (out ? ' out' : '') + '" data-u="' + esc(x.uid) + '" data-to="' + (out ? TOP * H + 10 : ni * H) + '" style="top:' + startTop(x) + 'px">' +
        '<span class="rk" data-r="' + x.r + '">' + (anim ? prevRank[x.uid] + 1 : x.r) + '</span><span class="nm">' + esc(x.name) + '</span>' +
        (c ? '<span class="badge">🚀 Lội ngược dòng ▲' + up + '</span>' : '') +
        (it.pts ? '<span class="up">+' + it.pts + '</span>' : '') + (x.k >= 2 ? '<span class="up">🔥' + x.k + '</span>' : '') +
        '<span class="mv' + (up >= 3 ? ' big' : '') + (up < 0 ? ' dn' : '') + '">' + (up > 0 && !c ? '▲' + up : up < 0 && !out ? '▼' + (-up) : '') + '</span>' +
        '<span class="sc" data-from="' + (x.s - (it.pts || 0)) + '" data-to="' + x.s + '">' + (x.s - (it.pts || 0)) + '</span></div>';
    }).join('') : '<p class="muted" style="text-align:center">Chưa có ai.</p>') +
    '</div><div class="riser" id="riser"></div><div style="text-align:right;margin-top:auto"><button class="btn big pri" id="bNext">Câu tiếp ▶</button></div>';
  $('bNext').onclick = next;
  const bd = $('bd');
  // 1) điểm đếm tăng  2) đổi chỗ: bạn lội ngược dòng bay từ dưới lên, sáng rực; bạn rớt hạng trượt xuống mờ dần  3) nhắc bạn tiến xa nhất ngoài top 5
  bd.querySelectorAll('.sc').forEach((el) => countUp(el, +el.dataset.from, +el.dataset.to, 1100));
  const cls = bd.querySelectorAll('.r.cl');
  if (!anim && lead && res.list.length > 1) { $('lead').textContent = '👑 ' + lead.name + ' đang top 1 nè'; $('lead').classList.add('on'); }
  setTimeout(() => {
    bd.querySelectorAll('.r').forEach((el) => { el.style.top = el.dataset.to + 'px'; const rk = el.querySelector('.rk'); rk.textContent = rk.dataset.r; });
    bd.classList.add('done');
    if (cls.length) { Sound.climb(); cls.forEach((el) => el.classList.add('go')); }
  }, 1200);
  setTimeout(() => {
    cls.forEach((el) => el.classList.add('glow'));
    const ld = $('lead'); if (ld && lead && res.list.length > 1) { ld.textContent = '👑 ' + lead.name + ' đang top 1' + (lead.k >= 2 ? ', chuỗi 🔥' + lead.k + ' nóng quá trời' : ' nè'); ld.classList.add('on'); }
    if (riser) { const el = $('riser'); if (el) { el.innerHTML = '📈 <b>' + esc(riser.x.name) + '</b> vượt ' + riser.up + ' bậc, lên hạng ' + riser.x.r + '. Cố lên nữa nha!'; el.classList.add('on'); } }
  }, 2200);
}

async function goEnd() {
  clearInterval(timer); stopAns();
  try { await D.update(r('state'), { phase: 'end' }); } catch (e) { return fail(e); }
  state.phase = 'end';
  endView(true);
}

// ---------- lưu bản tổng kết vào Firestore (chỉ thầy đọc được) để xem lại trong Lịch sử kết quả ----------
let savedPin = '';
function resultId() {
  const d = new Date(meta.at || Date.now()), pad = (n) => ('0' + n).slice(-2);
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + PIN;
}
function saveMark(t, retry) {
  const el = $('saveSt'); if (!el) return;
  el.innerHTML = t + (retry ? ' <button class="btn sm" id="bSaveAgain">Thử lại</button>' : '');
  if (retry) $('bSaveAgain').onclick = saveResult;
}
async function saveResult() {
  if (savedPin === PIN) return saveMark('✅ Đã lưu vào <a href="ket-qua.html">Lịch sử kết quả</a>');
  const res = compute(); if (!res.n) return saveMark('');
  saveMark('Đang lưu vào lịch sử…');
  try {
    const x = await window.MACC.fs(), F = x.F;
    const nq = quiz.qs.filter((Q) => Q.pts).length;
    await F.setDoc(F.doc(x.db, 'quizResults', resultId()), {
      title: meta.title, qz: meta.qz || '', pin: PIN, at: meta.at || Date.now(), saved: Date.now(), nq, streak: !!meta.streak,
      players: res.list.map((p) => ({ name: String(p.name || '').slice(0, 40), s: p.s, r: p.r, ok: p.ok })),
    });
    savedPin = PIN;
    saveMark('✅ Đã lưu vào <a href="ket-qua.html">Lịch sử kết quả</a>');
  } catch (e) {
    console.error(e);
    saveMark('⚠️ Chưa lưu được vào lịch sử (' + esc(e.code || e.message || 'lỗi') + ').', true);
  }
}
function endView(anim) {
  Sound.mode(null);
  const res = compute(), t = res.list;
  const slot = (x, k) => x ? '<div class="p p' + k + '"><div class="nm">' + esc(x.name) + '</div><div class="blk">' + k + '<small>' + x.s + ' điểm</small></div></div>' : '<div class="p p' + k + '"></div>';
  main.innerHTML = '<h1 style="text-align:center;margin:0">🏆 ' + esc(meta.title) + '</h1>' +
    '<div class="podium">' + slot(t[1], 2) + slot(t[0], 1) + slot(t[2], 3) + '</div>' +
    (t.length > 3 ? '<div class="rest">' + t.slice(3, 10).map((x) => '<span>' + x.r + '. ' + esc(x.name) + ' · ' + x.s + '</span>').join('') + '</div>' : '') +
    '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn pri" id="bCsv">⬇ Tải kết quả CSV</button><button class="btn" id="bNew">Chơi bộ khác</button><button class="btn danger" id="bClose">Đóng phòng (xoá dữ liệu)</button></div>' +
    '<p class="muted" style="text-align:center" id="saveSt"></p>' +
    '<p class="muted" style="text-align:center">Phòng chơi tự xoá sau 24 giờ. Bảng điểm đã lưu trong Lịch sử kết quả, file CSV có thêm chi tiết từng câu.</p>';
  $('bCsv').onclick = csv;
  $('bNew').onclick = () => { try { localStorage.removeItem(LS_KEY); } catch (e) {} location.href = 'host.html'; };
  $('bClose').onclick = async () => { if (!confirm('Xoá phòng ' + PIN + '? Học sinh sẽ không xem lại được kết quả.')) return; unsub.forEach((f) => f()); unsub = []; await D.remove(r()).catch(fail); try { localStorage.removeItem(LS_KEY); } catch (e) {} location.href = 'host.html'; };
  saveResult();
  if (anim) { Sound.drum(2.1); setTimeout(() => { Sound.win(); confetti($('fx'), 8000); }, 2300); }
}

function next() {
  const p = state.phase, q = state.q;
  if (p === 'lobby') return start();
  if (p === 'show') return isPaused() ? unpause() : goAnswer(q);
  if (p === 'answer') return goReveal(q);
  if (p === 'reveal') return q + 1 < quiz.qs.length ? goBoard(q) : goEnd();
  if (p === 'board') return goShow(q + 1);
}

// ---------- tính điểm (tính lại từ đầu, nên tải lại trang vẫn đúng) ----------
function compute() {
  const by = {}, ids = Object.keys(players);
  ids.forEach((uid) => { by[uid] = { uid, name: players[uid].name, s: 0, k: 0, ok: 0, q: {} }; });
  quiz.qs.forEach((Q, q) => {
    const K = keys[q]; if (!K) return;
    const a = answers[q] || {};
    ids.forEach((uid) => {
      const x = by[uid];
      let an = a[uid];
      // giờ bấm sớm hơn lúc mở câu là khai gian (luật đã chặn, đây là lớp chặn thứ hai): không tính
      if (an && an.at < K.s - 1500) an = null;
      const ok = !!(an && K.c.includes(an.a));
      const ms = an ? an.at - K.s - pausedMs(q, an.at) : null;
      let pts = points(ok, ms, Q.time, Q.pts), b = 0;
      if (Q.pts) { x.k = ok ? x.k + 1 : 0; if (ok && meta.streak) b = streakBonus(x.k); }
      pts += b; x.s += pts; if (ok) x.ok++;
      x.q[q] = { a: an ? an.a : null, ok, pts, b, ms };
    });
  });
  const list = Object.values(by).sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
  list.forEach((x, i) => { x.r = i && list[i - 1].s === x.s ? list[i - 1].r : i + 1; });
  return { by, list, n: list.length };
}

function csv() {
  const res = compute(), qs = quiz.qs;
  const head = ['Hạng', 'Tên', 'Tổng điểm', 'Số câu đúng'];
  qs.forEach((Q, i) => { head.push('Câu ' + (i + 1) + ' chọn', 'Câu ' + (i + 1) + ' đúng/sai', 'Câu ' + (i + 1) + ' điểm', 'Câu ' + (i + 1) + ' thời gian (giây)'); });
  const rows = [head];
  res.list.forEach((x) => {
    const row = [x.r, x.name, x.s, x.ok];
    qs.forEach((Q, i) => { const it = x.q[i] || {}; row.push(it.a == null ? '' : LETTERS[it.a], it.a == null ? 'không trả lời' : it.ok ? 'đúng' : 'sai', it.pts || 0, it.ms == null ? '' : (Math.max(0, it.ms) / 1000).toFixed(2)); });
    rows.push(row);
  });
  const txt = '﻿' + rows.map((r) => r.map((c) => { const s = String(c); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  const d = new Date(), pad = (n) => ('0' + n).slice(-2);
  a.download = 'ket-qua-' + (meta.title || 'quiz').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------- điều khiển ----------
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
  if ((e.key === ' ' || e.key === 'Enter') && PIN && state.phase && state.phase !== 'end') {
    e.preventDefault();
    if (state.phase === 'lobby' && !Object.keys(players).length) return;
    next();
  }
  if (e.key === 'f' || e.key === 'F') full();
  if (e.key === 't' || e.key === 'T') nextTheme();
  if ((e.key === 'p' || e.key === 'P') && PIN) { if (state.phase === 'answer') pause(); else if (isPaused()) unpause(); }
});
function full() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
$('bFull').onclick = full;
$('bTheme').onclick = nextTheme;
const pref = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch (e) { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
function paintCtl() { $('bMusic').style.opacity = Sound.music && Sound.musicVol > 0 ? 1 : 0.4; $('bSfx').style.opacity = Sound.sfx ? 1 : 0.4; }
Sound.setSfx(pref('qz.sfx', true));
const musicWanted = pref('qz.music', true);
function musicFor() { const p = state.phase; Sound.mode(p === 'lobby' ? 'lobby' : p === 'answer' ? 'q' : null); }
function setMusicOn(v) { Sound.setMusic(v); if (v) musicFor(); setPref('qz.music', v); paintCtl(); }
// bảng âm lượng: bấm 🎵 để mở / đóng
const numPref = (k, d) => { try { const v = localStorage.getItem(k); return v == null || isNaN(+v) ? d : +v; } catch (e) { return d; } };
Sound.setMusicVol(numPref('qz.mvol', 70)); Sound.setSfxVol(numPref('qz.svol', 70));
const vp = document.createElement('div'); vp.className = 'volpop'; vp.hidden = true;
vp.innerHTML = '<div class="vh">Âm thanh <small>· mỗi theme có nhạc riêng</small></div>' +
  '<div class="vr"><label><input type="checkbox" id="vMusic"> 🎵 Nhạc nền</label><div class="vs"><input type="range" id="vMVol" min="0" max="100" step="5" aria-label="Âm lượng nhạc nền"><b id="vMN"></b></div></div>' +
  '<div class="vr"><label><input type="checkbox" id="vSfx"> 🔔 Âm báo</label><div class="vs"><input type="range" id="vSVol" min="0" max="100" step="5" aria-label="Âm lượng âm báo"><b id="vSN"></b></div></div>';
document.body.appendChild(vp);
function paintVol() { $('vMusic').checked = Sound.music; $('vSfx').checked = Sound.sfx; $('vMVol').value = Sound.musicVol; $('vSVol').value = Sound.sfxVol; $('vMN').textContent = Sound.musicVol; $('vSN').textContent = Sound.sfxVol; }
$('vMusic').onchange = (e) => setMusicOn(e.target.checked);
$('vSfx').onchange = (e) => { Sound.setSfx(e.target.checked); setPref('qz.sfx', Sound.sfx); paintCtl(); };
$('vMVol').oninput = (e) => { Sound.setMusicVol(e.target.value); $('vMN').textContent = Sound.musicVol; try { localStorage.setItem('qz.mvol', Sound.musicVol); } catch (x) {} if (!Sound.music && Sound.musicVol > 0) setMusicOn(true); paintVol(); };
let pvT = 0;
$('vSVol').oninput = (e) => { Sound.setSfxVol(e.target.value); $('vSN').textContent = Sound.sfxVol; try { localStorage.setItem('qz.svol', Sound.sfxVol); } catch (x) {} clearTimeout(pvT); pvT = setTimeout(() => Sound.preview(), 150); };
$('bMusic').onclick = (e) => { e.stopPropagation(); vp.hidden = !vp.hidden; if (!vp.hidden) paintVol(); };
vp.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => { vp.hidden = true; if (vp.contains(document.activeElement)) document.activeElement.blur(); });
['vMVol', 'vSVol', 'vMusic', 'vSfx'].forEach((id) => $(id).addEventListener('change', (e) => e.target.blur()));
$('bSfx').onclick = () => { Sound.setSfx(!Sound.sfx); setPref('qz.sfx', Sound.sfx); paintCtl(); if (!vp.hidden) paintVol(); };
// trình duyệt chỉ cho phát âm thanh sau khi người dùng bấm/chạm
function firstGesture() { document.removeEventListener('pointerdown', firstGesture); document.removeEventListener('keydown', firstGesture); Sound.unlock(); if (musicWanted && !Sound.music) { Sound.setMusic(true); musicFor(); } paintCtl(); }
document.addEventListener('pointerdown', firstGesture);
document.addEventListener('keydown', firstGesture);
paintCtl();
async function keepAwake() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (!document.hidden && PIN) keepAwake(); });

bgfx(14);
boot();
