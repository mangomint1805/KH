/* Minto Quiz — đọc bộ câu hỏi từ Excel mẫu Kahoot, CSV, hoặc văn bản dạng đề.
   Chạy được cả trên trình duyệt (window.QP) lẫn Node (module.exports) để kiểm thử.
   Câu hỏi: { t: nội dung, o: [4 đáp án], c: [chỉ số đáp án đúng 0-3], time: giây, pts: 1 | 2 | 0 } */
(function (root) {
  'use strict';
  var TIMES = [5, 10, 20, 30, 60, 90, 120, 240];
  var MAXQ = 120, MAXA = 75;

  function str(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function snapTime(v, def) {
    var n = parseFloat(v);
    if (!isFinite(n) || n <= 0) return def || 20;
    var best = TIMES[0];
    TIMES.forEach(function (t) { if (Math.abs(t - n) < Math.abs(best - n)) best = t; });
    return best;
  }
  function blank() { return { t: '', o: ['', '', '', ''], c: [], time: 20, pts: 1 }; }

  // "2" | "1,3" | 2 | "B" | "b, d" -> [chỉ số 0-3]
  function parseCorrect(v) {
    var s = str(v), out = [];
    if (!s) return out;
    s.split(/[,;\s/&]+/).forEach(function (p) {
      if (!p) return;
      var i = -1;
      if (/^[1-4](\.0+)?$/.test(p)) i = parseInt(p, 10) - 1;
      else if (/^[A-Da-d]$/.test(p)) i = p.toUpperCase().charCodeAt(0) - 65;
      if (i >= 0 && out.indexOf(i) < 0) out.push(i);
    });
    return out.sort();
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    var first = text.split(/\r?\n/, 1)[0] || '';
    var cnt = function (ch) { return first.split(ch).length - 1; };
    var d = cnt('\t') > cnt(',') && cnt('\t') >= cnt(';') ? '\t' : cnt(';') > cnt(',') ? ';' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // ---------- bảng (Excel / CSV) ----------
  // Mẫu Kahoot: A số thứ tự, B câu hỏi, C-F đáp án, G thời gian, H đáp án đúng. Tiêu đề ở hàng 8.
  // CSV không có cột số thứ tự (câu hỏi ở cột A) cũng nhận.
  function fromRows(rows) {
    rows = (rows || []).map(function (r) { return (r || []).map(function (c) { return c == null ? '' : c; }); });
    var start = 0, off = -1;
    for (var i = 0; i < Math.min(rows.length, 30); i++) {
      var r = rows[i];
      for (var j = 0; j < 2; j++) {
        if (/^question/i.test(str(r[j])) || /^câu hỏi/i.test(str(r[j]))) { start = i + 1; off = j; break; }
      }
      if (off >= 0) break;
    }
    var qs = [], errs = [];
    for (var k = start; k < rows.length; k++) {
      var row = rows[k], o = off;
      if (!row.some(function (c) { return str(c); })) continue;
      if (o < 0) o = (/^\d+$/.test(str(row[0])) || !str(row[0])) && str(row[1]) ? 1 : 0;
      var q = blank();
      q.t = str(row[o]);
      q.o = [str(row[o + 1]), str(row[o + 2]), str(row[o + 3]), str(row[o + 4])];
      q.time = snapTime(row[o + 5], 20);
      q.c = parseCorrect(row[o + 6]);
      if (!q.t && !q.o.some(Boolean)) continue;
      q.row = k + 1;
      qs.push(q);
    }
    var title = '';
    for (var t = 0; t < Math.min(rows.length, 6); t++) if (/^quiz template$/i.test(str(rows[t][1])) && rows[t + 1]) { title = str(rows[t + 1][1]); break; }
    if (!qs.length) errs.push('Không tìm thấy câu hỏi nào. File cần theo mẫu Kahoot: cột B câu hỏi, C–F đáp án, G thời gian, H đáp án đúng.');
    return { qs: qs, errs: errs, title: title };
  }

  // ---------- văn bản dạng đề ----------
  var RE_Q = /^\s*(?:question\s*|câu\s*|q\s*)?(\d{1,3})\s*[.):\-]\s*(.*)$/i;
  var RE_ANS = /^\s*(?:correct\s+answers?|answers?|đáp\s*án(?:\s*đúng)?|key)\s*[:：\-=]?\s*((?:\(?[A-Da-d]\)?[\s,;&và]*)+)\s*(?:[.\-–—:].*)?$/i;
  var RE_KEYHEAD = /^\s*(?:answer\s*keys?|đáp\s*án|keys?)\s*[:：]?\s*$/i;
  var RE_OPT = /(?:^|\s)(?:\(([A-D])\)|([A-D])[.)])\s+/g;
  var RE_OPT_LOW = /^\s*(?:\(([a-d])\)|([a-d])[.)])\s+/;

  function splitOptions(line) {
    // trả về { pre: phần trước đáp án đầu tiên, opts: [[chữ, nội dung]...] } hoặc null
    var m, marks = [];
    RE_OPT.lastIndex = 0;
    while ((m = RE_OPT.exec(line))) marks.push({ L: (m[1] || m[2]), at: m.index, end: m.index + m[0].length });
    if (!marks.length) {
      var lm = RE_OPT_LOW.exec(line);
      if (!lm) return null;
      return { pre: '', opts: [[(lm[1] || lm[2]).toUpperCase(), line.slice(lm[0].length)]] };
    }
    // chỉ nhận khi chữ cái tăng dần (A, B, C…) để tránh "Mr. A. Smith"
    var seq = [];
    marks.forEach(function (k) {
      if (!seq.length) { seq.push(k); return; }
      if (k.L.charCodeAt(0) === seq[seq.length - 1].L.charCodeAt(0) + 1) seq.push(k);
    });
    if (seq.length === 1 && seq[0].at > 0 && !/^\s*$/.test(line.slice(0, seq[0].at)) && seq[0].L !== 'A') return null;
    var out = { pre: line.slice(0, seq[0].at), opts: [] };
    for (var i = 0; i < seq.length; i++) out.opts.push([seq[i].L, line.slice(seq[i].end, i + 1 < seq.length ? seq[i + 1].at : line.length)]);
    return out;
  }

  // dòng bảng đáp án: chỉ gồm các cặp "số + chữ", ví dụ "1B 2A 3D", "1-B, 2-A", "4. C"
  var RE_KEYLINE = /^\s*(\d{1,3}\s*[.\-:)]?\s*\(?[A-Da-d]\)?[\s,;.]*)+$/;
  // mở đầu đoạn văn dẫn (Part 6/7): "Questions 3-4 refer to…", "Read the following…"
  var RE_PASSAGE = /^\s*(questions?\s+\d{1,3}\s*(-|–|—|and|to|&)\s*\d{1,3}|read the following|refer to the following)/i;
  function fromText(text) {
    var lines = String(text || '').replace(/\r/g, '').replace(/ /g, ' ').split('\n');
    var qs = [], cur = null, keyMode = false, keys = null, errs = [], sections = [], secFrom = 0, skip = false, skipped = 0;
    function push() { if (cur) qs.push(cur); cur = null; }
    function letterIdx(L) { return L.toUpperCase().charCodeAt(0) - 65; }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;
      if (RE_KEYHEAD.test(line)) {
        // bảng đáp án chỉ áp cho các câu từ bảng đáp án trước tới đây (đề nhiều phần, mỗi phần đánh số lại từ 1)
        push(); keyMode = true; skip = false; keys = {}; sections.push({ from: secFrom, to: qs.length, keys: keys }); secFrom = qs.length;
        continue;
      }
      if (keyMode) {
        if (RE_KEYLINE.test(line)) {
          var km, re = /(\d{1,3})\s*[.\-:)]?\s*\(?([A-Da-d])\)?(?![a-z])/g;
          while ((km = re.exec(line))) keys[+km[1]] = [letterIdx(km[2])];
          continue;
        }
        keyMode = false;
      }
      var am = RE_ANS.exec(line);
      if (am && cur) {
        cur.c = parseCorrect(am[1].replace(/[()]/g, ' ').replace(/và/g, ','));
        continue;
      }
      if (RE_PASSAGE.test(line)) { push(); skip = true; skipped++; continue; } // đoạn văn dẫn: bỏ qua tới câu hỏi kế tiếp
      var qm = RE_Q.exec(line);
      if (qm) {
        push(); skip = false;
        cur = blank(); cur.num = +qm[1]; cur.row = i + 1; cur.optStarted = false;
        line = qm[2];
        if (!line.trim()) continue;
      }
      if (!cur || skip) continue;
      var sp = splitOptions(line);
      // "Mr. A. Smith…": chỉ một nhãn đáp án, đứng giữa câu hỏi -> là chữ của câu hỏi
      if (sp && !cur.optStarted && sp.opts.length === 1 && sp.pre.trim()) sp = null;
      if (sp) {
        if (sp.pre.trim() && !cur.optStarted) cur.t = str(cur.t + ' ' + sp.pre);
        sp.opts.forEach(function (p) { var k = letterIdx(p[0]); if (k >= 0 && k < 4) { cur.o[k] = str(p[1]); cur.last = k; } });
        cur.optStarted = true;
      } else if (cur.optStarted && cur.last != null) {
        cur.o[cur.last] = str(cur.o[cur.last] + ' ' + line);
      } else {
        cur.t = str(cur.t + ' ' + line);
      }
    }
    push();
    sections.forEach(function (S) { for (var j = S.from; j < S.to; j++) if (!qs[j].c.length && S.keys[qs[j].num]) qs[j].c = S.keys[qs[j].num]; });
    qs.forEach(function (q) {
      delete q.optStarted; delete q.last;
      q.time = 30;
    });
    if (!qs.length) errs.push('Không nhận ra câu hỏi nào. Mỗi câu cần bắt đầu bằng số thứ tự, ví dụ "1. …", rồi các đáp án (A) … (B) …');
    return { qs: qs, errs: errs, skipped: skipped };
  }

  // ---------- kiểm tra ----------
  // trả về { err: [lỗi chặn lưu], warn: [cảnh báo] }
  function check(q) {
    var err = [], warn = [], filled = q.o.filter(function (x) { return str(x); }).length;
    if (!str(q.t)) err.push('Thiếu nội dung câu hỏi');
    if (filled < 2) err.push('Cần ít nhất 2 đáp án');
    if (!q.c.length) err.push('Chưa chọn đáp án đúng');
    q.c.forEach(function (i) { if (!str(q.o[i])) err.push('Đáp án đúng ' + 'ABCD'[i] + ' đang để trống'); });
    if (str(q.t).length > 1000) err.push('Câu hỏi dài ' + str(q.t).length + ' ký tự, tối đa 1000 (đoạn văn dài thì chụp thành hình rồi thêm hình)');
    q.o.forEach(function (x, i) { if (str(x).length > 500) err.push('Đáp án ' + 'ABCD'[i] + ' dài ' + str(x).length + ' ký tự, tối đa 500'); });
    if (str(q.t).length > MAXQ) warn.push('Câu hỏi dài ' + str(q.t).length + ' ký tự (Kahoot giới hạn ' + MAXQ + ')');
    q.o.forEach(function (x, i) { if (str(x).length > MAXA) warn.push('Đáp án ' + 'ABCD'[i] + ' dài ' + str(x).length + ' ký tự (giới hạn ' + MAXA + ')'); });
    return { err: err, warn: warn };
  }

  // ---------- xuất ra mẫu Kahoot ----------
  function toRows(title, qs) {
    var rows = [
      [], ['', 'Quiz template'], ['', title || ''],
      ['', 'Add questions, at least two answer alternatives, time limit and choose correct answers (at least one). Have fun creating your awesome quiz!'],
      ['', 'Remember: questions have a limit of 120 characters and answers can have 75 characters max. Text will turn red in Excel or Google Docs if you exceed this limit. If several answers are correct, separate them with a comma.'],
      ['', "See an example question below (don't forget to overwrite this with your first question!)"],
      ['', "And remember,  if you're not using Excel you need to export to .xlsx format before you upload to Kahoot!"],
      ['', 'Question - max 120 characters', 'Answer 1 - max 75 characters', 'Answer 2 - max 75 characters', 'Answer 3 - max 75 characters', 'Answer 4 - max 75 characters', 'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs', 'Correct answer(s) - choose at least one']
    ];
    qs.forEach(function (q, i) {
      rows.push([i + 1, q.t, q.o[0] || '', q.o[1] || '', q.o[2] || '', q.o[3] || '', q.time, q.c.map(function (x) { return x + 1; }).join(',')]);
    });
    return rows;
  }

  var QP = { TIMES: TIMES, MAXQ: MAXQ, MAXA: MAXA, str: str, snapTime: snapTime, blank: blank, parseCorrect: parseCorrect, parseCSV: parseCSV, fromRows: fromRows, fromText: fromText, check: check, toRows: toRows };
  if (typeof module === 'object' && module.exports) module.exports = QP;
  else root.QP = QP;
})(typeof window !== 'undefined' ? window : this);
