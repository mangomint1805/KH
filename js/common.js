/* Minto Quiz — phần dùng chung: Firebase, đồng hồ máy chủ, âm thanh, tiện ích.
   Cấu hình Firebase lấy từ /acc.js (window.MACC) của mangomint1805.github.io, không chép ra đây. */
export const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const DBURL = 'https://minto-english-default-rtdb.asia-southeast1.firebasedatabase.app';
export const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
export const SHAPES = ['▲', '◆', '●', '■'];
export const LETTERS = ['A', 'B', 'C', 'D'];

export const $ = (id) => document.getElementById(id);
export function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function show(id) { document.querySelectorAll('[data-screen]').forEach((el) => { el.hidden = el.id !== id; }); }

// Cùng cách kiểm tra giáo viên như acc.js (so mã băm email, không ghi email ra code công khai).
export function isTeacher(email) {
  const e = String(email || '').toLowerCase(); let x = 2166136261;
  for (let i = 0; i < e.length; i++) { x ^= e.charCodeAt(i); x = Math.imul(x, 16777619); }
  return (x >>> 0).toString(36) === '979n45';
}

function waitMACC() {
  return new Promise((ok, no) => {
    const t0 = Date.now();
    (function poll() {
      if (window.MACC && window.MACC.ready) return ok(window.MACC);
      if (Date.now() - t0 > 15000) return no(new Error('Không tải được acc.js'));
      setTimeout(poll, 100);
    })();
  });
}

let baseP = null;
// App mặc định của acc.js (đăng nhập Google). Dùng cho thầy.
export function base() {
  if (baseP) return baseP;
  baseP = waitMACC().then((M) => M.ready()).then(async (fb) => {
    await (fb.auth.authStateReady ? fb.auth.authStateReady() : Promise.resolve());
    const D = await import(SDK + 'firebase-database.js');
    const db = D.getDatabase(fb.app, DBURL);
    const emu = window.QZ_EMU;
    if (emu && !db._qzEmu) { D.connectDatabaseEmulator(db, emu.db[0], emu.db[1]); db._qzEmu = 1; }
    return { ...fb, D, db };
  });
  baseP.catch(() => { baseP = null; });
  return baseP;
}

let playP = null;
// App riêng tên 'quiz' cho học sinh: đăng nhập ẩn danh, không đụng tới tài khoản Google đang đăng nhập trên web chính.
export function player() {
  if (playP) return playP;
  playP = waitMACC().then((M) => M.ready()).then(async (fb) => {
    const [AP, A, D] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-database.js')]);
    let app; try { app = AP.getApp('quiz'); } catch (e) { app = AP.initializeApp(fb.app.options, 'quiz'); }
    const auth = A.getAuth(app);
    const db = D.getDatabase(app, DBURL);
    const emu = window.QZ_EMU;
    if (emu && !db._qzEmu) { A.connectAuthEmulator(auth, emu.auth, { disableWarnings: true }); D.connectDatabaseEmulator(db, emu.db[0], emu.db[1]); db._qzEmu = 1; }
    await auth.authStateReady();
    if (!auth.currentUser) await A.signInAnonymously(auth);
    return { A, D, auth, db, uid: auth.currentUser.uid };
  });
  playP.catch(() => { playP = null; });
  return playP;
}

// Giờ máy chủ: Date.now() + độ lệch đo được từ .info/serverTimeOffset
export function serverClock(D, db) {
  let off = 0;
  D.onValue(D.ref(db, '.info/serverTimeOffset'), (s) => { const v = s.val(); if (typeof v === 'number') off = v; });
  return () => Date.now() + off;
}

// Điểm kiểu Kahoot
export function points(ok, ms, limitSec, mult) {
  if (!ok || !mult) return 0;
  const t = Math.min(Math.max(ms, 0), limitSec * 1000) / (limitSec * 1000);
  return Math.round(1000 * (1 - t / 2)) * mult;
}
export function streakBonus(streak) { return streak >= 2 ? Math.min(500, 100 * (streak - 1)) : 0; }

// ---------- âm thanh tự tạo (WebAudio) ----------
export const Sound = (() => {
  let ctx = null, musicOn = false, sfxOn = true, loop = 0, step = 0, master = null;
  function ac() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, dur, type, vol, when) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  // nhạc nền: vòng hợp âm C – Am – F – G, nhịp nhẹ
  const CH = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
  function tick() {
    const ch = CH[Math.floor(step / 8) % 4], n = step % 8;
    tone(ch[n % 3] * (n >= 4 ? 2 : 1), 0.22, 'triangle', 0.06);
    if (n % 4 === 0) tone(ch[0] / 2, 0.4, 'sine', 0.09);
    step++;
  }
  function startLoop() { if (loop || !musicOn) return; ac(); loop = setInterval(tick, 230); }
  function stopLoop() { clearInterval(loop); loop = 0; }
  return {
    get music() { return musicOn; }, get sfx() { return sfxOn; },
    setMusic(v) { musicOn = v; if (v) startLoop(); else stopLoop(); },
    setSfx(v) { sfxOn = v; },
    unlock() { ac(); },
    pauseMusic() { stopLoop(); }, resumeMusic() { startLoop(); },
    tick() { if (sfxOn) tone(880, 0.06, 'square', 0.05); },
    join() { if (sfxOn) { tone(660, 0.1, 'sine', 0.12); tone(990, 0.12, 'sine', 0.12, 0.08); } },
    go() { if (sfxOn) [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, i * 0.09)); },
    end() { if (sfxOn) { tone(196, 0.5, 'sawtooth', 0.08); tone(147, 0.6, 'sine', 0.15, 0.05); } },
    reveal() { if (sfxOn) [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'sine', 0.12, i * 0.07)); },
    win() { if (sfxOn) [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.15)); },
  };
})();

// Pháo giấy cho bục vinh danh
export function confetti(canvas, ms) {
  const c = canvas.getContext('2d'), W = (canvas.width = innerWidth), H = (canvas.height = innerHeight), P = [];
  for (let i = 0; i < 180; i++) P.push({ x: Math.random() * W, y: -Math.random() * H, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 6, a: Math.random() * 6, col: COLORS[i % 4] });
  const t0 = performance.now();
  (function f(t) {
    c.clearRect(0, 0, W, H);
    P.forEach((p) => { p.x += p.vx; p.y += p.vy; p.a += 0.1; if (p.y > H) p.y = -10; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col; c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); });
    if (t - t0 < (ms || 6000)) requestAnimationFrame(f); else c.clearRect(0, 0, W, H);
  })(t0);
}
