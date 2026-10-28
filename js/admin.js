/* Minto Quiz — soạn bộ câu hỏi (chỉ giáo viên) */
import { $, esc, isTeacher, COLORS, SHAPES, LETTERS, THEMES, MUSIC_THEMES, MUSIC_PART, musicPartId, fetchTrack } from './common.js?v=14';

const QP = window.QP;
const LIB = {
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
};
const loaded = {};
function lib(name) {
  if (!loaded[name]) loaded[name] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = LIB[name]; s.onload = ok; s.onerror = () => { delete loaded[name]; no(new Error('Không tải được thư viện đọc file')); }; document.head.appendChild(s); });
  return loaded[name];
}

let FX = null, list = [], cur = null; // cur: { id, title, qs }
const app = $('app');
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }
function tpl(id) { app.innerHTML = ''; app.appendChild($(id).content.cloneNode(true)); }

async function boot() {
  const M = await new Promise((ok) => { (function w() { window.MACC ? ok(window.MACC) : setTimeout(w, 100); })(); });
  const fb = await M.ready(); await fb.auth.authStateReady();
  const u = fb.auth.currentUser;
  if (!u || !isTeacher(u.email)) {
    app.innerHTML = '<div class="card" style="max-width:440px;margin:8vh auto;text-align:center"><h2>Trang dành cho giáo viên</h2><p class="muted">' + (u ? 'Tài khoản ' + esc(u.email) + ' không có quyền.' : 'Đăng nhập Google bằng tài khoản giáo viên để soạn bộ câu hỏi.') + '</p><button class="btn pri" id="gIn">Đăng nhập Google</button></div>';
    $('gIn').onclick = () => M.quick();
    window.MACCPAINT = () => { const x = M.user(); if (x && isTeacher(x.email)) location.reload(); };
    return;
  }
  FX = await M.fs();
  if (window.MNEWS) { $('bNews').hidden = false; $('bNews').onclick = () => window.MNEWS.open(); window.MNEWS.auto(); }
  showList();
}

// ---------- danh sách ----------
async function showList() {
  cur = null; tpl('tList');
  $('bNew').onclick = () => edit({ id: null, title: '', qs: [] });
  $('list').innerHTML = '<div class="muted">Đang tải…</div>';
  showMusic();
  try {
    const F = FX.F, s = await F.getDocs(F.collection(FX.db, 'quizzes'));
    list = []; s.forEach((d) => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.upd || 0) - (a.upd || 0));
  } catch (e) { if (!$('list')) return; $('list').innerHTML = '<div class="err">Không đọc được (' + esc(e.code || e.message) + '). Thầy đã dán luật Firestore cho quizzes chưa?</div>'; return; }
  if (!$('list')) return; // thầy đã bấm sang trang khác trong lúc đang tải
  $('list').innerHTML = list.length ? list.map((q) => '<div class="card qrow"><div class="t"><b>' + esc(q.title || '(chưa đặt tên)') + '</b><span class="muted">' + (q.qs || []).length + ' câu' + (q.upd ? ' · sửa ' + new Date(q.upd).toLocaleString('vi-VN') : '') + '</span></div>' +
    '<a class="btn sm pri" href="host.html?quiz=' + encodeURIComponent(q.id) + '">Tạo phòng</a><button class="btn sm" data-e="' + esc(q.id) + '">Sửa</button><button class="btn sm" data-d="' + esc(q.id) + '">Nhân bản</button><button class="btn sm danger" data-x="' + esc(q.id) + '">Xoá</button></div>').join('')
    : '<div class="card muted">Chưa có bộ câu hỏi nào. Bấm <b>+ Bộ mới</b> rồi tải file lên.</div>';
  const by = (id) => list.find((x) => x.id === id);
  app.querySelectorAll('[data-e]').forEach((b) => { b.onclick = () => { const q = by(b.dataset.e); edit({ id: q.id, title: q.title, qs: JSON.parse(JSON.stringify(q.qs || [])) }); }; });
  app.querySelectorAll('[data-d]').forEach((b) => { b.onclick = async () => { if (b.disabled) return; b.disabled = true; const q = by(b.dataset.d); await save({ id: null, title: (q.title || '') + ' (bản sao)', qs: q.qs || [] }).catch(err); showList(); }; });
  app.querySelectorAll('[data-x]').forEach((b) => { b.onclick = async () => { const q = by(b.dataset.x); if (!confirm('Xoá bộ "' + (q.title || '') + '"? Không khôi phục được.')) return; try { await FX.F.deleteDoc(FX.F.doc(FX.db, 'quizzes', q.id)); } catch (e) { return err(e); } await dropImgs(q, list.filter((x) => x.id !== q.id)); showList(); }; });
}
// ---------- nhạc theme: thầy tải file nhạc lên Firestore quizMusic (chỉ tài khoản thầy đọc được), màn host tự tải về để phát ----------
let mPlay = null, mBusy = false;
const mName = (id) => (THEMES.find((t) => t.id === id) || {}).n || id;
const uiErr = (t) => { const e = new Error(t); e.ui = 1; return e; };
async function showMusic() {
  const box = $('music'); if (!box) return;
  if (mPlay) { mPlay.a.pause(); URL.revokeObjectURL(mPlay.url); mPlay = null; }
  const F = FX.F, info = {};
  try { await Promise.all(MUSIC_THEMES.map(async (id) => { const d = await F.getDoc(F.doc(FX.db, 'quizMusic', id)); info[id] = d.exists() ? d.data() : null; })); }
  catch (e) { if ($('music')) box.innerHTML = '<div class="err">Không đọc được nhạc theme (' + esc(e.code || e.message) + '). Thầy đã dán luật Firestore cho quizMusic chưa?</div>'; return; }
  if (!$('music')) return;
  mBusy = false;
  box.innerHTML = MUSIC_THEMES.map((id) => { const m = info[id];
    return '<div class="qrow"><div class="t"><b>' + esc(mName(id)) + '</b><span class="muted">' + (m ? '🎵 ' + esc(m.name || 'đã có nhạc') + ' · ' + (m.size / 1048576).toFixed(1) + ' MB' : 'Chưa có nhạc — đang dùng nhạc tự tạo') + '</span></div>' +
      (m ? '<button class="btn sm" data-mp="' + id + '">▶ Nghe thử</button>' : '') +
      '<label class="btn sm' + (m ? '' : ' pri') + '" style="cursor:pointer">' + (m ? 'Đổi bài' : 'Tải nhạc lên') + '<input type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav" data-mu="' + id + '" hidden></label>' +
      (m ? '<button class="btn sm danger" data-mx="' + id + '">Xoá</button>' : '') + '</div>'; }).join('') +
    '<div id="mMsg" class="muted" role="status" style="margin-top:6px"></div>';
  const msg = (t) => { if ($('mMsg')) $('mMsg').textContent = t; };
  const lock = (on) => { mBusy = on; box.querySelectorAll('button,input').forEach((b) => { b.disabled = on; }); };
  box.querySelectorAll('[data-mu]').forEach((inp) => { inp.onchange = async () => {
    const f = inp.files[0]; inp.value = ''; if (!f || mBusy) return;
    lock(true);
    try { await uploadMusic(inp.dataset.mu, f, msg); toast('Đã lưu nhạc cho theme ' + mName(inp.dataset.mu) + ' ✓'); showMusic(); }
    catch (e) { lock(false); msg(''); if (e.ui) toast(e.message); else err(e); }
  }; });
  box.querySelectorAll('[data-mx]').forEach((b) => { b.onclick = async () => {
    const id = b.dataset.mx; if (mBusy || !confirm('Xoá nhạc của theme ' + mName(id) + '? Theme này sẽ quay về nhạc tự tạo.')) return;
    lock(true);
    try { await dropMusic(id); showMusic(); } catch (e) { lock(false); err(e); }
  }; });
  box.querySelectorAll('[data-mp]').forEach((b) => { b.onclick = async () => {
    const id = b.dataset.mp, was = mPlay && mPlay.id;
    if (mPlay) { mPlay.a.pause(); URL.revokeObjectURL(mPlay.url); mPlay = null; box.querySelectorAll('[data-mp]').forEach((x) => { x.textContent = '▶ Nghe thử'; }); }
    if (was === id) return;
    b.textContent = 'Đang tải…';
    try {
      const t = await fetchTrack(id); if (!t) throw uiErr('Không tìm thấy nhạc.');
      if (!$('music') || mPlay) { URL.revokeObjectURL(t.url); return; }
      const a = new Audio(t.url); a.volume = Math.min(1, (t.g || 0.2) * 3); mPlay = { id, a, url: t.url };
      await a.play(); b.textContent = '⏸ Dừng';
    } catch (e) { b.textContent = '▶ Nghe thử'; if (e.ui) toast(e.message); else err(e); }
  }; });
}
// đo độ to của bài (giống cách đã cân 3 bài cũ) để các theme nghe đều tai
async function loudness(buf) {
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return 0;
  const c = new C();
  try {
    const ab = await new Promise((ok, no) => { const p = c.decodeAudioData(buf, ok, no); if (p && p.then) p.then(ok, no); });
    let sum = 0, n = 0;
    for (let ch = 0; ch < ab.numberOfChannels; ch++) { const d = ab.getChannelData(ch); for (let i = 0; i < d.length; i += 3) { sum += d[i] * d[i]; n++; } }
    const rms = Math.sqrt(sum / Math.max(1, n));
    return rms > 0 ? Math.min(1, Math.max(0.02, 0.0318 / rms)) : 0;
  } finally { if (c.close) c.close().catch(() => {}); }
}
async function uploadMusic(id, file, msg) {
  if (file.size > 8 * 1048576) throw uiErr('File nhạc lớn quá (tối đa 8 MB). Thầy cắt ngắn hoặc nén lại rồi thử nha.');
  if (file.size < 1000) throw uiErr('File này không phải nhạc đọc được.');
  msg('Đang đọc file nhạc…');
  const buf = await file.arrayBuffer();
  let g = 0;
  try { g = await loudness(buf.slice(0)); } catch (e) { throw uiErr('File này không phải nhạc trình duyệt phát được (dùng .mp3 hoặc .m4a).'); }
  const u8 = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  const b64 = btoa(bin), parts = [];
  for (let i = 0; i < b64.length; i += MUSIC_PART) parts.push(b64.slice(i, i + MUSIC_PART));
  const F = FX.F, at = Date.now(), meta = F.doc(FX.db, 'quizMusic', id);
  const old = await F.getDoc(meta);
  let done = 0;
  try {
    for (let i = 0; i < parts.length; i++) { msg('Đang tải nhạc lên… ' + Math.round(i / parts.length * 100) + '%'); await F.setDoc(F.doc(FX.db, 'quizMusic', musicPartId(id, at, i)), { d: parts[i] }); done++; }
    await F.setDoc(meta, { n: parts.length, at, type: file.type || 'audio/mpeg', g: g || 0.2, size: file.size, name: file.name.slice(0, 120) });
  } catch (e) {
    await Promise.all(Array.from({ length: done }, (_, i) => F.deleteDoc(F.doc(FX.db, 'quizMusic', musicPartId(id, at, i))).catch(() => {})));
    throw e;
  }
  if (old.exists()) await dropParts(id, old.data());
  msg('');
}
function dropParts(id, m) {
  const F = FX.F;
  return Promise.all(Array.from({ length: Math.min(20, m.n | 0) }, (_, i) => F.deleteDoc(F.doc(FX.db, 'quizMusic', musicPartId(id, m.at, i))).catch(() => {})));
}
async function dropMusic(id) {
  const F = FX.F, meta = F.doc(FX.db, 'quizMusic', id), d = await F.getDoc(meta);
  if (!d.exists()) return;
  await F.deleteDoc(meta); await dropParts(id, d.data());
}
function err(e) { console.error(e); toast('Lỗi: ' + ((e && (e.code || e.message)) || 'không rõ')); }

// ---------- soạn ----------
function edit(q) {
  cur = q; cur.imgs0 = imgsOf(q.qs); tpl('tEdit');
  $('title').value = q.title || '';
  $('title').oninput = () => { cur.title = $('title').value; dirty = true; };
  $('bBack').onclick = () => { if (dirty && !confirm('Có thay đổi chưa lưu. Vẫn quay lại?')) return; dirty = false; showList(); };
  $('bAdd').onclick = () => { cur.qs.push(QP.blank()); dirty = true; renderQs(); const el = $('qs').lastElementChild; if (el) el.scrollIntoView({ behavior: 'smooth' }); };
  $('bSave').onclick = () => doSave(false);
  $('bPlay').onclick = () => doSave(true);
  $('bXlsx').onclick = exportXlsx;
  $('file').onchange = (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; };
  $('bPaste').onclick = () => addParsed(QP.fromText($('paste').value), 'văn bản dán');
  const dz = $('drop');
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('on'); };
  dz.ondragleave = () => dz.classList.remove('on');
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('on'); const f = e.dataTransfer.files[0]; if (f) importFile(f); };
  dirty = false;
  renderQs();
}
let dirty = false;
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

async function importFile(f) {
  const name = f.name || '', ext = (name.split('.').pop() || '').toLowerCase();
  $('imp').textContent = 'Đang đọc ' + name + '…';
  try {
    let res;
    if (ext === 'xlsx' || ext === 'xls') {
      await lib('xlsx');
      const wb = window.XLSX.read(await f.arrayBuffer(), { type: 'array' });
      let best = null;
      wb.SheetNames.forEach((sn) => {
        const ws = wb.Sheets[sn]; if (!ws['!ref']) return;
        const r = QP.fromRows(window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true, raw: false }));
        const off = window.XLSX.utils.decode_range(ws['!ref']).s.r; // trang tính có thể không bắt đầu từ hàng 1
        r.qs.forEach((q) => { q.row += off; });
        if (!best || r.qs.length > best.qs.length) best = r;
      });
      if (!best) best = QP.fromRows([]);
      res = best;
    } else if (ext === 'csv') {
      res = QP.fromRows(QP.parseCSV(await f.text()));
    } else if (ext === 'docx') {
      await lib('mammoth');
      const out = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
      res = QP.fromText(out.value);
    } else if (ext === 'pdf') {
      await lib('pdf');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB.pdfWorker;
      const doc = await window.pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      let text = '';
      for (let p = 1; p <= doc.numPages; p++) {
        const tc = await (await doc.getPage(p)).getTextContent();
        let lastY = null;
        tc.items.forEach((it) => { const y = it.transform[5]; if (lastY != null && Math.abs(y - lastY) > 2) text += '\n'; else if (lastY != null && !/\s$/.test(text)) text += ' '; text += it.str; lastY = y; if (it.hasEOL) { text += '\n'; lastY = null; } });
        text += '\n';
      }
      res = QP.fromText(text);
    } else if (ext === 'txt' || f.type.startsWith('text/')) {
      res = QP.fromText(await f.text());
    } else throw new Error('Chưa hỗ trợ loại file .' + ext);
    addParsed(res, name);
  } catch (e) { console.error(e); $('imp').innerHTML = '<span class="err">Không đọc được ' + esc(name) + ': ' + esc(e.message || e) + '</span>'; }
}

function addParsed(res, src) {
  if (!res.qs.length) { $('imp').innerHTML = '<span class="err">' + esc(res.errs.join(' ') || 'Không tìm thấy câu hỏi nào.') + '</span>'; return; }
  let mode = 'add';
  if (cur.qs.length) {
    if (confirm('Bộ này đã có ' + cur.qs.length + ' câu.\nThêm ' + res.qs.length + ' câu mới vào CUỐI bộ?\n\n(Huỷ để chọn cách khác)')) mode = 'add';
    else if (confirm('Thay TOÀN BỘ ' + cur.qs.length + ' câu cũ bằng ' + res.qs.length + ' câu mới?\nCâu cũ sẽ mất khi bấm Lưu.\n\n(Huỷ = không nhập gì)')) mode = 'replace';
    else { $('imp').textContent = 'Đã huỷ, không nhập câu nào.'; return; }
  }
  if (mode === 'replace') cur.qs = [];
  res.qs.forEach((q) => { q.src = q.row ? 'dòng ' + q.row + ' · ' + src : src; delete q.row; cur.qs.push(q); });
  if (!cur.title && res.title) { cur.title = res.title; $('title').value = cur.title; }
  if (!cur.title && /\.(xlsx|xls|csv|txt|docx|pdf)$/i.test(src)) { cur.title = src.replace(/\.[^.]+$/, '').replace(/^Kahoot\s*-\s*/i, ''); $('title').value = cur.title; }
  dirty = true;
  $('imp').textContent = '✓ Đã đọc ' + res.qs.length + ' câu từ ' + src + '.' + (res.skipped ? ' Đã bỏ qua ' + res.skipped + ' đoạn văn dẫn (đoạn văn dài nên chụp thành hình rồi thêm vào câu).' : '') + ' Kiểm tra lại bên dưới rồi bấm Lưu.';
  renderQs();
}

function renderQs() {
  const box = $('qs');
  box.innerHTML = cur.qs.map((q, i) => qHtml(q, i)).join('') || '<div class="card muted">Chưa có câu nào. Tải file lên hoặc bấm + Thêm câu.</div>';
  box.querySelectorAll('.qe').forEach((el) => bindQ(el, +el.dataset.i));
  summary();
  loadThumbs();
}
function qHtml(q, i) {
  const ck = QP.check(q);
  return '<div class="qe' + (ck.err.length ? ' bad' : '') + '" data-i="' + i + '"><div class="hd"><span class="num">' + (i + 1) + '.</span>' +
    '<select data-f="time" title="Thời gian">' + QP.TIMES.map((t) => '<option value="' + t + '"' + (t === q.time ? ' selected' : '') + '>' + t + ' giây</option>').join('') + '</select>' +
    '<select data-f="pts" title="Điểm"><option value="1"' + (q.pts === 1 ? ' selected' : '') + '>Điểm thường</option><option value="2"' + (q.pts === 2 ? ' selected' : '') + '>Gấp đôi</option><option value="0"' + (q.pts === 0 ? ' selected' : '') + '>Không tính điểm</option></select>' +
    (q.src ? '<small class="muted">' + esc(q.src) + '</small>' : '') + '<span style="flex:1"></span>' +
    '<button class="btn sm" data-a="up" title="Lên"' + (i ? '' : ' disabled') + '>↑</button><button class="btn sm" data-a="dn" title="Xuống"' + (i < cur.qs.length - 1 ? '' : ' disabled') + '>↓</button>' +
    '<button class="btn sm" data-a="dup" title="Nhân đôi câu này">⧉</button><button class="btn sm danger" data-a="del" title="Xoá câu">🗑</button></div>' +
    '<textarea data-f="t" rows="2" placeholder="Nội dung câu hỏi"' + (q.t.length > QP.MAXQ ? ' class="long"' : '') + '>' + esc(q.t) + '</textarea>' +
    '<div class="imgrow">' + (q.img ? '<img class="qthumb" data-img="' + esc(q.img) + '" alt="Hình câu ' + (i + 1) + '"' + (IMGS[q.img] ? ' src="' + IMGS[q.img] + '"' : '') + '><button class="btn sm danger" data-a="noimg">Bỏ hình</button><label class="btn sm">Đổi hình<input type="file" accept="image/*" data-f="img" hidden></label>'
      : '<label class="btn sm">🖼 Thêm hình (ví dụ Part 1)<input type="file" accept="image/*" data-f="img" hidden></label>') + '<span class="muted imgst"></span></div>' +
    '<div class="opts">' + [0, 1, 2, 3].map((k) => '<div class="opt k' + k + '"><span class="shape">' + SHAPES[k] + '</span><input type="text" data-o="' + k + '" value="' + esc(q.o[k] || '') + '" placeholder="Đáp án ' + LETTERS[k] + (k > 1 ? ' (không bắt buộc)' : '') + '"' + ((q.o[k] || '').length > QP.MAXA ? ' class="long"' : '') + '><label><input type="checkbox" data-c="' + k + '"' + (q.c.includes(k) ? ' checked' : '') + '>Đúng</label></div>').join('') + '</div>' +
    '<div class="msg">' + ck.err.map((e) => '<div class="err">⚠ ' + esc(e) + '</div>').join('') + ck.warn.map((e) => '<div style="color:var(--brand-ink)">• ' + esc(e) + '</div>').join('') + '</div></div>';
}
function bindQ(el, i) {
  const q = cur.qs[i];
  const refresh = () => { dirty = true; const ck = QP.check(q); el.classList.toggle('bad', !!ck.err.length); el.querySelector('.msg').innerHTML = ck.err.map((e) => '<div class="err">⚠ ' + esc(e) + '</div>').join('') + ck.warn.map((e) => '<div style="color:var(--brand-ink)">• ' + esc(e) + '</div>').join(''); summary(); };
  el.querySelector('[data-f=t]').oninput = (e) => { q.t = e.target.value; e.target.classList.toggle('long', QP.str(q.t).length > QP.MAXQ); refresh(); };
  el.querySelector('[data-f=time]').onchange = (e) => { q.time = +e.target.value; dirty = true; };
  el.querySelector('[data-f=pts]').onchange = (e) => { q.pts = +e.target.value; dirty = true; };
  el.querySelectorAll('[data-o]').forEach((inp) => { inp.oninput = () => { q.o[+inp.dataset.o] = inp.value; inp.classList.toggle('long', QP.str(inp.value).length > QP.MAXA); refresh(); }; });
  const fi = el.querySelector('[data-f=img]');
  if (fi) fi.onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const st = el.querySelector('.imgst'); st.textContent = 'Đang tải hình lên…';
    try { q.img = await uploadImg(f); dirty = true; renderQs(); toast('✓ Đã thêm hình cho câu ' + (i + 1) + '. Nhớ bấm Lưu.'); }
    catch (x) { console.error(x); st.textContent = '⚠ ' + (x.ui ? x.message : 'Chưa tải được hình (' + (x.code || x.message || 'lỗi') + ')'); }
  };
  el.querySelectorAll('[data-c]').forEach((cb) => { cb.onchange = () => { const k = +cb.dataset.c; q.c = q.c.filter((x) => x !== k); if (cb.checked) q.c.push(k); q.c.sort(); refresh(); }; });
  el.querySelectorAll('[data-a]').forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.a, L = cur.qs;
      if (a === 'up' && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
      if (a === 'dn' && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
      if (a === 'dup') L.splice(i + 1, 0, JSON.parse(JSON.stringify(q)));
      if (a === 'del') { if (!confirm('Xoá câu ' + (i + 1) + '?')) return; L.splice(i, 1); }
      if (a === 'noimg') delete q.img;
      dirty = true; renderQs();
    };
  });
}
// ---------- hình cho câu hỏi: thu nhỏ trên máy rồi lưu Firestore quizImg/{id} (chỉ thầy đọc được), chỉ hiện trên màn chiếu ----------
const IMGS = {};
function loadThumbs() {
  document.querySelectorAll('img[data-img]:not([src])').forEach(async (im) => {
    const id = im.dataset.img;
    try {
      if (!IMGS[id]) { const d = await FX.F.getDoc(FX.F.doc(FX.db, 'quizImg', id)); if (d.exists()) IMGS[id] = d.data().d; }
      if (IMGS[id]) im.src = IMGS[id]; else im.alt = '(không tìm thấy hình)';
    } catch (e) { im.alt = '(không tải được hình)'; }
  });
}
function shrink(file, max, q) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', q));
    };
    im.onerror = () => { URL.revokeObjectURL(url); const e = new Error('File này không phải hình đọc được (dùng .jpg, .png).'); e.ui = 1; no(e); };
    im.src = url;
  });
}
async function uploadImg(file) {
  let d = '';
  for (const [max, q] of [[1600, 0.85], [1280, 0.8], [1024, 0.72], [800, 0.65]]) { d = await shrink(file, max, q); if (d.length < 700000) break; }
  if (d.length >= 900000) { const e = new Error('Hình quá lớn, thầy cắt bớt rồi thử lại nha.'); e.ui = 1; throw e; }
  const F = FX.F, ref = F.doc(F.collection(FX.db, 'quizImg'));
  await F.setDoc(ref, { d, at: Date.now() });
  IMGS[ref.id] = d;
  return ref.id;
}
// xoá hình của bộ vừa xoá, trừ hình bộ khác còn dùng (bộ nhân bản dùng chung hình)
async function dropImgs(q, others) {
  const used = new Set(); others.forEach((x) => (x.qs || []).forEach((y) => { if (y.img) used.add(y.img); }));
  const ids = [...new Set((q.qs || []).map((y) => y.img).filter((x) => x && !used.has(x)))];
  await Promise.all(ids.map((id) => FX.F.deleteDoc(FX.F.doc(FX.db, 'quizImg', id)).catch(() => {})));
}
function summary() {
  const bad = [], warn = [];
  cur.qs.forEach((q, i) => { const c = QP.check(q); if (c.err.length) bad.push(i + 1); else if (c.warn.length) warn.push(i + 1); });
  $('sum').innerHTML = !cur.qs.length ? '' : (bad.length ? '<div class="card" style="border-color:var(--red);background:var(--red-soft)"><b class="err">' + bad.length + ' câu cần sửa trước khi lưu:</b> câu ' + bad.join(', ') + '</div>' : '<div class="card" style="background:var(--ok-soft);border-color:#bfe0b2">✓ ' + cur.qs.length + ' câu hợp lệ' + (warn.length ? ' · câu ' + warn.join(', ') + ' dài hơn giới hạn của Kahoot (vẫn chơi được ở đây)' : '') + '</div>');
}

function clean(qs) { return qs.map((q) => Object.assign({ t: QP.str(q.t), o: q.o.map((x) => QP.str(x)), c: q.c.slice(), time: q.time, pts: q.pts }, q.img ? { img: q.img } : {})); }
async function save(q) {
  const F = FX.F, ref = q.id ? F.doc(FX.db, 'quizzes', q.id) : F.doc(F.collection(FX.db, 'quizzes'));
  await F.setDoc(ref, { title: QP.str(q.title) || 'Bộ câu hỏi chưa đặt tên', qs: clean(q.qs), upd: Date.now(), at: F.serverTimestamp() });
  return ref.id;
}
const imgsOf = (qs) => new Set((qs || []).map((y) => y.img).filter(Boolean));
let saving = false;
async function doSave(play) {
  if (saving) return;
  const bad = cur.qs.filter((q) => QP.check(q).err.length).length;
  if (!cur.qs.length) return toast('Chưa có câu hỏi nào.');
  if (bad) { toast('Còn ' + bad + ' câu lỗi, sửa xong rồi lưu nhé.'); const el = document.querySelector('.qe.bad'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  saving = true; ['bSave', 'bPlay'].forEach((id) => { if ($(id)) $(id).disabled = true; });
  try {
    cur.id = await save(cur); dirty = false;
    // hình đã bỏ khỏi bộ này và không bộ nào khác dùng: xoá cho đỡ chật
    const now = imgsOf(cur.qs), gone = [...(cur.imgs0 || [])].filter((id) => !now.has(id));
    if (gone.length) await dropImgs({ qs: gone.map((img) => ({ img })) }, list.filter((x) => x.id !== cur.id));
    cur.imgs0 = now;
    toast('✓ Đã lưu');
    if (play) location.href = 'host.html?quiz=' + encodeURIComponent(cur.id);
  } catch (e) { err(e); }
  saving = false; ['bSave', 'bPlay'].forEach((id) => { if ($(id)) $(id).disabled = false; });
}

async function exportXlsx() {
  try {
    await lib('xlsx');
    const X = window.XLSX, ws = X.utils.aoa_to_sheet(QP.toRows(cur.title, clean(cur.qs)));
    ws['!cols'] = [{ wch: 4 }, { wch: 60 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Sheet1');
    X.writeFile(wb, 'Kahoot - ' + (QP.str(cur.title) || 'quiz').replace(/[\\/:*?"<>|]/g, '') + '.xlsx');
  } catch (e) { err(e); }
}

boot().catch(err);
