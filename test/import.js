// Thử nhập file .docx, .pdf, .csv trên trình duyệt thật (cần server + Emulator như e2e.js)
// node test/import.js <thư-mục-chứa de.docx>
const { chromium } = require('playwright');
const path = require('path');
const DIR = process.argv[2], BASE = 'http://127.0.0.1:8000/KH/';
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
  const br = await chromium.launch({ proxy });
  const ctx = await br.newContext({ ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => { localStorage.setItem('mock.login', 'quangkhunpro@gmail.com'); });
  // tạo PDF từ văn bản đề bằng chính Chromium
  const mk = await ctx.newPage();
  await mk.setContent('<pre style="font:14px sans-serif">1. Emily introduced ____ before beginning the job interview.\n(A) she  (B) herself  (C) hers  (D) her\nAnswer: B\n\n2. Attendance at the festival increased by ____ 30 percent.\n(A) most (B) almost (C) mostly (D) the most\nAnswer: B</pre>');
  const pdfPath = path.join(DIR, 'de.pdf'); await mk.pdf({ path: pdfPath });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('[pageerror]', e.message));
  pg.on('dialog', (d) => (/TOÀN BỘ/.test(d.message()) ? d.accept() : d.dismiss())); // hỏi thêm vào cuối? Huỷ → thay toàn bộ? OK
  await pg.goto(BASE + 'admin.html'); await pg.waitForSelector('#bNew');
  const news = await pg.$('text=Đã hiểu'); if (news) await news.click();
  await pg.click('#bNew');
  let fails = 0;
  for (const [f, n, key] of [['de.docx', 2, [1, 0]], ['de.pdf', 2, [1, 1]]]) {
    await pg.setInputFiles('#file', path.join(DIR, f));
    await pg.waitForSelector('text=Đã đọc', { timeout: 30000 }).catch(() => {});
    const got = await pg.$$eval('.qe', (els) => els.map((e) => [...e.querySelectorAll('[data-c]')].findIndex((c) => c.checked)));
    const opts = await pg.$$eval('.qe [data-o]', (els) => els.slice(0, 4).map((e) => e.value));
    const ok = got.length === n && JSON.stringify(got) === JSON.stringify(key);
    console.log(ok ? '  ✔' : '  ✘', f, '→', got.length, 'câu, đáp án', got, opts.join('|'), '|', await pg.textContent('#imp'));
    if (!ok) fails++;
  }
  await br.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
