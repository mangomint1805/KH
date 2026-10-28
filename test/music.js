// Thử mục "Nhạc theme": tải nhạc lên Firestore (Emulator), nghe thử, màn host tự tải về, học sinh không đọc được, đổi bài, xoá.
// node test/music.js <file.mp3> <file2.mp3>   (cần server + Emulator như e2e.js)
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8000/KH/', [F1, F2] = process.argv.slice(2);
let fails = 0;
const ok = (c, t) => { console.log(c ? '  ✔' : '  ✘', t); if (!c) fails++; };
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
  const br = await chromium.launch({ proxy, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await br.newContext({ ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => { localStorage.setItem('mock.login', 'quangkhunpro@gmail.com'); localStorage.setItem('qz.theme', 'idol'); });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { console.log('[pageerror]', e.message); fails++; });
  pg.on('dialog', (d) => d.accept());
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 200)); });
  await pg.goto(BASE + 'admin.html'); await pg.waitForSelector('#music .qrow', { timeout: 30000 });
  const news = await pg.$('text=Đã hiểu'); if (news) await news.click();
  ok(/Chưa có nhạc/.test(await pg.textContent('#music')), 'lúc đầu chưa có nhạc');
  await pg.setInputFiles('[data-mu="idol"]', F1);
  await pg.waitForSelector('[data-mp="idol"]', { timeout: 60000 });
  ok(/MB/.test(await pg.textContent('#music .qrow')), 'tải lên xong hiện tên + dung lượng');
  const meta = await pg.evaluate(async () => { const x = await window.MACC.fs(); const d = await x.F.getDoc(x.F.doc(x.db, 'quizMusic', 'idol')); return d.data(); });
  ok(meta && meta.n >= 2 && meta.g > 0.02 && meta.g < 1, 'chia ' + (meta && meta.n) + ' phần, mức âm g=' + (meta && meta.g.toFixed(3)));
  await pg.click('[data-mp="idol"]');
  await pg.waitForSelector('[data-mp="idol"]:has-text("Dừng")', { timeout: 30000 });
  ok(true, 'nghe thử phát được');
  await pg.click('[data-mp="idol"]');
  ok(/Nghe thử/.test(await pg.textContent('[data-mp="idol"]')), 'bấm lần nữa thì dừng');

  // màn host tải nhạc về (đúng từng byte)
  const h = await ctx.newPage(); h.on('pageerror', (e) => { console.log('[host pageerror]', e.message); fails++; });
  await h.goto(BASE + 'host.html'); await h.waitForSelector('#ctrl:not([hidden])', { timeout: 30000 });
  const got = await h.evaluate(async () => { const m = await import(new URL('js/common.js?v=14', location.href).href); const loaded = await m.loadTrack('idol'); const t = await m.fetchTrack('idol'); const b = await (await fetch(t.url)).arrayBuffer(); return { loaded, size: b.byteLength }; });
  const fs = require('fs');
  ok(got.loaded && got.size === fs.statSync(F1).size, 'màn host tải nhạc về đủ ' + got.size + ' byte');

  // học sinh (đăng nhập ẩn danh) không đọc được nhạc
  await h.close();
  const ctx2 = await br.newContext({ ignoreHTTPSErrors: true }), st = await ctx2.newPage();
  await st.goto(BASE + 'play.html'); await st.waitForSelector('#pin');
  const denied = await st.evaluate(async () => {
    const x = await window.MACC.ready();
    const A = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    await A.signInAnonymously(x.auth);
    try { await x.F.getDoc(x.F.doc(x.db, 'quizMusic', 'idol')); return false; } catch (e) { return /permission/i.test(e.code || e.message); }
  });
  ok(denied, 'tài khoản không phải giáo viên bị chặn đọc nhạc');
  await ctx2.close();

  // đổi bài: phần cũ bị xoá
  const oldAt = meta.at;
  await pg.setInputFiles('[data-mu="idol"]', F2);
  const nm2 = require('path').basename(F2);
  await pg.waitForFunction((n) => ((document.querySelector('#music .qrow') || {}).textContent || '').includes(n), nm2, { timeout: 60000 }).catch(async (e) => { console.log('DBG', await pg.textContent('#music'), await pg.$$eval('.toast', (t) => t.map((x) => x.textContent))); throw e; });
  const after = await pg.evaluate(async (at) => { const x = await window.MACC.fs(); const m = (await x.F.getDoc(x.F.doc(x.db, 'quizMusic', 'idol'))).data(); const o = await x.F.getDoc(x.F.doc(x.db, 'quizMusic', 'idol_' + at + '_0')); return { at: m.at, old: o.exists() }; }, oldAt);
  ok(after.at !== oldAt && !after.old, 'đổi bài xong phần nhạc cũ đã xoá');

  // xoá
  await pg.click('[data-mx="idol"]');
  await pg.waitForFunction(() => /Chưa có nhạc/.test((document.querySelector('#music .qrow') || {}).textContent || ''), null, { timeout: 30000 });
  const left = await pg.evaluate(async () => { const x = await window.MACC.fs(); const s = await x.F.getDocs(x.F.collection(x.db, 'quizMusic')); return s.size; });
  ok(left === 0, 'xoá xong không còn sót phần nào (' + left + ')');

  await br.close();
  console.log(fails ? '✘ Có lỗi' : '✔ Tất cả đều qua'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
