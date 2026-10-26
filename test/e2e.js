// Chạy thử cả trận: 1 host + nhiều người chơi trên Firebase Emulator.
// Cần: test/server.js (cổng 8000) và Emulator (auth 9099, database 9000, firestore 8080) đang chạy.
// node test/e2e.js <file-excel-mẫu.xlsx>
const { chromium, devices } = require('playwright');
const fs = require('fs');
const XLSX_FILE = process.argv[2];
const BASE = 'http://127.0.0.1:8000/KH/';
const TEACHER = 'quangkhunpro@gmail.com';
const KEY = 'B A D B C D D C A C B B'.split(' ').map((x) => x.charCodeAt(0) - 65);
const log = (...a) => console.log('•', ...a);
let fails = 0;
function check(ok, msg) { console.log(ok ? '  ✔' : '  ✘', msg); if (!ok) fails++; }

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
  const br = await chromium.launch({ proxy });
  const mk = async (login, dev) => {
    const ctx = await br.newContext({ ...(dev || {}), ignoreHTTPSErrors: true, acceptDownloads: true });
    if (login) await ctx.addInitScript((e) => localStorage.setItem('mock.login', e), login);
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => console.log('   [pageerror]', e.message));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text())) console.log('   [console]', m.text().slice(0, 200)); });
    return pg;
  };

  // ---------- người lạ không vào được trang giáo viên ----------
  log('Tài khoản không phải giáo viên');
  const stranger = await mk('hocsinh@gmail.com');
  await stranger.goto(BASE + 'admin.html');
  await stranger.waitForSelector('text=Trang dành cho giáo viên');
  check(true, 'admin.html chặn tài khoản khác');
  const sDenied = await stranger.evaluate(async () => {
    const x = await window.MACC.fs();
    try { await x.F.getDocs(x.F.collection(x.db, 'quizzes')); return 'read-ok'; } catch (e) { return e.code; }
  });
  check(/permission/.test(sDenied), 'Firestore chặn đọc quizzes: ' + sDenied);

  // ---------- thầy nhập file Excel ----------
  log('Thầy nhập file Excel mẫu Kahoot');
  const host = await mk(TEACHER, { viewport: { width: 1366, height: 800 } });
  await host.goto(BASE + 'admin.html');
  await host.waitForSelector('#bNew');
  const news = await host.$('text=Đã hiểu'); if (news) await news.click();
  await host.click('#bNew');
  await host.setInputFiles('#file', XLSX_FILE);
  await host.waitForSelector('text=Đã đọc 12 câu');
  const nq = await host.$$eval('.qe', (x) => x.length);
  check(nq === 12, 'đọc được ' + nq + ' câu');
  const keys = await host.$$eval('.qe', (els) => els.map((e) => [...e.querySelectorAll('[data-c]')].findIndex((c) => c.checked)));
  check(JSON.stringify(keys) === JSON.stringify(KEY), 'đáp án đúng khớp 1B 2A 3D … 12B');
  check(await host.$eval('#title', (e) => e.value) !== '', 'tự đặt tên bộ: ' + await host.$eval('#title', (e) => e.value));
  // câu 12 đổi thành gấp đôi
  await host.selectOption('.qe[data-i="11"] [data-f=pts]', '2');
  // file lỗi
  await host.setInputFiles('#file', { name: 'loi.txt', mimeType: 'text/plain', buffer: Buffer.from('xin chao\nkhong phai de') });
  await host.waitForSelector('#imp .err');
  check(true, 'file lỗi báo: ' + await host.$eval('#imp', (e) => e.textContent));
  // câu thiếu đáp án đúng chặn lưu
  await host.click('#bAdd');
  await host.click('#bSave');
  check(await host.$('.qe.bad') !== null, 'câu trống bị đánh dấu lỗi, không lưu');
  host.once('dialog', (d) => d.accept());
  await host.click('.qe[data-i="12"] [data-a=del]');
  if (process.env.SHOTS) await host.screenshot({ path: process.env.SHOTS + '/admin.png' });
  await host.click('#bPlay');
  await host.waitForURL(/host\.html/);
  await host.waitForSelector('.pin', { timeout: 15000 });
  const PIN = (await host.textContent('.pin')).trim();
  check(/^\d{6}$/.test(PIN), 'tạo phòng PIN ' + PIN);
  check(await host.$('.qr svg') !== null, 'có mã QR');

  // ---------- học sinh vào phòng ----------
  log('Học sinh vào phòng');
  const join = async (name, dev) => {
    const p = await mk(null, dev);
    await p.goto(BASE + 'play.html?pin=' + PIN);
    await p.fill('#name', name);
    await p.click('#go');
    await p.waitForSelector('text=Bạn đã vào phòng', { timeout: 15000 });
    return p;
  };
  const P1 = await join('An', devices['iPhone 13']);
  if (process.env.SHOTS) await P1.screenshot({ path: process.env.SHOTS + '/phone-lobby.png' });
  const P2 = await join('An');
  const P3 = await join('Bình');
  check((await P2.textContent('#who')) === 'An 2', 'trùng tên tự đổi thành "' + (await P2.textContent('#who')) + '"');
  const bad = await join('Tên xấu');
  await host.waitForFunction(() => document.querySelectorAll('#names .nm').length === 4);
  if (process.env.SHOTS) await host.screenshot({ path: process.env.SHOTS + '/host-lobby.png' });
  host.once('dialog', (d) => d.accept());
  await host.click('#names .nm:has-text("Tên xấu") button');
  await bad.waitForSelector('text=mời ra khỏi phòng');
  check(true, 'mời người chơi ra được');
  await bad.goto(BASE + 'play.html?pin=' + PIN); await bad.fill('#name', 'Tên khác'); await bad.click('#go');
  await bad.waitForSelector('#jerr:not(:empty)');
  check(true, 'người bị mời ra không vào lại được: ' + await bad.textContent('#jerr'));

  // ---------- gian lận ----------
  const cheat = (p, fn, arg) => p.evaluate(async ([src, arg]) => {
    const m = await import('/KH/js/common.js?v=1'); const P = await m.player();
    const fn = new Function('P', 'arg', 'return (async()=>{' + src + '})()');
    try { return await fn(P, arg); } catch (e) { return 'ERR ' + (e.code || e.message); }
  }, [fn, arg]);
  const pinArg = { pin: PIN };
  check(/ERR/.test(await cheat(P1, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/state'),{phase:'end',q:0,qs:'0'}); return 'ok'", pinArg)), 'học sinh không sửa được state');
  check(/ERR/.test(await cheat(P1, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/scores/'+P.uid),{s:99999}); return 'ok'", pinArg)), 'học sinh không tự ghi điểm');
  check(/ERR/.test(await cheat(P1, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/0/'+P.uid),{a:1,at:P.D.serverTimestamp()}); return 'ok'", pinArg)), 'không trả lời trước khi câu hỏi mở');
  check(/ERR/.test(await cheat(P1, "const s=await P.D.get(P.D.ref(P.db,'quiz')); return JSON.stringify(s.val()).slice(0,50)", pinArg)), 'không đọc được toàn bộ quiz/');

  // ---------- chơi ----------
  log('Bắt đầu chơi 12 câu');
  await host.click('#bStart');
  const plan = [ // [P1, P2, P3]: 'c' đúng, 'w' sai, null không trả lời
    ['c', 'w', 'c'], ['c', 'c', 'w'], ['c', 'w', 'c'], ['c', 'c', 'c'], ['c', 'w', null], ['c', 'c', 'c'],
    ['c', 'w', 'c'], ['c', 'c', 'w'], ['c', 'c', 'c'], ['c', 'w', 'c'], ['c', 'c', 'c'], ['c', 'c', 'c'],
  ];
  let P4 = null;
  for (let q = 0; q < 12; q++) {
    const ps = [P1, P2, P3].concat(P4 ? [P4] : []);
    await Promise.all(ps.map((p) => p.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 })));
    if (q === 1) {
      const early = await cheat(P1, "const st=(await P.D.get(P.D.ref(P.db,'quiz/'+arg.pin+'/state'))).val(); await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/1/'+P.uid),{a:0,at:st.startAt-3000}); return 'ok'", pinArg);
      check(/ERR/.test(early), 'không khai được giờ bấm trước lúc mở câu');
      const back = await cheat(P1, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/1/'+P.uid),{a:0,at:Date.now()-4000}); return 'ok'", pinArg);
      check(/ERR/.test(back), 'không lùi giờ bấm về trước lúc mở câu (bấm ngay khi vừa mở)');
    }
    if (q === 0 && process.env.SHOTS) { await host.screenshot({ path: process.env.SHOTS + '/host-question.png' }); await P1.screenshot({ path: process.env.SHOTS + '/phone-answer.png' }); }
    if (q === 2) { // tải lại trang giữa câu
      await P3.reload(); await P3.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 });
      check(true, 'P3 tải lại trang giữa câu 3, vào lại đúng câu');
    }
    if (q === 3) { // thầy tải lại màn host giữa câu
      await host.reload(); await host.waitForSelector('#tm', { timeout: 20000 });
      check(true, 'host tải lại trang giữa câu 4, tiếp tục được');
    }
    const acts = plan[q].concat(P4 ? ['c'] : []);
    for (let i = 0; i < ps.length; i++) {
      const a = acts[i]; if (!a) continue;
      const idx = a === 'c' ? KEY[q] : (KEY[q] + 1) % 4;
      await ps[i].click('.pbtn.k' + idx);
      await ps[i].waitForSelector('text=Đã chọn');
      if (i === 0 && q === 0) {
        const k = await cheat(P1, "const s=await P.D.get(P.D.ref(P.db,'quiz/'+arg.pin+'/key/0')); return s.exists()?'leak':'none'", pinArg);
        check(k === 'none', 'đáp án đúng chưa có trên máy chủ khi đang trả lời');
      }
      if (i === 0) await new Promise((r) => setTimeout(r, 300));
    }
    if (q === 0) {
      const dbl = await cheat(P1, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/0/'+P.uid),{a:0,at:P.D.serverTimestamp()}); return 'ok'", pinArg);
      check(/ERR/.test(dbl), 'không sửa được câu trả lời đã gửi');
      const peek = await cheat(P1, "const s=await P.D.get(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/0')); return 'ok'", pinArg);
      check(/ERR/.test(peek), 'không xem được câu trả lời của bạn khác');
    }
    if (plan[q].includes(null)) await host.click('#bSkip');
    await host.waitForSelector('#bNext', { timeout: 40000 });
    await Promise.all(ps.map((p) => p.waitForSelector('#sRes:not([hidden])', { timeout: 15000 })));
    if (q === 0 && process.env.SHOTS) { await host.screenshot({ path: process.env.SHOTS + '/host-reveal.png' }); await P2.screenshot({ path: process.env.SHOTS + '/phone-result.png' }); }
    const r1 = await P1.textContent('#rBox');
    check(/Chính xác/.test(r1), 'câu ' + (q + 1) + ': P1 thấy "' + r1.replace(/\s+/g, ' ').trim() + '", hạng ' + await P1.textContent('#rRank'));
    if (q === 4) {
      check(/Hết giờ/.test(await P3.textContent('#rBox')), 'P3 không trả lời câu 5 → "Hết giờ"');
      const late = await cheat(P3, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/4/'+P.uid),{a:0,at:P.D.serverTimestamp()}); return 'ok'", pinArg);
      check(/ERR/.test(late), 'trả lời sau khi khoá bị chặn');
    }
    await host.keyboard.press('Space');
    if (q < 11) {
      await host.waitForSelector('.board');
      if (q === 5) { P4 = await join('Chi'); check(true, 'người vào trễ (câu 7) được'); }
      await host.keyboard.press('Space');
    }
  }
  await host.waitForSelector('.podium');
  await new Promise((r) => setTimeout(r, 3000));
  await host.screenshot({ path: process.env.SHOTS + '/host-podium.png' });
  const end1 = await P1.textContent('#sMsg');
  check(/hạng 1/.test(end1), 'P1 cuối game: ' + end1.replace(/\s+/g, ' ').trim());
  const [dl] = await Promise.all([host.waitForEvent('download'), host.click('#bCsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  fs.writeFileSync(process.env.SHOTS + '/ket-qua.csv', csv);
  const lines = csv.trim().split(/\r?\n/);
  check(lines.length === 5, 'CSV có ' + (lines.length - 1) + ' người chơi');
  console.log(lines.slice(0, 5).map((l) => '    ' + l.slice(0, 110)).join('\n'));
  await P1.screenshot({ path: process.env.SHOTS + '/phone-end.png' });
  console.log(fails ? '\n✘ ' + fails + ' lỗi' : '\n✔ Tất cả đều qua');
  await br.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
