// Chạy thử 📦 nhóm câu (Part 3/4/6/7): 1 host + 3 người chơi trên Firebase Emulator.
// Bộ 5 câu: câu 1 lẻ, câu 2–4 là nhóm (đoạn văn + hình, số câu trên đề 32–34), câu 5 lẻ. Sau đó chơi một bộ cũ (không nhóm) xem có giữ nguyên không,
// và làm bài về nhà có nhóm câu.
// Cần: test/server.js (cổng 8000) và Emulator (auth 9099, database 9000, firestore 8080) đang chạy.
// node test/e2e-nhom.js   (đặt SHOTS=<thư mục> để lưu ảnh chụp)
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8000/KH/';
const SHOT = (n) => (process.env.SHOTS ? { path: process.env.SHOTS + '/' + n } : {});
const TEACHER = 'quangkhunpro@gmail.com';
const log = (...a) => console.log('•', ...a);
let fails = 0;
function check(ok, msg) { console.log(ok ? '  ✔' : '  ✘', msg); if (!ok) fails++; }
const PASSAGE = 'Dear Ms. Lee,\nThank you for your order of 12 office chairs. They will arrive on Friday morning.\nPlease call us if you need help with setup.\nBest regards,\nOffice World';
const CSV = 'Số;Question;A1;A2;A3;A4;Time;Correct;Nhóm;Đoạn văn\n' +
  '1;She ____ to work by bus.;go;goes;going;gone;10;2;;\n' +
  '32;What is the email about?;An order;A job;A party;A trip;10;1;P7;"' + PASSAGE + '"\n' +
  '33;When will the chairs arrive?;Monday;Wednesday;Friday;Sunday;10;3;P7;\n' +
  '34;How many chairs were ordered?;2;10;12;20;10;3;P7;\n' +
  '5;The meeting ____ at 9.;start;starts;starting;to start;10;2;;\n';

(async () => {
  // proxy (nếu có) chỉ cho thư viện CDN; máy chủ thử và Emulator ở 127.0.0.1 đi thẳng (Chromium tự bỏ qua proxy cho loopback)
  const br = await chromium.launch({ args: process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY] : [] });
  const errs = [];
  const mk = async (login, dev) => {
    const ctx = await br.newContext({ ...(dev || {}), ignoreHTTPSErrors: true, acceptDownloads: true });
    if (login) await ctx.addInitScript((e) => localStorage.setItem('mock.login', e), login);
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => { errs.push(e.message); console.log('   [pageerror]', e.message); });
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource|fonts/.test(m.text())) console.log('   [console]', m.text().slice(0, 200)); });
    return pg;
  };
  const phone = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } };

  // ---------- soạn: nhập CSV có cột Nhóm / Đoạn văn, thêm hình cho nhóm ----------
  log('Thầy nhập CSV có nhóm câu');
  const host = await mk(TEACHER, { viewport: { width: 1366, height: 768 } });
  await host.goto(BASE + 'admin.html');
  await host.waitForSelector('#bNew');
  const news = await host.$('text=Đã hiểu'); if (news) await news.click();
  await host.click('#bNew');
  await host.setInputFiles('#file', { name: 'Part 7 nhom.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await host.waitForSelector('text=Đã đọc 5 câu');
  check(await host.$$eval('.ge', (x) => x.length) === 1, 'có 1 khung nhóm câu');
  check(await host.$$eval('.qe.ing', (x) => x.length) === 3, '3 câu nằm trong nhóm');
  check(await host.$eval('.ge [data-gf=no]', (e) => e.value) === '32', 'số câu trên đề = 32 (lấy từ cột A)');
  check((await host.$eval('.ge [data-gf=p]', (e) => e.value)).includes('office chairs'), 'đoạn văn vào khung nhóm, giữ xuống dòng');
  const pic = await host.screenshot();
  await host.setInputFiles('.ge [data-gf=img]', { name: 'bang.png', mimeType: 'image/png', buffer: pic });
  await host.waitForSelector('.ge img.qthumb[src^="data:image/jpeg"]');
  check(true, 'thêm hình cho nhóm');
  // gộp / tách thử: tách câu 34 rồi gộp lại
  await host.click('.qe[data-i="3"] [data-a=split]');
  check(await host.$$eval('.qe.ing', (x) => x.length) === 2, 'tách câu cuối khỏi nhóm');
  await host.click('.qe[data-i="3"] [data-a=join]');
  check(await host.$$eval('.qe.ing', (x) => x.length) === 3, 'gộp lại vào nhóm');
  // câu lẻ đi xuống thì nhảy qua cả nhóm, không chen vào giữa
  await host.click('.qe[data-i="0"] [data-a=dn]');
  check((await host.$eval('.qe[data-i="3"] [data-f=t]', (e) => e.value)).startsWith('She'), 'câu lẻ bấm ↓ nhảy qua cả nhóm');
  await host.click('.qe[data-i="3"] [data-a=up]');
  check((await host.$eval('.qe[data-i="0"] [data-f=t]', (e) => e.value)).startsWith('She') && await host.$$eval('.qe.ing', (x) => x.length) === 3, 'bấm ↑ trở lại, nhóm còn nguyên');
  await host.screenshot(SHOT('nhom-admin.png'));
  await host.setViewportSize({ width: 390, height: 844 });
  check(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'trang soạn 390px không tràn ngang');
  await host.screenshot(SHOT('nhom-admin-390.png'));
  await host.setViewportSize({ width: 1366, height: 768 });
  await host.click('#bSave');
  await host.waitForSelector('text=Đã lưu');
  const doc = await host.evaluate(async () => { const x = await window.MACC.fs(); const s = await x.F.getDocs(x.F.collection(x.db, 'quizzes')); let d = null; s.forEach((y) => { if ((y.data().title || '').includes('Part 7')) d = { id: y.id, ...y.data() }; }); return d; });
  const gid = doc.qs[1].g;
  check(gid && doc.qs[2].g === gid && doc.qs[3].g === gid && !doc.qs[0].g && doc.groups[gid].no === 32 && doc.groups[gid].img && doc.groups[gid].p.includes('\n'), 'lưu Firestore: q.g + groups{p,no,img}');
  // bộ cũ (không nhóm) để chơi so sánh
  await host.evaluate(async () => { const x = await window.MACC.fs(); await x.F.setDoc(x.F.doc(x.db, 'quizzes', 'oldquiz'), { title: 'Bộ cũ', qs: [{ t: 'Old one?', o: ['a', 'b', 'c', 'd'], c: [0], time: 10, pts: 1 }, { t: 'Old two?', o: ['a', 'b', '', ''], c: [1], time: 10, pts: 1 }], upd: 1 }); });

  // ---------- chơi bộ có nhóm ----------
  log('Tạo phòng, 3 học sinh vào');
  await host.goto(BASE + 'host.html?quiz=' + doc.id);
  await host.waitForSelector('.pin', { timeout: 15000 });
  const PIN = (await host.textContent('.pin')).trim();
  check(await host.evaluate((p) => localStorage.getItem('qz.grp.' + p), PIN) === '1', 'máy thầy nhận ra luật đã có nhóm câu');
  check(!(await host.$('text=chưa có nhóm câu')), 'không báo thiếu luật');
  const join = async (name) => { const p = await mk(null, phone); await p.goto(BASE + 'play.html?pin=' + PIN); await p.fill('#name', name); await p.click('#go'); await p.waitForSelector('text=Vào phòng rồi nè', { timeout: 15000 }); return p; };
  const [A, B, C] = [await join('An'), await join('Bình'), await join('Chi')];
  await host.waitForFunction(() => document.querySelectorAll('#names .nm').length === 3);
  await host.click('#bStart');
  // câu 1 lẻ
  await Promise.all([A, B, C].map((p) => p.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 })));
  check(await host.$('.gwrap') === null, 'câu lẻ: màn chiếu như cũ');
  await A.click('.pbtn.k1'); await B.click('.pbtn.k1'); await C.click('.pbtn.k0');
  await host.waitForSelector('#chart', { timeout: 15000 });
  await host.click('#bNext'); // bảng xếp hạng
  await host.waitForSelector('#bd'); await host.click('#bNext'); // câu tiếp: nhóm
  log('Nhóm câu 32–34');
  await host.waitForSelector('.gwrap', { timeout: 15000 });
  check(/32–34/.test(await host.textContent('.qbanner')), 'màn giới thiệu nhóm: ' + await host.textContent('.qbanner'));
  await Promise.all([A, B, C].map((p) => p.waitForSelector('#sGrp:not([hidden]) .gopt', { timeout: 20000 })));
  check(await host.$$eval('.gqs .gq', (x) => x.length) === 3 && await host.$('.gstim img.qimg') !== null && (await host.textContent('.gstim .gp')).includes('office chairs'), 'màn chiếu: đoạn văn + hình + 3 câu');
  check(await host.$$eval('.gq .gop span', (x) => x.length) === 12, 'màn chiếu hiện đáp án cả 3 câu');
  check(await A.$$eval('#gList .gq', (x) => x.length) === 3 && !(await A.isHidden('#gPass')) && (await A.textContent('#gPT')).includes('Friday'), 'điện thoại: đoạn văn + 3 câu trên một màn');
  check((await A.textContent('#gNum')).includes('32–34'), 'điện thoại ghi Câu 32–34');
  check(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'điện thoại 390px không tràn ngang');
  await A.screenshot(SHOT('nhom-phone.png'), { fullPage: true });
  await host.screenshot(SHOT('nhom-host-answer.png'));
  // An: đúng cả 3. Bình: đổi ý một lần, đúng 2. Chi: chỉ chọn 1 câu rồi để hết giờ tự nộp
  await A.click('.gopt[data-q="1"][data-a="0"]'); await A.click('.gopt[data-q="2"][data-a="2"]'); await A.click('.gopt[data-q="3"][data-a="2"]');
  check((await A.textContent('#gGo')).includes('3/3'), 'nút Nộp bài đếm 3/3');
  await A.click('#gGo');
  await A.waitForSelector('text=Nộp bài rồi nha');
  check((await A.textContent('#mS')).includes('32-A · 33-C · 34-C'), 'màn chờ ghi lại đáp án đã nộp');
  await B.click('.gopt[data-q="1"][data-a="1"]'); await B.click('.gopt[data-q="1"][data-a="0"]'); await B.click('.gopt[data-q="2"][data-a="2"]');
  await B.reload(); // tải lại giữa chừng: giữ lựa chọn
  await B.waitForSelector('#sGrp:not([hidden]) .gopt', { timeout: 20000 });
  check(await B.$$eval('.gopt.chosen', (x) => x.map((b) => b.dataset.q + b.dataset.a).join()) === '10,22', 'tải lại trang vẫn giữ đáp án đã chọn');
  await B.click('#gGo'); // thiếu câu 34: lần đầu nhắc
  check((await B.textContent('#gHint')).includes('Còn 1 câu'), 'thiếu câu thì nhắc, bấm lần nữa mới nộp');
  await B.click('#gGo');
  await B.waitForSelector('text=Nộp bài rồi nha');
  await C.click('.gopt[data-q="3"][data-a="2"]');
  check(/2\/3/.test(await host.textContent('#na')), 'màn chiếu đếm 2/3 đã nộp');
  // thử gian lận: nộp lại lần 2 bị chặn
  const again = await A.evaluate(async (pin) => { const m = await import(new URL('js/common.js?v=19', location.href).href); const P = await m.player(); try { await P.D.set(P.D.ref(P.db, 'quiz/' + pin + '/answers/2/' + P.uid), { a: 1, at: P.D.serverTimestamp() }); return 'ok'; } catch (e) { return 'ERR'; } }, PIN);
  check(again === 'ERR', 'không nộp lại câu đã nộp');
  // Chi để hết giờ: điện thoại tự nộp câu đã chọn (kiểm tra ở answers bên dưới)
  // chữa từng câu
  await host.waitForSelector('.grev #chart', { timeout: 45000 });
  check((await host.textContent('.gq.cur')).startsWith('32.'), 'chữa câu 32 trước, đoạn văn vẫn bên trái: ' + !!(await host.$('.gwrap.rev .gstim .gp')));
  check(await host.$('#bZoom') !== null, 'có nút 🖼 Xem lại ảnh');
  const cnt = async () => host.$$eval('#chart .col .n', (x) => x.map((e) => parseInt(e.textContent, 10)).join());
  check(await cnt() === '2,0,0,0', 'biểu đồ câu 32: 2 bạn chọn A');
  await A.waitForSelector('.rlbl'); check((await A.textContent('.rlbl')) === 'Câu 32', 'điện thoại hiện kết quả Câu 32');
  await host.screenshot(SHOT('nhom-host-reveal.png'));
  await host.keyboard.press('t'); await host.keyboard.press('t'); await host.keyboard.press('t'); await host.waitForTimeout(400); await host.screenshot(SHOT('nhom-host-reveal-scifi.png')); await host.keyboard.press('t');
  check((await host.textContent('#bNext')).includes('Câu 33'), 'nút sang Câu 33');
  await host.keyboard.press('Space');
  await host.waitForFunction(() => (document.querySelector('.gq.cur') || {}).textContent && document.querySelector('.gq.cur').textContent.startsWith('33.'));
  check(await cnt() === '0,0,2,0', 'câu 33: 2 bạn chọn C');
  await A.waitForFunction(() => (document.querySelector('.rlbl') || {}).textContent === 'Câu 33');
  await host.keyboard.press('Space');
  await host.waitForFunction(() => (document.querySelector('.gq.cur') || {}).textContent && document.querySelector('.gq.cur').textContent.startsWith('34.'));
  check(await cnt() === '0,0,2,0', 'câu 34: An và Chi chọn C');
  check((await host.textContent('#bNext')).includes('Bảng xếp hạng'), 'hết nhóm mới tới bảng xếp hạng');
  const sc = await host.evaluate(async (pin) => { const x = await window.MACC.ready(); const m = await import(new URL('js/common.js?v=19', location.href).href); const B = await m.base(); const s = await B.D.get(B.D.ref(B.db, 'quiz/' + pin)); const v = s.val(); const nm = {}; Object.keys(v.players).forEach((u) => { nm[v.players[u].name] = u; }); return { s: Object.fromEntries(Object.entries(nm).map(([n, u]) => [n, v.scores[u].s])), ans: Object.fromEntries(Object.entries(nm).map(([n, u]) => [n, [1, 2, 3].map((q) => (v.answers[q] && v.answers[q][u] ? v.answers[q][u].a : '-')).join('')])), at: [1, 2, 3].map((q) => v.answers[q] && v.answers[q][nm.An] && v.answers[q][nm.An].at), st: v.state }; }, PIN);
  check(sc.ans.An === '022' && sc.ans['Bình'] === '02-' && sc.ans.Chi === '--2', 'câu trả lời từng câu ở answers/{câu} (Chi hết giờ tự nộp): ' + JSON.stringify(sc.ans));
  check(sc.at[0] === sc.at[1] && sc.at[1] === sc.at[2], 'cả nhóm cùng một giờ nộp');
  check(sc.s.An > sc.s['Bình'] && sc.s['Bình'] > sc.s.Chi, 'điểm: An > Bình > Chi ' + JSON.stringify(sc.s));
  await host.keyboard.press('Space');
  await host.waitForSelector('#bd');
  check(true, 'bảng xếp hạng sau cả nhóm');
  await host.screenshot(SHOT('nhom-board.png'));
  await host.click('#bNext');
  await Promise.all([A, B, C].map((p) => p.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 })));
  check((await A.textContent('#aNum')).includes('Câu 5/5'), 'câu lẻ sau nhóm như cũ');
  await A.click('.pbtn.k1'); await B.click('.pbtn.k1'); await C.click('.pbtn.k1');
  await host.waitForSelector('#chart', { timeout: 15000 });
  await host.click('#bNext');
  await host.waitForSelector('.podium', { timeout: 15000 });
  await host.waitForSelector('text=Đã lưu vào', { timeout: 15000 });
  check(true, 'kết thúc, lưu lịch sử');
  const [dl] = await Promise.all([host.waitForEvent('download'), host.click('#bCsv')]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  check(csv.includes('Câu 32 chọn') && csv.includes('Câu 34 điểm'), 'CSV ghi số câu theo đề (Câu 32…34)');
  const kq = await mk(TEACHER, { viewport: { width: 1366, height: 768 } });
  await kq.goto(BASE + 'ket-qua.html');
  await kq.waitForSelector('text=Part 7', { timeout: 15000 });
  check(true, 'Lịch sử kết quả có buổi vừa chơi');

  // ---------- bộ cũ: không có nhóm, chạy như trước ----------
  log('Bộ cũ không nhóm');
  await host.evaluate(() => localStorage.removeItem('qz.host'));
  await host.goto(BASE + 'host.html?quiz=oldquiz');
  await host.waitForSelector('.pin', { timeout: 15000 });
  const PIN2 = (await host.textContent('.pin')).trim();
  check(await host.evaluate((p) => localStorage.getItem('qz.grp.' + p), PIN2) === null, 'bộ không nhóm: không thử luật nhóm');
  const D = await mk(null, phone); await D.goto(BASE + 'play.html?pin=' + PIN2); await D.fill('#name', 'Dũng'); await D.click('#go'); await D.waitForSelector('text=Vào phòng rồi nè', { timeout: 15000 });
  await host.waitForFunction(() => document.querySelectorAll('#names .nm').length === 1);
  await host.click('#bStart');
  await D.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 });
  check(await host.$('.gwrap') === null && await host.$('.hgrid') !== null, 'màn chiếu bộ cũ như trước');
  const qp = await host.evaluate(async (pin) => { const m = await import(new URL('js/common.js?v=19', location.href).href); const B = await m.base(); return Object.keys((await B.D.get(B.D.ref(B.db, 'quiz/' + pin + '/qpub/0'))).val()).sort().join(); }, PIN2);
  check(qp === 'o,pts,t,time', 'qpub bộ cũ chỉ có t, o, time, pts');
  await D.click('.pbtn.k0');
  await host.waitForSelector('#chart', { timeout: 15000 });
  await D.waitForSelector('#sRes:not([hidden])');
  check(!(await D.$('.rlbl')), 'kết quả câu lẻ không có nhãn nhóm');
  await host.click('#bNext'); await host.waitForSelector('#bd');
  await host.click('#bNext');
  await D.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 }); await D.click('.pbtn.k1');
  await host.waitForSelector('#chart', { timeout: 15000 }); await host.click('#bNext');
  await host.waitForSelector('.podium', { timeout: 15000 });
  check(true, 'bộ cũ chơi hết 2 câu');

  // ---------- bài về nhà có nhóm câu ----------
  log('Bài về nhà có nhóm câu');
  const ad = await mk(TEACHER, { viewport: { width: 1366, height: 768 } });
  await ad.goto(BASE + 'admin.html'); await ad.waitForSelector('[data-hw="' + doc.id + '"]');
  const nw = await ad.$('text=Đã hiểu'); if (nw) await nw.click();
  await ad.click('[data-hw="' + doc.id + '"]');
  await ad.waitForTimeout(1500); // 📌 chờ đọc lịch sử dùng đề
  await ad.click('#hwGo');
  // 📌 bộ vừa chơi trên lớp với cùng lớp → hỏi lại "Vẫn dùng"
  await ad.waitForSelector('.hwlink input, .dduov', { timeout: 15000 });
  const dd = await ad.$('.dduov'); check(!!dd, '📌 giao về nhà bộ lớp vừa chơi: hiện cảnh báo đã dùng');
  if (dd) { await ad.click('.dduov [data-a="1"]'); await ad.waitForSelector('.hwlink input'); }
  const hwUrl = await ad.$eval('.hwlink input', (e) => e.value);
  const H = await mk(null, phone);
  await H.goto(hwUrl); await H.waitForSelector('#go'); await H.fill('#name', 'Lan Anh'); await H.selectOption('#lop', { index: 1 }); await H.click('#go');
  await H.waitForSelector('#qQ:not([hidden])'); await H.click('.pbtn.k1'); await H.click('#bNext');
  await H.waitForSelector('#qGrid.grp .gq');
  check(await H.$$eval('#qGrid .gq', (x) => x.length) === 3 && (await H.textContent('#qNum')).includes('32–34') && (await H.textContent('.gpt')).includes('Friday'), 'bài về nhà: nhóm 32–34 một màn kèm đoạn văn');
  await H.screenshot(SHOT('nhom-hw.png'), { fullPage: true });
  await H.click('.gopt[data-q="1"][data-a="0"]'); await H.click('.gopt[data-q="2"][data-a="2"]'); await H.click('.gopt[data-q="3"][data-a="0"]');
  await H.click('#bNext');
  await H.waitForFunction(() => /Câu 5\/5/.test(document.getElementById('qNum').textContent));
  await H.click('#bPrev');
  await H.waitForSelector('#qGrid.grp .gq');
  check(await H.$$eval('.gopt.chosen', (x) => x.length) === 3, 'quay lại nhóm vẫn giữ lựa chọn');
  await H.click('#bNext'); await H.click('.pbtn.k1'); await H.click('#bNext');
  await H.waitForSelector('#sRes:not([hidden]) #rv .it', { timeout: 15000 });
  check((await H.textContent('#rS')) === '4/5', 'chấm 4/5: ' + await H.textContent('#rS'));
  check((await H.textContent('#rv')).includes('Đoạn văn câu 32–34') && (await H.textContent('#rv')).includes('34.'), 'xem lại: có đoạn văn nhóm, số câu theo đề');

  check(!errs.length, 'không có lỗi JavaScript (' + errs.length + ')');
  console.log(fails ? '✘ ' + fails + ' kiểm tra lỗi' : '✔ e2e-nhom.js: tất cả đều qua');
  await br.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
