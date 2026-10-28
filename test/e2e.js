// Chạy thử cả trận: 1 host + nhiều người chơi trên Firebase Emulator.
// Giống e2e.js, thêm: thanh tham gia, âm báo khi trả lời, hình câu hỏi, tạm dừng, khoá lưu phòng riêng.
// Cần: test/server.js (cổng 8000) và Emulator (auth 9099, database 9000, firestore 8080) đang chạy.
// node test/e2e.js <file-excel-mẫu.xlsx>   (đặt SHOTS=<thư mục> để lưu ảnh chụp)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const XLSX_FILE = process.argv[2];
const BASE = process.env.BASE || 'http://127.0.0.1:8000/KH/';
const SHOT = (n) => (process.env.SHOTS ? { path: process.env.SHOTS + '/' + n } : {});
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
    await ctx.addInitScript(() => { window.__osc = 0; const C = window.AudioContext; if (C) { const o = C.prototype.createOscillator; C.prototype.createOscillator = function () { window.__osc++; return o.call(this); }; } });
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
  // thêm hình cho câu 1 (dùng ảnh chụp màn hình làm hình mẫu)
  const pic = await host.screenshot();
  await host.setInputFiles('.qe[data-i="0"] [data-f=img]', { name: 'tranh.png', mimeType: 'image/png', buffer: pic });
  await host.waitForSelector('.qe[data-i="0"] img.qthumb[src^="data:image/jpeg"]');
  check(true, 'thêm hình cho câu 1');
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
  await host.screenshot(SHOT('admin.png'));
  await host.click('#bPlay');
  await host.waitForURL(/host\.html/);
  await host.waitForSelector('.pin', { timeout: 15000 });
  const PIN = (await host.textContent('.pin')).trim();
  check(/^\d{6}$/.test(PIN), 'tạo phòng PIN ' + PIN);
  check(await host.$('.qr svg') !== null, 'có mã QR');
  const lsk = await host.evaluate(() => [null, localStorage.getItem('qz.host')]);
  check(lsk[1] === PIN, 'máy thầy nhớ phòng đang mở');

  // ---------- học sinh vào phòng ----------
  log('Học sinh vào phòng');
  const join = async (name, dev) => {
    const p = await mk(null, dev);
    await p.goto(BASE + 'play.html?pin=' + PIN);
    await p.fill('#name', name);
    await p.click('#go');
    await p.waitForSelector('text=Vào phòng rồi nè', { timeout: 15000 });
    return p;
  };
  const P1 = await join('An', devices['iPhone 13']);
  await P1.screenshot(SHOT('phone-lobby.png'));
  const P2 = await join('An');
  const P3 = await join('Bình');
  check((await P2.textContent('#who')) === 'An 2', 'trùng tên tự đổi thành "' + (await P2.textContent('#who')) + '"');
  const bad = await join('Tên xấu');
  await host.waitForFunction(() => document.querySelectorAll('#names .nm').length === 4);
  check(await host.isHidden('#jstrip'), 'phòng chờ không hiện thanh tham gia');
  await host.screenshot(SHOT('host-lobby.png'));
  host.once('dialog', (d) => d.accept());
  await host.click('#names .nm:has-text("Tên xấu") button');
  await bad.waitForSelector('text=bị mời ra khỏi phòng');
  check(true, 'mời người chơi ra được');
  await bad.goto(BASE + 'play.html?pin=' + PIN); await bad.fill('#name', 'Tên khác'); await bad.click('#go');
  await bad.waitForSelector('#jerr:not(:empty)');
  check(true, 'người bị mời ra không vào lại được: ' + await bad.textContent('#jerr'));

  // ---------- gian lận ----------
  const cheat = (p, fn, arg) => p.evaluate(async ([src, arg]) => {
    const m = await import(new URL('js/common.js?v=13', location.href).href); const P = await m.player();
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
  await host.waitForSelector('.qimg.big', { timeout: 15000 });
  check(true, 'câu 1 hiện hình lúc giới thiệu câu');
  await host.screenshot(SHOT('b-show-img.png'));
  const plan = [ // [P1, P2, P3]: 'c' đúng, 'w' sai, null không trả lời
    ['c', 'w', 'c'], ['c', 'c', 'w'], ['c', 'w', 'c'], ['c', 'c', 'c'], ['c', 'w', null], ['c', 'c', 'c'],
    ['c', 'w', 'c'], ['c', 'c', 'w'], ['c', 'c', 'c'], ['c', 'w', 'c'], ['c', 'c', 'c'], ['c', 'c', 'c'],
  ];
  let P4 = null;
  for (let q = 0; q < 12; q++) {
    const ps = [P1, P2, P3].concat(P4 ? [P4] : []);
    await Promise.all(ps.map((p) => p.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 })));
    if (q === 0) { await host.screenshot(SHOT('host-question.png')); await P1.screenshot(SHOT('phone-answer.png')); }
    if (q === 2) { // tải lại trang giữa câu
      await P3.reload(); await P3.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 });
      check(true, 'P3 tải lại trang giữa câu 3, vào lại đúng câu');
    }
    if (q === 3) { // thầy tải lại màn host giữa câu
      await host.reload(); await host.waitForSelector('#tm', { timeout: 20000 });
      check(true, 'host tải lại trang giữa câu 4, tiếp tục được');
    }
    if (q === 0) {
      check(await host.$('#pics img.qimg') !== null, 'câu 1 hiện hình lúc trả lời');
      await host.screenshot(SHOT('b-strip.png'));
      check(await host.isVisible('#jstrip .qrbtn'), 'thanh "Tham gia tại" hiện khi đang chơi');
      await host.click('#jstrip .qrbtn'); await host.waitForSelector('.qrov svg');
      await host.click('.qrov'); check(!(await host.$('.qrov')), 'bấm để mở/đóng QR lớn');
    }
    if (q === 1) { // tạm dừng 6 giây rồi tiếp tục: thời gian dừng không bị tính vào thời gian trả lời
      await host.keyboard.press('p');
      await P1.waitForSelector('text=tạm dừng');
      await host.waitForSelector('#bResume'); await new Promise((r) => setTimeout(r, 1000));
      await host.screenshot(SHOT('b-pause.png'));
      const blocked = await cheat(P1, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/1/'+P.uid),{a:0,at:P.D.serverTimestamp()}); return 'ok'", pinArg);
      check(/ERR/.test(blocked), 'đang tạm dừng thì không gửi được đáp án');
      await new Promise((r) => setTimeout(r, 6000));
      await host.keyboard.press('p');
      await Promise.all(ps.map((p) => p.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 15000 })));
      check(true, 'tiếp tục sau tạm dừng, điện thoại hiện lại 4 ô');
    }
    const osc0 = await host.evaluate(() => window.__osc);
    const acts = plan[q].concat(P4 ? ['c'] : []);
    for (let i = 0; i < ps.length; i++) {
      const a = acts[i]; if (!a) continue;
      const idx = a === 'c' ? KEY[q] : (KEY[q] + 1) % 4;
      await ps[i].click('.pbtn.k' + idx);
      try { await ps[i].waitForSelector('#sendst, #sRes:not([hidden])', { timeout: 8000 }); } catch (e) { await ps[i].screenshot(SHOT('fail-p' + i + '.png')); console.log('FAIL BODY p' + i + ':', (await ps[i].evaluate(() => [...document.querySelectorAll('[data-screen]')].filter(x=>!x.hidden).map(x=>x.id+': '+x.innerText).join(' | '))).slice(0, 400)); throw e; }
      if (i === 0 && q === 0) {
        const k = await cheat(P1, "const s=await P.D.get(P.D.ref(P.db,'quiz/'+arg.pin+'/key/0')); return s.exists()?'leak':'none'", pinArg);
        check(k === 'none', 'đáp án đúng chưa có trên máy chủ khi đang trả lời');
      }
      if (i === 0) await new Promise((r) => setTimeout(r, 300));
      if (i === 0 && q === 0) { await new Promise((r) => setTimeout(r, 300)); const d = (await host.evaluate(() => window.__osc)) - osc0; check(d >= 2, 'máy thầy kêu khi có bạn chọn đáp án'); }
    }
    if (q === 0) {
      const dbl = await cheat(P1, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/0/'+P.uid),{a:0,at:P.D.serverTimestamp()}); return 'ok'", pinArg);
      check(/ERR/.test(dbl), 'không sửa được câu trả lời đã gửi');
      const peek = await cheat(P1, "const s=await P.D.get(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/0')); return 'ok'", pinArg);
      check(/ERR/.test(peek), 'không xem được câu trả lời của bạn khác');
    }
    if (plan[q].includes(null)) await host.click('#bSkip');
    if (q === 11) { // bấm Space lúc đang hiện "Hết giờ!" / "Everyone's locked in": phải bị bỏ qua, không kẹt
      await host.waitForSelector('.timesup', { timeout: 10000 }).catch(() => {});
      await host.keyboard.press('Space'); await host.keyboard.press('Space');
    }
    await host.waitForSelector('#bNext', { timeout: 40000 });
    if (q === 11) { await new Promise((r) => setTimeout(r, 800)); check(await host.$('.chart') !== null, 'Space lúc "Hết giờ!" ở câu cuối không làm kẹt, vẫn ở màn đáp án'); }
    await Promise.all(ps.map((p) => p.waitForSelector('#sRes:not([hidden])', { timeout: 15000 })));
    if (q === 0) { await host.screenshot(SHOT('host-reveal.png')); await P2.screenshot(SHOT('phone-result.png')); }
    const r1 = await P1.textContent('#rBox');
    if (q === 1) { const pts = +(/\+(\d+)/.exec(r1) || [0, 0])[1]; check(pts >= 1060, 'câu 2 (có tạm dừng 6 giây) vẫn được ' + pts + ' điểm, không bị trừ thời gian dừng'); }
    check(/res ok/.test(await P1.$eval('#rBox', (e) => e.className)), 'câu ' + (q + 1) + ': P1 thấy "' + r1.replace(/\s+/g, ' ').trim() + '", hạng ' + await P1.textContent('#rRank'));
    if (q === 4) {
      check(/⌛/.test(await P3.textContent('#rBox')), 'P3 không trả lời câu 5 → "Hết giờ"');
      const late = await cheat(P3, "await P.D.set(P.D.ref(P.db,'quiz/'+arg.pin+'/answers/4/'+P.uid),{a:0,at:P.D.serverTimestamp()}); return 'ok'", pinArg);
      check(/ERR/.test(late), 'trả lời sau khi khoá bị chặn');
    }
    await host.keyboard.press('Space');
    if (q < 11) {
      await host.waitForSelector('.board2');
      if (q === 2) { // bấm Space dồn 3 lần ở bảng xếp hạng: chỉ được sang đúng 1 câu
        await host.keyboard.press('Space'); await host.keyboard.press('Space'); await host.keyboard.press('Space');
        await new Promise((r) => setTimeout(r, 1500));
        const st = await host.evaluate(() => document.querySelector('.qmeta') && document.querySelector('.qmeta').textContent);
        check(/Câu 4\//.test(st || ''), 'bấm Space dồn chỉ sang đúng câu 4: ' + (st || '').trim().slice(0, 20));
        continue;
      }
      if (q === 5) { P4 = await join('Chi'); check(true, 'người vào trễ (câu 7) được'); }
      await host.keyboard.press('Space');
    }
  }
  await host.waitForSelector('.podium');
  check(await host.isHidden('#jstrip'), 'cuối game ẩn thanh tham gia');
  await new Promise((r) => setTimeout(r, 3000));
  await host.screenshot(SHOT('host-podium.png'));
  const end1 = await P1.textContent('#sMsg');
  check(/hạng 1/.test(end1), 'P1 cuối game: ' + end1.replace(/\s+/g, ' ').trim());
  const [dl] = await Promise.all([host.waitForEvent('download'), host.click('#bCsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  fs.writeFileSync((process.env.SHOTS || require('os').tmpdir()) + '/ket-qua.csv', csv);
  const lines = csv.trim().split(/\r?\n/);
  check(lines.length === 5, 'CSV có ' + (lines.length - 1) + ' người chơi');
  console.log(lines.slice(0, 5).map((l) => '    ' + l.slice(0, 110)).join('\n'));
  await P1.screenshot(SHOT('phone-end.png'));
  console.log(fails ? '\n✘ ' + fails + ' lỗi' : '\n✔ Tất cả đều qua');
  await br.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
