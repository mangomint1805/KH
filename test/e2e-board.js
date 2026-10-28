// Thử hiệu ứng bảng xếp hạng với 7 người: có bạn từ ngoài top 5 lội ngược dòng vào, có bạn bị đẩy ra.
// Cần server + Emulator như e2e.js.  node test/e2e-board.js <file-excel-mẫu.xlsx>   (SHOTS=<thư mục> để lưu ảnh)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8000/KH/';
const KEY = [1, 0];
const SHOT = (n) => (process.env.SHOTS ? { path: process.env.SHOTS + '/' + n } : {});
let fails = 0;
const check = (ok, m) => { console.log(ok ? '  ✔' : '  ✘', m); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
  const br = await chromium.launch({ proxy });
  const mk = async (login, vp) => {
    const ctx = await br.newContext({ ignoreHTTPSErrors: true, viewport: vp || { width: 420, height: 800 } });
    await ctx.addInitScript((e) => { if (e) localStorage.setItem('mock.login', e); }, login || '');
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('   [pageerror]', p.url(), e.message, (e.stack || '').split('\n').slice(1, 3).join(' '))); return p;
  };
  const host = await mk('quangkhunpro@gmail.com', { width: 1366, height: 800 });
  await host.goto(BASE + 'admin.html'); await host.waitForSelector('#bNew');
  const news = await host.$('text=Đã hiểu'); if (news) await news.click();
  await host.click('#bNew');
  await host.setInputFiles('#file', process.argv[2]);
  await host.waitForSelector('text=Đã đọc 12 câu');
  await host.click('#bPlay'); await host.waitForSelector('.pin', { timeout: 15000 });
  const PIN = (await host.textContent('.pin')).trim();
  const names = ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Phúc', 'Giang'];
  const ps = [];
  for (const n of names) { const p = await mk(); await p.goto(BASE + 'play.html?pin=' + PIN); await p.fill('#name', n); await p.click('#go'); await p.waitForSelector('#sMsg:not([hidden])'); ps.push(p); }
  await host.waitForFunction(() => document.querySelectorAll('#names .nm').length === 7);
  // đổi theme ở phòng chờ (phím T): điện thoại đổi theo
  for (const t of ['idol', 'y2k', 'scifi']) {
    await host.keyboard.press('t');
    await ps[0].waitForFunction((t) => document.documentElement.getAttribute('data-qz') === t, t, { timeout: 8000 }).then(() => check(true, 'theme ' + t + ': điện thoại đổi theo'), () => check(false, 'theme ' + t + ': điện thoại chưa đổi'));
    await host.screenshot(SHOT('theme-' + t + '-lobby.png'));
  }
  await host.click('#bStart');
  // câu 1: An…Em đúng, Phúc và Giang sai  → Giang hạng 6-7
  // câu 2: chỉ Giang và Phúc đúng, Giang bấm nhanh nhất → Giang vào top 5
  const plan = [[1, 1, 1, 1, 1, 0, 0], [0, 0, 0, 0, 0, 1, 1]];
  for (let q = 0; q < 2; q++) {
    await Promise.all(ps.map((p) => p.waitForSelector('#sAns:not([hidden]) .pbtn', { timeout: 20000 })));
    if (q === 0) { await host.screenshot(SHOT('theme-scifi-q.png')); await ps[0].screenshot(SHOT('theme-scifi-phone.png')); }
    const order = q === 1 ? [6, 5, 0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
    for (const i of order) { await ps[i].click('.pbtn.k' + (plan[q][i] ? KEY[q] : (KEY[q] + 1) % 4)); await sleep(150); }
    await host.waitForSelector('#bNext', { timeout: 30000 });
    await host.keyboard.press('Space');
    await host.waitForSelector('.board2');
    if (q === 1) {
      await sleep(500); await host.screenshot(SHOT('board-1-dem-diem.png'));
      await sleep(1100); await host.screenshot(SHOT('board-2-bay-len.png'));
      await sleep(1200); await host.screenshot(SHOT('board-3-sang.png'));
      const cl = await host.$$eval('.board2 .r.cl', (els) => els.map((e) => e.querySelector('.nm').textContent + ' | ' + (e.querySelector('.badge') || {}).textContent));
      check(cl.some((t) => /Giang/.test(t) && /Lội ngược dòng/.test(t)), 'Giang lội ngược dòng vào top 5 có nhãn nổi bật: ' + cl.join(', '));
      check(await host.$('.board2 .r.cl.glow') !== null, 'dòng lội ngược dòng sáng lên');
      check(await host.$('.board2 .r.out') !== null, 'bạn bị đẩy khỏi top 5 trượt xuống rồi mờ đi');
    } else await host.keyboard.press('Space');
  }
  console.log(fails ? '\n✘ ' + fails + ' lỗi' : '\n✔ Tất cả đều qua');
  await br.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
