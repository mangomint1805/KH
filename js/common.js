/* Minto Quiz — phần dùng chung: Firebase, đồng hồ máy chủ, âm thanh, tiện ích.
   Cấu hình Firebase lấy từ /acc.js (window.MACC) của mangomint1805.github.io, không chép ra đây. */
export const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const DBURL = 'https://minto-english-default-rtdb.asia-southeast1.firebasedatabase.app';
export const COLORS = ['#e21b3c', '#0891d1', '#d89e00', '#26890c'];
export const SHAPES = ['▲', '◆', '●', '■'];
export const LETTERS = ['A', 'B', 'C', 'D'];

// Theme màn chơi: tím Kahoot + 3 theme của web Minto English (Hành baro, Thiên thần, Băng hoại)
export const THEMES = [
  { id: 'kahoot', n: 'Tím Kahoot', c: '#46178f', sw: 'linear-gradient(135deg,#46178f,#6a2ecf)' },
  { id: 'idol', n: 'Hành baro', c: '#0a6766', sw: 'linear-gradient(135deg,#0a6766,#12a4a3 60%,#ff5fa2)' },
  { id: 'y2k', n: 'Thiên thần', c: '#9b2c66', sw: 'linear-gradient(135deg,#e0559a,#8b5cf6)' },
  { id: 'scifi', n: 'Băng hoại', c: '#0a1024', sw: 'linear-gradient(135deg,#0a1024,#4ad7ff 55%,#b04cff)' },
];
export function themeOf(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; }
export function applyTheme(id) {
  const t = themeOf(id), r = document.documentElement;
  if (t.id === 'kahoot') r.removeAttribute('data-qz'); else r.setAttribute('data-qz', t.id);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t.c);
  return t.id;
}
// theme mặc định của máy thầy: lần chọn trước, nếu chưa có thì theo theme đang dùng trên web Minto English
export function savedTheme() {
  try {
    const v = localStorage.getItem('qz.theme'); if (v) return themeOf(v).id;
    let s = localStorage.getItem('mt.skin') || ''; try { s = JSON.parse(s); } catch (e) {}
    return themeOf(s).id;
  } catch (e) { return 'kahoot'; }
}

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

// ---------- âm thanh tự tạo (WebAudio), không dùng nhạc của Kahoot ----------
// Nhạc nền có 2 kiểu: 'lobby' (phòng chờ, vui) và 'q' (lúc trả lời, dồn dập hơn). Lịch nốt chạy trước ~0.2 giây để không giật.
export const Sound = (() => {
  let ctx = null, master = null, musicBus = null, noiseBuf = null;
  let musicOn = false, sfxOn = true, mode = 'lobby', paused = true, loop = 0, step = 0, nextT = 0, fast = false;
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.9; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, dur, type, vol, when, bus, glide) {
    const c = ac(); if (!c) return;
    const t = Math.max(c.currentTime, when == null ? c.currentTime : when), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, when, hp, bus) {
    const c = ac(); if (!c) return;
    const t = Math.max(c.currentTime, when == null ? c.currentTime : when), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp || 6000;
    g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || master); s.start(t); s.stop(t + dur + 0.02);
  }
  const later = (s) => (ctx ? ctx.currentTime + s : 0);
  // ---- nhạc phòng chờ: C – G – Am – F, nhịp 112 ----
  const LOBBY = { bpm: 112, ch: [[262, 330, 392], [196, 247, 294], [220, 262, 330], [175, 220, 262]], bass: [131, 98, 110, 87] };
  // ---- nhạc trả lời: Am – Am – F – E, nhịp 132, ostinato + hi-hat ----
  const QUEST = { bpm: 132, ch: [[220, 262, 330], [220, 262, 330], [175, 220, 262], [165, 208, 247]], bass: [110, 110, 87, 82] };
  function schedule(t) {
    const L = mode === 'q' ? QUEST : LOBBY, bar = Math.floor(step / 8) % 4, n = step % 8, ch = L.ch[bar];
    if (mode === 'q') {
      tone(ch[[0, 2, 1, 2][n % 4]] * 2, 0.12, 'square', fast ? 0.045 : 0.032, t, musicBus);
      if (n % 2 === 0) tone(L.bass[bar], 0.2, 'triangle', 0.16, t, musicBus);
      noise(0.03, fast ? 0.06 : 0.035, t, 8000, musicBus);
      if (n === 4) noise(0.08, 0.05, t, 1800, musicBus);
    } else {
      const arp = [0, 1, 2, 1, 0, 2, 1, 2][n];
      tone(ch[arp] * 2, 0.22, 'triangle', 0.05, t, musicBus);
      if (n % 4 === 0) tone(L.bass[bar], 0.38, 'sine', 0.14, t, musicBus);
      if (n === 2 || n === 6) noise(0.06, 0.03, t, 2500, musicBus);
      if (n === 0 && bar % 2 === 0) tone(ch[2] * 4, 0.18, 'sine', 0.03, t + 0.01, musicBus);
    }
    step++;
  }
  function pump() {
    if (!ctx) return;
    const L = mode === 'q' ? QUEST : LOBBY, dt = 60 / (fast ? L.bpm * 1.25 : L.bpm) / 2;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.2) { schedule(nextT); nextT += dt; }
  }
  function startLoop() { if (loop || !musicOn || paused) return; if (!ac()) return; nextT = 0; loop = setInterval(pump, 50); pump(); }
  function stopLoop() { clearInterval(loop); loop = 0; }
  return {
    get music() { return musicOn; }, get sfx() { return sfxOn; },
    setMusic(v) { musicOn = v; if (v) startLoop(); else stopLoop(); },
    setSfx(v) { sfxOn = v; },
    unlock() { ac(); },
    // kiểu nhạc: 'lobby' | 'q' | null (tắt tạm)
    mode(m) { stopLoop(); fast = false; if (!m) { paused = true; return; } if (m !== mode) step = 0; mode = m; paused = false; startLoop(); },
    hurry(v) { fast = !!v; },
    pauseMusic() { paused = true; stopLoop(); }, resumeMusic() { paused = false; startLoop(); },
    // có bạn vừa chọn đáp án: tiếng 'bụp' nhỏ, cao dần theo số người đã trả lời
    answer(n) { if (sfxOn) { const f = 520 + Math.min(n, 24) * 28; tone(f, 0.07, 'sine', 0.16); tone(f * 1.5, 0.06, 'triangle', 0.06, later(0.04)); } },
    tick() { if (sfxOn) { tone(1320, 0.05, 'square', 0.06); } },
    join() { if (sfxOn) { tone(523, 0.08, 'sine', 0.14); tone(784, 0.1, 'sine', 0.14, later(0.07)); tone(1047, 0.12, 'sine', 0.1, later(0.14)); } },
    go() { if (sfxOn) [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, later(i * 0.08))); },
    count(n) { if (sfxOn) tone(n ? 660 : 990, n ? 0.18 : 0.4, 'triangle', 0.2); },
    whoosh() { if (sfxOn) { noise(0.35, 0.08, null, 900); tone(300, 0.35, 'sine', 0.05, null, null, 900); } },
    timeup() { if (sfxOn) { tone(196, 0.9, 'sawtooth', 0.07); tone(147, 1.1, 'sine', 0.2, later(0.02)); noise(0.5, 0.06, null, 300); } },
    end() { this.timeup(); },
    reveal() { if (sfxOn) [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, later(i * 0.07))); },
    drum(sec) { if (!sfxOn || !ac()) return; const n = Math.round((sec || 2) * 16); for (let i = 0; i < n; i++) noise(0.05, 0.03 + 0.07 * i / n, later(i / 16), 1500); tone(98, 0.6, 'sine', 0.25, later(sec || 2)); noise(0.6, 0.12, later(sec || 2), 3000); },
    // bạn lội ngược dòng vào top 5: tiếng vút lên + leng keng
    climb() { if (sfxOn) { tone(330, 0.5, 'sawtooth', 0.05, null, null, 1320); [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.22, 'sine', 0.1, later(0.45 + i * 0.07))); } },
    win() { if (sfxOn) [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.28, 'triangle', 0.15, later(i * 0.14))); },
  };
})();

// Nền chuyển động: các hình ▲ ◆ ● ■ trôi chầm chậm (CSS transform, nhẹ cho máy chiếu cũ)
export function bgfx(n) {
  if (document.querySelector('.bgfx')) return;
  const d = document.createElement('div'); d.className = 'bgfx'; d.setAttribute('aria-hidden', 'true');
  const shapes = ['▲', '◆', '●', '■'];
  let h = '';
  for (let i = 0; i < (n || 14); i++) {
    const sz = 40 + Math.round(Math.random() * 120), x = Math.round(Math.random() * 100), dur = 18 + Math.round(Math.random() * 22), del = -Math.round(Math.random() * dur);
    h += '<span style="left:' + x + '%;font-size:' + sz + 'px;animation-duration:' + dur + 's;animation-delay:' + del + 's">' + shapes[i % 4] + '</span>';
  }
  d.innerHTML = h; document.body.prepend(d);
}

// Đếm số tăng dần (điểm, số người trả lời)
export function countUp(el, from, to, ms) {
  if (!el) return; const t0 = performance.now(), d = ms || 900;
  (function f(t) { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(f); })(t0);
}

// Pháo giấy cho bục vinh danh
export function confetti(canvas, ms) {
  if (!canvas) return;
  const c = canvas.getContext('2d'), W = (canvas.width = innerWidth), H = (canvas.height = innerHeight), P = [];
  const cols = COLORS.concat(['#ffffff', '#ffd400', '#a46bff']);
  for (let i = 0; i < 220; i++) P.push({ x: Math.random() * W, y: -Math.random() * H, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 5 + Math.random() * 7, a: Math.random() * 6, col: cols[i % cols.length] });
  const t0 = performance.now();
  (function f(t) {
    c.clearRect(0, 0, W, H);
    P.forEach((p) => { p.x += p.vx + Math.sin((t + p.a * 300) / 400) * 0.6; p.y += p.vy; p.a += 0.1; if (p.y > H) p.y = -10; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col; c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); });
    if (t - t0 < (ms || 6000)) requestAnimationFrame(f); else c.clearRect(0, 0, W, H);
  })(t0);
}

// Giả lập mạng yếu để kiểm thử: thêm ?sim=weak vào địa chỉ. Cứ 8–14 giây mất mạng 2–5 giây.
export function simWeak(D, db, label) {
  if (!/[?&]sim=weak/.test(location.search)) return false;
  const tag = document.createElement('div'); tag.className = 'simtag'; tag.textContent = 'SIM mạng yếu'; document.body.appendChild(tag);
  (function cyc() {
    setTimeout(() => {
      D.goOffline(db); tag.textContent = 'SIM: mất mạng'; console.log('[sim]', label, 'offline');
      setTimeout(() => { D.goOnline(db); tag.textContent = 'SIM mạng yếu'; console.log('[sim]', label, 'online'); cyc(); }, 2000 + Math.random() * 3000);
    }, 8000 + Math.random() * 6000);
  })();
  return true;
}
