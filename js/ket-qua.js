/* Minto Quiz — Lịch sử kết quả (chỉ giáo viên).
   Mỗi ván chơi xong, màn host lưu một bản tổng kết vào Firestore: quizResults/{ngày-PIN}.
   Trang này xem lại từng buổi và cộng dồn điểm theo tên học sinh. */
import { $, esc, isTeacher } from './common.js?v=5';

const COL = 'quizResults', GOP = '_gop';
let FX = null, all = [], gop = {}, tab = 'buoi', pick = null, q = '', open = {};
const app = $('app');
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }
const pad = (n) => ('0' + n).slice(-2);
function day(ms) { const d = new Date(ms); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
function time(ms) { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
// Khoá tên: bỏ dấu, chữ thường, gộp khoảng trắng. "Ngọc  Anh" và "ngoc anh" là cùng một bạn.
function key(name) { return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim(); }
function owner(k) { let x = k, n = 0; while (gop[x] && n++ < 20) x = gop[x]; return x; }

async function boot() {
  const M = await new Promise((ok) => { (function w() { window.MACC ? ok(window.MACC) : setTimeout(w, 100); })(); });
  const fb = await M.ready(); await fb.auth.authStateReady();
  const u = fb.auth.currentUser;
  if (!u || !isTeacher(u.email)) {
    app.innerHTML = '<div class="card" style="max-width:440px;margin:8vh auto;text-align:center"><h2>Trang dành cho giáo viên</h2><p class="muted">' + (u ? 'Tài khoản ' + esc(u.email) + ' không có quyền.' : 'Đăng nhập Google bằng tài khoản giáo viên để xem kết quả.') + '</p><button class="btn pri" id="gIn">Đăng nhập Google</button></div>';
    $('gIn').onclick = () => M.quick();
    window.MACCPAINT = () => { const x = M.user(); if (x && isTeacher(x.email)) location.reload(); };
    return;
  }
  FX = await M.fs();
  await load();
}

async function load() {
  app.innerHTML = '<div class="muted">Đang tải…</div>';
  try {
    const F = FX.F, s = await F.getDocs(F.collection(FX.db, COL));
    all = []; gop = {};
    s.forEach((d) => { if (d.id === GOP) gop = (d.data() || {}).map || {}; else all.push({ id: d.id, ...d.data() }); });
    all.sort((a, b) => (b.at || 0) - (a.at || 0));
    if (!pick) pick = new Set(all.map((x) => x.id));
    render();
  } catch (e) {
    console.error(e);
    app.innerHTML = '<div class="card err">Không đọc được lịch sử (' + esc(e.code || e.message) + ').' +
      (e.code === 'permission-denied' ? '<br><span class="muted">Thầy cần thêm luật Firestore cho <code>quizResults</code> (xem FIREBASE.md, bước 3).</span>' : '') + '</div>';
  }
}

function render() {
  app.innerHTML = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h1 style="margin:0;flex:1">Lịch sử kết quả</h1>' +
    '<div class="tabs"><button class="btn sm' + (tab === 'buoi' ? ' pri' : '') + '" data-t="buoi">Từng buổi</button><button class="btn sm' + (tab === 'tong' ? ' pri' : '') + '" data-t="tong">Cộng dồn</button></div></div>' +
    '<p class="muted">Mỗi ván chơi xong được lưu tự động. Chỉ tài khoản giáo viên xem được trang này.</p>' +
    '<div id="body"></div>';
  app.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { tab = b.dataset.t; render(); }; });
  if (!all.length) { $('body').innerHTML = '<div class="card muted">Chưa có buổi nào. Chơi xong một ván trên màn host là kết quả hiện ở đây.</div>'; return; }
  if (tab === 'buoi') sessions(); else total();
}

// ---------- từng buổi ----------
function sessions() {
  let last = '';
  $('body').innerHTML = '<div class="qlist">' + all.map((x) => {
    const d = day(x.at), P = x.players || [], top = P.filter((p) => p.r <= 3).slice(0, 3);
    const h = d !== last ? '<h3 style="margin:14px 0 2px">' + d + '</h3>' : ''; last = d;
    return h + '<div class="card"><div class="qrow"><div class="t"><b>' + esc(x.title || 'Minto Quiz') + '</b><span class="muted">' + time(x.at) + ' · ' + P.length + ' bạn · ' + (x.nq || 0) + ' câu' +
      (top.length ? ' · 🏆 ' + top.map((p) => esc(p.name)).join(', ') : '') + '</span></div>' +
      '<button class="btn sm" data-open="' + esc(x.id) + '">' + (open[x.id] ? 'Thu gọn' : 'Xem') + '</button></div>' +
      (open[x.id] ? table(x) : '') + '</div>';
  }).join('') + '</div>';
  $('body').querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => { open[b.dataset.open] = !open[b.dataset.open]; sessions(); }; });
  $('body').querySelectorAll('[data-csv]').forEach((b) => { b.onclick = () => { const x = all.find((y) => y.id === b.dataset.csv); csvOne(x); }; });
  $('body').querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => del(b.dataset.del); });
}
function table(x) {
  return '<div class="tblw"><table class="tbl"><thead><tr><th>Hạng</th><th>Tên</th><th class="n">Điểm</th><th class="n">Câu đúng</th></tr></thead><tbody>' +
    (x.players || []).map((p) => '<tr><td>' + (p.r <= 3 ? ['', '🥇', '🥈', '🥉'][p.r] : p.r) + '</td><td>' + esc(p.name) + '</td><td class="n">' + p.s + '</td><td class="n">' + p.ok + '/' + (x.nq || 0) + '</td></tr>').join('') +
    '</tbody></table></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" data-csv="' + esc(x.id) + '">⬇ CSV</button><span style="flex:1"></span><button class="btn sm danger" data-del="' + esc(x.id) + '">Xoá buổi này</button></div>';
}
async function del(id) {
  const x = all.find((y) => y.id === id); if (!x) return;
  if (!confirm('Xoá kết quả "' + (x.title || '') + '" ngày ' + day(x.at) + '? Không khôi phục được.')) return;
  try { await FX.F.deleteDoc(FX.F.doc(FX.db, COL, id)); all = all.filter((y) => y.id !== id); if (pick) pick.delete(id); toast('Đã xoá.'); render(); } catch (e) { toast('Lỗi: ' + (e.code || e.message)); }
}

// ---------- cộng dồn ----------
function shown() { const t = key(q); return all.filter((x) => !t || key(x.title).includes(t)); }
function sum() {
  const by = {};
  all.filter((x) => pick.has(x.id)).forEach((x) => {
    (x.players || []).forEach((p) => {
      const k = owner(key(p.name)); if (!k) return;
      const o = by[k] || (by[k] = { k, names: {}, n: 0, s: 0, ok: 0, nq: 0, top: 0, win: 0 });
      o.names[p.name] = (o.names[p.name] || 0) + 1;
      o.n++; o.s += p.s || 0; o.ok += p.ok || 0; o.nq += x.nq || 0;
      if (p.r <= 3) o.top++; if (p.r === 1) o.win++;
    });
  });
  const L = Object.values(by).map((o) => { o.name = Object.entries(o.names).sort((a, b) => b[1] - a[1] || (b[0] !== key(b[0])) - (a[0] !== key(a[0])))[0][0]; o.alias = Object.keys(o.names).filter((n) => n !== o.name); return o; });
  L.sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
  L.forEach((o, i) => { o.r = i && L[i - 1].s === o.s ? L[i - 1].r : i + 1; });
  return L;
}
function total() {
  const S = shown(), L = sum(), nSel = all.filter((x) => pick.has(x.id)).length;
  const merged = Object.keys(gop).length;
  $('body').innerHTML =
    '<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer"><b>Chọn buổi để cộng</b> <span class="muted">· đang cộng ' + nSel + '/' + all.length + ' buổi</span></summary>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><input id="q" placeholder="Lọc theo tên bộ câu hỏi…" value="' + esc(q) + '" style="flex:1;min-width:200px;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px">' +
    '<button class="btn sm" id="bAll">Chọn các buổi đang hiện</button><button class="btn sm" id="bNone">Bỏ chọn hết</button></div>' +
    '<div class="picks">' + S.map((x) => '<label><input type="checkbox" data-p="' + esc(x.id) + '"' + (pick.has(x.id) ? ' checked' : '') + '> ' + day(x.at) + ' ' + time(x.at) + ' · ' + esc(x.title || 'Minto Quiz') + ' <span class="muted">(' + (x.players || []).length + ' bạn)</span></label>').join('') + '</div></details>' +
    '<p class="muted" style="margin:6px 0 10px">Tên được gộp khi giống nhau sau khi bỏ dấu và chữ hoa (ví dụ "Ngọc Anh" và "ngoc anh"). Bạn nào gõ khác hẳn mỗi lần thì tick các dòng đó rồi bấm <b>Gộp</b>.</p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn sm" id="bGop" disabled>Gộp tên đã chọn</button>' + (merged ? '<button class="btn sm" id="bUn">Bỏ hết các lần gộp (' + merged + ')</button>' : '') + '<span style="flex:1"></span><button class="btn sm pri" id="bCsv">⬇ Tải CSV cộng dồn</button></div>' +
    (L.length ? '<div class="tblw"><table class="tbl"><thead><tr><th></th><th>Hạng</th><th>Tên</th><th class="n">Số buổi</th><th class="n">Tổng điểm</th><th class="n">TB/buổi</th><th class="n">Top 1</th><th class="n">Top 3</th><th class="n">Câu đúng</th></tr></thead><tbody>' +
      L.map((o) => '<tr><td><input type="checkbox" data-g="' + esc(o.k) + '"></td><td>' + o.r + '</td><td>' + esc(o.name) + (o.alias.length ? '<div class="muted" style="font-size:13px">còn gõ: ' + o.alias.map(esc).join(', ') + '</div>' : '') + '</td><td class="n">' + o.n + '</td><td class="n"><b>' + o.s + '</b></td><td class="n">' + Math.round(o.s / o.n) + '</td><td class="n">' + (o.win || '') + '</td><td class="n">' + (o.top || '') + '</td><td class="n">' + o.ok + '/' + o.nq + '</td></tr>').join('') +
      '</tbody></table></div>' : '<div class="card muted">Chưa chọn buổi nào.</div>');
  const qi = $('q'); qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; total(); const n = $('q'); n.focus(); n.setSelectionRange(pos, pos); n.closest('details').open = true; };
  $('bAll').onclick = () => { S.forEach((x) => pick.add(x.id)); total(); $('q').closest('details').open = true; };
  $('bNone').onclick = () => { pick.clear(); total(); $('q').closest('details').open = true; };
  $('body').querySelectorAll('[data-p]').forEach((c) => { c.onchange = () => { if (c.checked) pick.add(c.dataset.p); else pick.delete(c.dataset.p); total(); $('q').closest('details').open = true; }; });
  const g = () => [...$('body').querySelectorAll('[data-g]:checked')].map((c) => c.dataset.g);
  $('body').querySelectorAll('[data-g]').forEach((c) => { c.onchange = () => { $('bGop').disabled = g().length < 2; }; });
  $('bGop').onclick = () => merge(g(), L);
  if (merged) $('bUn').onclick = async () => { if (!confirm('Bỏ hết các lần gộp tên?')) return; gop = {}; await saveGop(); total(); };
  $('bCsv').onclick = () => csvTotal(L);
}
async function merge(ks, L) {
  if (ks.length < 2) return;
  const rows = ks.map((k) => L.find((o) => o.k === k)).filter(Boolean).sort((a, b) => b.n - a.n);
  const main = rows[0];
  if (!confirm('Gộp ' + rows.map((o) => '"' + o.name + '"').join(', ') + ' thành một bạn tên "' + main.name + '"?')) return;
  rows.slice(1).forEach((o) => { gop[o.k] = main.k; });
  await saveGop(); total();
}
async function saveGop() {
  try { await FX.F.setDoc(FX.F.doc(FX.db, COL, GOP), { map: gop, upd: Date.now() }); toast('Đã lưu.'); } catch (e) { toast('Lỗi: ' + (e.code || e.message)); }
}

// ---------- CSV ----------
function dl(rows, name) {
  const txt = '\ufeff' + rows.map((r) => r.map((c) => { const s = String(c == null ? '' : c); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = name.replace(/[^\p{L}\p{N}.]+/gu, '-').slice(0, 80);
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function stamp(ms) { const d = new Date(ms); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
function csvOne(x) {
  const rows = [['Hạng', 'Tên', 'Điểm', 'Câu đúng', 'Số câu']];
  (x.players || []).forEach((p) => rows.push([p.r, p.name, p.s, p.ok, x.nq || 0]));
  dl(rows, 'ket-qua-' + (x.title || 'quiz') + '-' + stamp(x.at) + '.csv');
}
function csvTotal(L) {
  const rows = [['Hạng', 'Tên', 'Các cách gõ khác', 'Số buổi', 'Tổng điểm', 'Trung bình mỗi buổi', 'Số lần top 1', 'Số lần top 3', 'Câu đúng', 'Tổng số câu']];
  L.forEach((o) => rows.push([o.r, o.name, o.alias.join(' / '), o.n, o.s, Math.round(o.s / o.n), o.win, o.top, o.ok, o.nq]));
  dl(rows, 'cong-don-' + stamp(Date.now()) + '.csv');
}

boot();
