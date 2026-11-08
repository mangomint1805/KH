// Sinh ngân hàng câu hỏi "Tạo từ bài học" cho admin: node test/build-bai-hoc.js
// Nguồn: test/bai-hoc/<khoá>/<bài>.txt (thầy/Claude soạn tay, lấy ý từ web tóm tắt bài học) -> data/bai-hoc/
//   # title: … / # group: Listening | Reading | Weekly Revision | Units
//   v|từ tiếng Anh|nghĩa tiếng Việt          (bảng từ vựng: tự sinh câu hỏi nghĩa Anh→Việt và Việt→Anh)
//   loại|câu hỏi|đáp án đúng|sai 1|sai 2|sai 3   (loại: form, colloc, grammar, tip, vocab)
// Mỗi câu đều qua QP.check (bộ kiểm tra của trang soạn) và không vượt giới hạn Kahoot (120 / 75 ký tự).
const fs = require('fs'), path = require('path');
const QP = require('../js/parse.js');
const SRC = path.join(__dirname, 'bai-hoc'), OUT = path.join(__dirname, '..', 'data', 'bai-hoc');
const COURSES = [
  { id: 'pre-moi', name: 'TOEIC Pre (mới)', lop: 'TOPRE115276' },
  { id: 'a-moi', name: 'TOEIC A (mới)', lop: 'TOA117110' },
  { id: 'pre-cu', name: 'TOEIC Pre (cũ)', lop: 'PRE115275' },
  { id: 'starter', name: 'Starter TOEIC', lop: '' }, // sách Starter TOEIC 3rd ed. (12 unit: ngữ pháp + chủ đề), dùng chung, chưa gán lớp
];
const KINDS = { vocab: 20, form: 20, colloc: 20, grammar: 30, tip: 30 };
const GROUPS = ['Listening', 'Reading', 'Weekly Revision', 'Units'];
const MAXV = 16; // tối đa số câu từ vựng tự sinh mỗi bài

function hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const POS = /\s*\((n|v|adj|adv|prep|phr|phr\.v|phr\.|phrasal v|phrasal verb|np|n\.p|v\.p|n\/v|n,v|n, v|v, n|n\/adj)\)\s*$/i;
function cleanEn(s) {
  const m = POS.exec(s); const pos = m ? m[1].toLowerCase().replace(/[^a-z]/g, '') : '';
  s = s.replace(POS, '').trim();
  s = s.split(' ').map((w) => (/^(I|TV|HR|CV)$/.test(w) || /^I[’']/.test(w) ? w : w.toLowerCase())).join(' ');
  return { en: s, pos };
}
const lc1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const ok = (q, where) => {
  const ck = QP.check(q), bad = ck.err.concat(ck.warn);
  const o = q.o.map((x) => x.toLowerCase());
  if (new Set(o).size !== 4 || o.some((x) => !x)) bad.push('cần 4 đáp án khác nhau');
  if (q.c.length !== 1) bad.push('cần đúng 1 đáp án');
  if (bad.length) throw new Error(where + ': ' + bad.join('; ') + '\n  ' + JSON.stringify(q));
};

// hai mục gần nghĩa (khách hàng / khách hàng mua sản phẩm, discuss / discussion) không làm đáp án nhiễu của nhau
const segs = (s) => s.toLowerCase().split(/[\/,;()]/).map((x) => x.trim()).filter((x) => x.length >= 3);
const inside = (a, b) => segs(a).some((x) => segs(b).some((y) => x.includes(y) || y.includes(x)));
const near = (x, e) => inside(x.vi, e.vi) || x.en.toLowerCase().includes(e.en.toLowerCase()) || e.en.toLowerCase().includes(x.en.toLowerCase());
function vocabQs(V, id) {
  if (V.length < 4) return [];
  const r = rng(hash(id)), qs = [];
  const step = V.length > MAXV ? V.length / MAXV : 1;
  for (let n = 0; n < Math.min(MAXV, V.length); n++) {
    const i = Math.floor(n * step), e = V[i], dir = n % 2; // 0: Anh→Việt, 1: Việt→Anh
    const key = dir ? 'en' : 'vi', multi = / /.test(e.en);
    const pool = shuffle(V.filter((x, j) => j !== i), r).map((x) => ({ x, s: (/ /.test(x.en) === multi ? 2 : 0) + (x.pos && x.pos === e.pos ? 2 : 0) + (Math.abs(x[key].length - e[key].length) < 8 ? 1 : 0) }));
    pool.sort((a, b) => b.s - a.s);
    const wrong = [];
    for (const p of pool) { if (near(p.x, e)) continue; const v = p.x[key]; if (wrong.length < 3 && v.toLowerCase() !== e[key].toLowerCase() && !wrong.some((w) => w.toLowerCase() === v.toLowerCase())) wrong.push(v); }
    if (wrong.length < 3) continue;
    const t = dir ? '"' + e.vi + '" trong tiếng Anh là gì?' : 'Nghĩa của "' + e.en + '" là gì?';
    qs.push(mk('vocab', t, e[key], wrong));
  }
  return qs;
}
function mk(k, t, right, wrong) {
  const r = rng(hash(t + right)), o = shuffle([right].concat(wrong), r);
  return { k, t, o, c: [o.indexOf(right)], time: KINDS[k] };
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const index = { v: 1, kinds: { vocab: 'Nghĩa từ vựng', form: 'Loại từ / dạng từ', colloc: 'Cụm từ đi kèm', grammar: 'Ngữ pháp (kiểu Part 5)', tip: 'Mẹo làm bài' }, courses: [] };
  let total = 0;
  COURSES.forEach((C) => {
    const dir = path.join(SRC, C.id), lessons = [];
    fs.mkdirSync(path.join(OUT, C.id), { recursive: true });
    fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).forEach((f) => {
      const id = f.replace(/\.txt$/, ''), meta = {}, V = [], hand = [];
      fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, ln) => {
        line = line.trim(); if (!line) return;
        const m = /^#\s*(\w+):\s*(.*)$/.exec(line); if (m) { meta[m[1]] = m[2]; return; } if (line[0] === '#') return;
        const p = line.split('|').map((x) => x.trim()), where = C.id + '/' + f + ':' + (ln + 1);
        if (p[0] === 'v') { if (p.length !== 3) throw new Error(where + ': dòng từ vựng cần v|en|vi'); const e = cleanEn(p[1]); e.vi = lc1(p[2]); V.push(e); return; }
        if (!KINDS[p[0]] || p.length !== 6) throw new Error(where + ': cần loại|câu hỏi|đúng|sai|sai|sai');
        hand.push(Object.assign(mk(p[0], p[1], p[2], p.slice(3)), { where }));
      });
      const qs = vocabQs(V, C.id + '/' + id).concat(hand);
      const seen = new Set();
      qs.forEach((q) => { ok(q, q.where || C.id + '/' + id); if (seen.has(q.t)) throw new Error(C.id + '/' + id + ': trùng câu "' + q.t + '"'); seen.add(q.t); delete q.where; });
      if (qs.length < 20) throw new Error(C.id + '/' + id + ': mới có ' + qs.length + ' câu (cần ≥ 20)');
      const L = { id, title: meta.title, group: meta.group, qs };
      fs.writeFileSync(path.join(OUT, C.id, id + '.json'), JSON.stringify(L) + '\n');
      const n = {}; qs.forEach((q) => { n[q.k] = (n[q.k] || 0) + 1; });
      lessons.push({ id, title: meta.title, group: meta.group, n });
      total += qs.length;
    });
    const num = (s) => +((/(\d+)/.exec(s) || [0, 0])[1]);
    lessons.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || num(a.id) - num(b.id));
    index.courses.push({ id: C.id, name: C.name, lop: C.lop, lessons });
  });
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  return { lessons: index.courses.reduce((s, c) => s + c.lessons.length, 0), total };
}
const r = build();
console.log('✔ bai-hoc: ' + r.lessons + ' bài, ' + r.total + ' câu');
