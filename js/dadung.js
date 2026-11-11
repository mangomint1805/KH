/* Minto Quiz — 📌 Bộ câu hỏi đã dùng với lớp nào (chỉ máy thầy đọc).
   Gom từ dữ liệu có sẵn, không thêm collection mới:
   - quizResults/{ngày-PIN}: ván trên lớp / Đào vàng (trường lop, fp có từ 05/11; ván cũ đoán lớp theo tên / lớp của bộ)
   - quizHW/{id}: bài về nhà (lop, qs)
   - quizResults/_dadung: thầy tự đánh dấu (dùng trên giấy, kiểm tra ngoài app), { m: [{ id, qz, title, lop, at, note, fp }] }
   Trùng nội dung: mỗi câu có một mã (fp) tính từ câu hỏi + đáp án đã chuẩn hoá (bỏ dấu, chữ hoa, thứ tự đáp án). */
import { esc, quizClass, classLabel, CLASSES } from './common.js?v=21';

export const MARK = '_dadung';
const KIND = { live: '▶ trên lớp', gold: '⛏️ Đào vàng', hw: '📝 về nhà', tay: '✋ đánh dấu tay' };
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); }
// mã một câu; câu quá ít chữ (vd. chế độ thi chỉ có "Question 32" + A/B/C) thì bỏ qua, tránh báo trùng nhầm
export function qfp(x) {
  const t = norm(x && x.t), o = ((x && x.o) || []).map(norm).filter(Boolean).sort();
  const body = (t.replace(/\b(question|cau|q)\b/g, '').replace(/\b\d+\b/g, '') + o.join('')).replace(/\s+/g, '');
  if (body.length < 16) return '';
  return hash(t + '|' + o.join('|'));
}
export function fps(qs) { return [...new Set((qs || []).map(qfp).filter(Boolean))]; }
export const dmy = (t) => { const d = new Date(t || 0); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + (d.getFullYear() !== new Date().getFullYear() ? '/' + d.getFullYear() : ''); };
const lopTxt = (u) => (u.lop ? 'Lớp ' + u.lop + (u.g ? ' (?)' : '') : 'Chưa rõ lớp');

// Đọc lịch sử dùng. quizzes: danh sách bộ đã tải (để lấy nội dung và lớp của bộ cho ván cũ).
export async function loadUses(F, db, quizzes) {
  const QZ = new Map((quizzes || []).map((q) => [q.id, q])), fpOf = new Map();
  const fpQ = (q) => { if (!fpOf.has(q.id)) fpOf.set(q.id, new Set(fps(q.qs))); return fpOf.get(q.id); };
  const uses = []; let marks = [];
  const [R, H] = await Promise.all([
    F.getDocs(F.collection(db, 'quizResults')).catch((e) => { console.warn('dadung quizResults', e); return null; }),
    F.getDocs(F.collection(db, 'quizHW')).catch((e) => { console.warn('dadung quizHW', e); return null; }),
  ]);
  if (R) R.forEach((d) => {
    const r = d.data() || {};
    if (d.id === MARK) { marks = Array.isArray(r.m) ? r.m : []; return; }
    if (d.id.startsWith('_')) return;
    const q = QZ.get(r.qz); let lop = typeof r.lop === 'string' ? r.lop : null, g = !!r.lopg;
    if (lop === null) { lop = quizClass({ title: String(r.title || '').replace(/^⛏️ /, '') }) || (q ? quizClass(q) : ''); g = !!lop; }
    uses.push({ qz: r.qz || '', title: String(r.title || '').replace(/^⛏️ /, ''), lop, g, at: r.at || r.saved || 0, kind: r.mode === 'gold' ? 'gold' : 'live', n: (r.players || []).length, fp: Array.isArray(r.fp) ? new Set(r.fp) : q ? fpQ(q) : new Set() });
  });
  if (H) H.forEach((d) => { const h = d.data() || {}; uses.push({ qz: h.qz || '', title: h.title || '', lop: typeof h.lop === 'string' ? h.lop : '', at: h.at || 0, kind: 'hw', fp: new Set(fps(h.qs)), hw: d.id }); });
  marks.forEach((m) => { if (m && m.qz) uses.push({ qz: m.qz, title: m.title || '', lop: m.lop || '', at: m.at || 0, kind: 'tay', note: m.note || '', id: m.id, fp: Array.isArray(m.fp) ? new Set(m.fp) : QZ.get(m.qz) ? fpQ(QZ.get(m.qz)) : new Set() }); });
  uses.sort((a, b) => b.at - a.at);
  return { uses, marks, fpQ, ok: !!R };
}

export const usesOf = (U, q) => U.uses.filter((u) => u.qz === q.id);
// bộ khác có nhiều câu trùng với q: ≥ 3 câu và (≥ một nửa bộ q hoặc ≥ 10 câu). Mỗi bộ / lớp giữ lần gần nhất.
export function overlaps(U, q, lop) {
  const mine = U.fpQ(q), T = mine.size, out = [], seen = new Set();
  if (T < 1) return out;
  U.uses.forEach((u) => {
    if (u.qz === q.id || (lop != null && u.lop !== lop)) return;
    const key = (u.qz || u.title) + '|' + u.lop; if (seen.has(key)) return;
    let n = 0; mine.forEach((f) => { if (u.fp.has(f)) n++; });
    if (n >= Math.min(3, T) && (n * 2 >= T || n >= 10)) { seen.add(key); out.push({ u, n, T }); }
  });
  return out;
}
// cảnh báo khi dùng bộ q cho lớp lop ('' = chưa chọn lớp: nhắc mọi lớp)
export function warnings(U, q, lop) {
  const L = lop || null, same = usesOf(U, q).filter((u) => !L || u.lop === L);
  return same.map((u) => (u.lop ? '<b>Lớp ' + esc(u.lop) + '</b>' + (u.g ? ' (đoán)' : '') : '<b>Chưa rõ lớp</b>') + ' đã làm bộ này ngày ' + dmy(u.at) + ' (' + KIND[u.kind] + (u.note ? ': ' + esc(u.note) : '') + ')')
    .concat(overlaps(U, q, L).map((o) => 'Trùng <b>' + o.n + '/' + o.T + ' câu</b> với “' + esc(o.u.title || 'bộ đã xoá') + '” ' + (o.u.lop ? '<b>lớp ' + esc(o.u.lop) + '</b>' : 'chưa rõ lớp') + ' đã làm ' + dmy(o.u.at) + ' (' + KIND[o.u.kind] + ')'));
}
// huy hiệu nhỏ ở danh sách: lớp nào đã làm (lần gần nhất), bộ nào trùng nhiều câu
export function badges(U, q) {
  if (!U) return '';
  const by = new Map(); usesOf(U, q).forEach((u) => { const k = u.lop || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(u); });
  const chips = [...by.entries()].map(([k, L]) => '<span class="used" title="' + esc(L.map((u) => dmy(u.at) + ' ' + KIND[u.kind] + (u.note ? ': ' + u.note : '')).join('\n')) + '">✓ ' + esc(k || 'chưa rõ lớp') + (L[0].g ? '?' : '') + ' · ' + dmy(L[0].at) + ' ' + KIND[L[0].kind].split(' ')[0] + (L.length > 1 ? ' ×' + L.length : '') + '</span>');
  const ov = overlaps(U, q, null).filter((o) => !by.has(o.u.lop)).slice(0, 3)
    .map((o) => '<span class="used ov" title="' + esc('Trùng ' + o.n + '/' + o.T + ' câu với “' + o.u.title + '”, ' + lopTxt(o.u) + ', ' + dmy(o.u.at) + ' ' + KIND[o.u.kind]) + '">≈ ' + esc(o.u.lop || 'chưa rõ lớp') + ' · trùng ' + o.n + '/' + o.T + '</span>');
  return chips.concat(ov).join('');
}

function overlay(html) { const ov = document.createElement('div'); ov.className = 'overlay hwov dduov'; ov.innerHTML = '<div class="card ddcard">' + html + '</div>'; document.body.appendChild(ov); return ov; }
// hỏi lại trước khi dùng: không chặn, chỉ cảnh báo. Trả về true nếu thầy bấm "Vẫn dùng" (hoặc không có gì để cảnh báo).
export function confirmUse(U, q, lop, what) {
  const W = U ? warnings(U, q, lop) : [];
  if (!W.length) return Promise.resolve(true);
  return new Promise((ok) => {
    const ov = overlay('<h2 style="margin-top:0">⚠️ Bộ này đã dùng rồi</h2><p class="muted">' + esc(q.title || '') + (lop ? ' · cho lớp <b>' + esc(lop) + '</b>' : ' · chưa chọn lớp') + '</p><ul class="ddw">' + W.map((w) => '<li>' + w + '</li>').join('') + '</ul>' +
      '<div class="ddbtn"><button class="btn" data-a="0">Huỷ</button><button class="btn pri" data-a="1">Vẫn dùng' + (what ? ' · ' + esc(what) : '') + '</button></div>');
    ov.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => { ov.remove(); ok(b.dataset.a === '1'); }; });
  });
}
export function lopOptions(sel, extra) {
  const ids = CLASSES.map((c) => c[0]); (extra || []).forEach((k) => { if (k && !ids.includes(k)) ids.push(k); });
  return ids.map((k) => '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(classLabel(k)) + '</option>').join('') + '<option value=""' + (!sel ? ' selected' : '') + '>Chưa rõ lớp</option>';
}
// ✋ thầy tự đánh dấu / bỏ đánh dấu "đã dùng với lớp …" (lưu ở quizResults/_dadung, chỉ thầy đọc/ghi)
export function markDialog(F, db, U, q, onDone) {
  const today = new Date(), pad = (n) => String(n).padStart(2, '0'), iso = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
  const ov = overlay('<h2 style="margin-top:0">📌 Đã dùng với lớp nào</h2><p class="muted">' + esc(q.title || '') + '</p><div id="ddL"></div>' +
    '<h3 style="margin:14px 0 6px;font-size:16px">✋ Đánh dấu thêm (dùng trên giấy, kiểm tra ngoài app…)</h3>' +
    '<div class="ddform"><label>Lớp<br><select id="ddLop">' + lopOptions(quizClass(q)) + '</select></label><label>Ngày<br><input type="date" id="ddAt" value="' + iso + '"></label><label class="ddnote">Ghi chú<br><input id="ddNote" maxlength="60" placeholder="vd. làm trên giấy"></label></div>' +
    '<div class="ddbtn"><button class="btn" data-x>Đóng</button><button class="btn pri" id="ddAdd">Đánh dấu đã dùng</button></div>');
  const paint = () => {
    const L = usesOf(U, q);
    ov.querySelector('#ddL').innerHTML = L.length ? '<ul class="ddw">' + L.map((u) => '<li>' + esc(lopTxt(u)) + ' · ' + dmy(u.at) + ' · ' + KIND[u.kind] + (u.note ? ': ' + esc(u.note) : '') + (u.kind === 'tay' ? ' <button class="btn sm" data-rm="' + esc(u.id) + '" title="Bỏ đánh dấu">✕ Bỏ</button>' : '') + '</li>').join('') + '</ul>' : '<p class="muted">Chưa lớp nào làm bộ này (theo lịch sử trong app).</p>';
    ov.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => save(null, b.dataset.rm); });
  };
  async function save(add, rmId) {
    const ref = F.doc(db, 'quizResults', MARK);
    try {
      const s = await F.getDoc(ref); let m = (s.exists() && Array.isArray(s.data().m)) ? s.data().m : [];
      if (rmId) m = m.filter((x) => x.id !== rmId); if (add) m.push(add);
      await F.setDoc(ref, { m, upd: Date.now() });
      U.marks = m; U.uses = U.uses.filter((u) => u.kind !== 'tay');
      m.forEach((x) => U.uses.push({ qz: x.qz, title: x.title || '', lop: x.lop || '', at: x.at || 0, kind: 'tay', note: x.note || '', id: x.id, fp: new Set(x.fp || []) }));
      U.uses.sort((a, b) => b.at - a.at); paint(); if (onDone) onDone();
    } catch (e) { console.error(e); alert('Chưa lưu được (' + (e.code || e.message) + ').'); }
  }
  ov.querySelector('[data-x]').onclick = () => ov.remove();
  ov.querySelector('#ddAdd').onclick = () => {
    const d = ov.querySelector('#ddAt').value, at = d ? new Date(d + 'T12:00').getTime() : Date.now();
    save({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), qz: q.id, title: String(q.title || '').slice(0, 120), lop: ov.querySelector('#ddLop').value, at, note: ov.querySelector('#ddNote').value.trim().slice(0, 60), fp: [...U.fpQ(q)].slice(0, 500) });
  };
  paint();
}
