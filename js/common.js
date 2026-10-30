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
  { id: 'idol', n: 'Hành baro', c: '#0b3d3e', sw: 'linear-gradient(135deg,#0b4f4f,#39c5bb 60%,#e12885)' },
  { id: 'y2k', n: 'Thiên thần', c: '#c94b93', sw: 'linear-gradient(135deg,#ffb7d5,#c9a7ff 55%,#9ad8ff)' },
  { id: 'scifi', n: 'Băng hoại', c: '#070d1f', sw: 'linear-gradient(135deg,#070d1f,#1d2a5c 55%,#f2c14e)' },
];
export function themeOf(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; }
export function applyTheme(id) {
  const t = themeOf(id), r = document.documentElement;
  if (t.id === 'kahoot') r.removeAttribute('data-qz'); else r.setAttribute('data-qz', t.id);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t.c);
  const d = document.querySelector('.bgfx'); if (d && d.className !== 'bgfx t-' + t.id) fxPaint(d);
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
// ---------- lớp của bộ câu hỏi ----------
// Mỗi bộ có trường lop (mã lớp). Bộ cũ chưa có thì đoán từ mã lớp ghi trong tên, ví dụ "(TOPRE115276)".
export const CLASSES = [['TOA117110', 'TOEIC A · TOA117110'], ['TOPRE115276', 'TOEIC Pre (mới) · TOPRE115276'], ['PRE115275', 'TOEIC Pre (cũ) · PRE115275']];
export function quizClass(q) {
  if (q && typeof q.lop === 'string') return q.lop;
  const m = String((q && q.title) || '').match(/\b((?:TO)?[A-Z]{1,5}\d{6})\b/); return m ? m[1] : '';
}
export function classLabel(id) { const c = CLASSES.find((x) => x[0] === id); return c ? c[1] : (id || 'Dùng chung · chưa gán lớp'); }
// gom theo lớp: các lớp trong CLASSES trước, rồi lớp khác, cuối cùng là bộ dùng chung
export function byClass(L) {
  const g = new Map(); L.forEach((q) => { const k = quizClass(q); if (!g.has(k)) g.set(k, []); g.get(k).push(q); });
  const order = CLASSES.map((c) => c[0]).filter((k) => g.has(k)).concat([...g.keys()].filter((k) => k && !CLASSES.some((c) => c[0] === k)).sort());
  if (g.has('')) order.push('');
  return order.map((k) => [k, g.get(k)]);
}

// câu hỏi có chỗ trống ------- : giữ chỗ trống trên một dòng, không bị ngắt giữa chừng
export function qtHtml(t) { return esc(t).replace(/[-_…]{3,}/g, (m) => '<span class="blank">' + m + '</span>'); }
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
// Mỗi theme có bộ nhạc nền và âm báo riêng (PACKS). Âm lượng nhạc nền và âm báo chỉnh riêng (0–100).
export const Sound = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null, synBus = null, fxTheme = null, noiseBuf = null;
  let musicOn = false, sfxOn = true, mode = 'lobby', paused = true, loop = 0, step = 0, nextT = 0, fast = false;
  let theme = 'kahoot', mVol = 70, sVol = 70;
  // theme có thể dùng bài nhạc thật thay cho nhạc tự tạo. File nhạc lưu ở Firestore quizMusic (chỉ thầy đọc được, xem loadTrack),
  // tải xong mới có src. g = mức chỉnh cho đều tai giữa các bài (tính lúc thầy tải nhạc lên)
  // loop = [giây bắt đầu, giây kết thúc]: chỉ lặp một đoạn của bài. Thiên thần (Approval desire) lặp 33 ô nhịp đầu,
  // quay lại đầu bài ngay trước đoạn drop ở 46,57 giây (thầy thấy đoạn drop không hợp)
  const TRACKS = { idol: { g: 0.275 }, scifi: { g: 0.216 }, y2k: { g: 0.089, loop: [0, 46.55] } };
  let trk = null, trkSrc = null, trkGain = null, trkOn = false, trkTok = 0, trkWatch = 0, trkJump = false;
  // canh vòng lặp: gần tới điểm kết thúc thì giảm nhỏ rất nhanh, nhảy về đầu đoạn rồi mở lại (nghe liền, không bị khựng)
  function watchLoop() {
    clearInterval(trkWatch); trkWatch = 0; const T = TRACKS[theme];
    if (!T || !T.loop || !trk) return;
    trkWatch = setInterval(() => {
      if (!trkOn || trkJump || !trk || trk.paused) return;
      const [a, b] = T.loop, lead = 0.025 * (trk.playbackRate || 1);
      if (trk.currentTime < b - lead) return;
      trkJump = true; const t = ctx.currentTime, g = trkGain.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + 0.02);
      setTimeout(() => {
        if (trk) trk.currentTime = a;
        const t2 = ctx.currentTime; g.cancelScheduledValues(t2); g.setValueAtTime(0.0001, t2); g.linearRampToValueAtTime(TRACKS[theme] ? TRACKS[theme].g : T.g, t2 + 0.03);
        trkJump = false;
      }, 22);
    }, 15);
  }
  function track() {
    const T = TRACKS[theme]; if (!T || !ac()) return null;
    if (!trk) {
      trk = new Audio(); trk.loop = true; trk.preload = 'auto';
      trk.addEventListener('error', () => { const T2 = TRACKS[theme]; if (!T2 || trk.src !== new URL(T2.src, location.href).href) return; trackFailed(); });
      trkSrc = ctx.createMediaElementSource(trk); trkGain = ctx.createGain(); trkSrc.connect(trkGain); trkGain.connect(musicBus);
    }
    const url = new URL(T.src, location.href).href;
    if (trk.src !== url) { trk.src = url; trk.currentTime = 0; }
    trkGain.gain.value = T.g;
    return trk;
  }
  function trackFailed() {
    const T = TRACKS[theme]; if (T) T.bad = true;
    console.warn('Không phát được nhạc theme, chuyển sang nhạc tự tạo');
    if (trkOn) { trkOn = false; if (musicOn && !paused && !loop) { nextT = 0; loop = setInterval(pump, 50); pump(); } }
  }
  const mGain = () => 1.3 * mVol / 100, sGain = () => 1.43 * sVol / 100;
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = mGain(); musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = sGain(); sfxBus.connect(master);
      // mức riêng từng theme cho nhạc tự tạo (synBus) và âm báo (fxTheme), để đổi theme không bị to nhỏ khác nhau
      synBus = ctx.createGain(); synBus.connect(musicBus); fxTheme = ctx.createGain(); fxTheme.connect(sfxBus); levels();
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
    o.connect(g); g.connect(bus || fxTheme); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, when, hp, bus) {
    const c = ac(); if (!c) return;
    const t = Math.max(c.currentTime, when == null ? c.currentTime : when), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp || 6000;
    g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || fxTheme); s.start(t); s.stop(t + dur + 0.02);
  }
  const later = (s) => (ctx ? ctx.currentTime + s : 0);
  const M = (f, d, ty, v, t, gl) => tone(f, d, ty, v, t, synBus, gl);
  const N = (d, v, t, hp) => noise(d, v, t, hp, synBus);
  // mức chỉnh cho đều tai (đo bằng máy): nhạc tự tạo theo theme, âm báo theo theme
  const LV = { syn: { kahoot: [2.1, 2.1], idol: [2.29, 3.3] }, fx: { kahoot: 1, idol: 1.21, y2k: 0.86, scifi: 1.78 } };
  function levels() { if (synBus) synBus.gain.value = (LV.syn[theme] || [1, 1])[mode === 'q' ? 1 : 0]; if (fxTheme) fxTheme.gain.value = LV.fx[theme] || 1; }

  // ===== bộ nhạc nền theo theme. Mỗi kiểu: bpm, hợp âm (4 ô nhịp), bass, và hàm chơi 1 nốt móc (8 nốt / ô nhịp) =====
  const PACKS = {
    // Tím Kahoot: C – G – Am – F (phòng chờ), Am – Am – F – E (trả lời)
    kahoot: {
      lobby: { bpm: 112, ch: [[262, 330, 392], [196, 247, 294], [220, 262, 330], [175, 220, 262]], bass: [131, 98, 110, 87],
        play(t, n, bar, ch, L) { M(ch[[0, 1, 2, 1, 0, 2, 1, 2][n]] * 2, 0.22, 'triangle', 0.05, t); if (n % 4 === 0) M(L.bass[bar], 0.38, 'sine', 0.14, t); if (n === 2 || n === 6) N(0.06, 0.03, t, 2500); if (n === 0 && bar % 2 === 0) M(ch[2] * 4, 0.18, 'sine', 0.03, t + 0.01); } },
      q: { bpm: 132, ch: [[220, 262, 330], [220, 262, 330], [175, 220, 262], [165, 208, 247]], bass: [110, 110, 87, 82],
        play(t, n, bar, ch, L) { M(ch[[0, 2, 1, 2][n % 4]] * 2, 0.12, 'square', fast ? 0.045 : 0.032, t); if (n % 2 === 0) M(L.bass[bar], 0.2, 'triangle', 0.16, t); N(0.03, fast ? 0.06 : 0.035, t, 8000); if (n === 4) N(0.08, 0.05, t, 1800); } },
    },
    // Hành baro (idol pop): D – A – Bm – G, tiếng pluck sáng, vỗ tay nhịp 2 và 4
    idol: {
      lobby: { bpm: 124, ch: [[294, 370, 440], [220, 277, 330], [247, 294, 370], [196, 247, 294]], bass: [147, 110, 123, 98],
        play(t, n, bar, ch, L) {
          M(ch[[0, 2, 1, 2, 0, 2, 1, 2][n]] * 2, 0.14, 'square', 0.028, t); if (n % 2 === 1) M(ch[2] * 4, 0.08, 'sine', 0.02, t);
          if (n % 2 === 0) M(L.bass[bar], 0.18, 'triangle', 0.15, t); if (n === 2 || n === 6) N(0.09, 0.05, t, 1500);
          if (n === 0 && bar === 3) [1, 1.26, 1.5, 2].forEach((m, i) => M(ch[0] * 4 * m, 0.12, 'sine', 0.025, t + i * 0.06));
        } },
      q: { bpm: 140, ch: [[247, 294, 370], [196, 247, 294], [294, 370, 440], [220, 277, 330]], bass: [123, 98, 147, 110],
        play(t, n, bar, ch, L) {
          M(ch[[0, 1, 2, 1][n % 4]] * 2, 0.1, 'square', fast ? 0.04 : 0.03, t); M(L.bass[bar], 0.12, 'sawtooth', 0.05, t);
          N(0.025, fast ? 0.05 : 0.03, t, 9000); if (n === 2 || n === 6) N(0.09, 0.06, t, 1500);
        } },
    },
    // Thiên thần (dễ thương, hộp nhạc): F – C – Dm – Bb, chuông cao, nhịp chậm
    y2k: {
      lobby: { bpm: 96, ch: [[349, 440, 523], [262, 330, 392], [294, 349, 440], [233, 294, 349]], bass: [175, 131, 147, 117],
        play(t, n, bar, ch, L) {
          const f = ch[[0, 1, 2, 1, 2, 1, 0, 1][n]] * 2; M(f, 0.5, 'sine', 0.05, t); M(f * 3, 0.25, 'sine', 0.008, t);
          if (n % 4 === 0) M(L.bass[bar], 0.6, 'triangle', 0.1, t); if (n === 4) N(0.04, 0.02, t, 7000);
        } },
      q: { bpm: 120, ch: [[294, 349, 440], [233, 294, 349], [262, 330, 392], [262, 330, 392]], bass: [147, 117, 131, 131],
        play(t, n, bar, ch, L) {
          const f = ch[[0, 2, 1, 2][n % 4]] * 4; M(f, 0.16, 'triangle', fast ? 0.045 : 0.032, t); M(f * 2, 0.1, 'sine', 0.008, t);
          if (n % 2 === 0) M(L.bass[bar], 0.22, 'sine', 0.13, t); if (n % 2 === 1) N(0.02, fast ? 0.04 : 0.02, t, 9000);
        } },
    },
    // Băng hoại (synthwave neon): Dm – Bb – F – C, bass răng cưa, trống điện tử
    scifi: {
      lobby: { bpm: 104, ch: [[294, 349, 440], [233, 294, 349], [175, 220, 262], [262, 330, 392]], bass: [73, 58, 87, 65],
        play(t, n, bar, ch, L) {
          M(L.bass[bar], 0.2, 'sawtooth', 0.06, t); if (n % 2 === 0) M(ch[[0, 1, 2, 1][(n / 2) % 4]] * 2, 0.3, 'triangle', 0.035, t);
          if (n === 0 || n === 4) M(110, 0.18, 'sine', 0.22, t, 45); if (n === 4) N(0.12, 0.05, t, 1200); if (n % 2 === 1) N(0.02, 0.02, t, 9000);
        } },
      q: { bpm: 128, ch: [[330, 392, 494], [262, 330, 392], [294, 349, 440], [247, 311, 370]], bass: [82, 65, 73, 62],
        play(t, n, bar, ch, L) {
          M(L.bass[bar] * (n % 2 ? 2 : 1), 0.12, 'sawtooth', 0.07, t); M(ch[[0, 1, 2, 1][n % 4]] * 4, 0.08, 'square', fast ? 0.03 : 0.02, t);
          if (n % 4 === 0) M(110, 0.16, 'sine', 0.24, t, 45); if (n === 4) N(0.1, 0.06, t, 1200); N(0.02, fast ? 0.05 : 0.025, t, 9000);
        } },
    },
  };
  const pack = () => (PACKS[theme] || PACKS.kahoot)[mode === 'q' ? 'q' : 'lobby'];
  function schedule(t) { const L = pack(), bar = Math.floor(step / 8) % 4, n = step % 8; L.play(t, n, bar, L.ch[bar], L); step++; }
  function pump() {
    if (!ctx) return;
    const L = pack(), dt = 60 / (fast ? L.bpm * 1.25 : L.bpm) / 2;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.2) { schedule(nextT); nextT += dt; }
  }
  function startLoop() {
    if (loop || trkOn || !musicOn || paused) return; if (!ac()) return;
    if (TRACKS[theme] && TRACKS[theme].src && !TRACKS[theme].bad) {
      const a = track();
      if (a) {
        trkOn = true; const tok = ++trkTok; a.playbackRate = fast ? 1.06 : 1; watchLoop();
        a.play().catch((e) => {
          if (tok !== trkTok || !e || e.name === 'AbortError') return;
          if (e.name === 'NotAllowedError') { trkOn = false; return; } // chưa bấm vào trang: lần bấm sau sẽ phát
          trackFailed();
        });
      }
      return;
    }
    nextT = 0; loop = setInterval(pump, 50); pump();
  }
  function stopLoop() { clearInterval(loop); loop = 0; clearInterval(trkWatch); trkWatch = 0; trkJump = false; if (trk && trkOn) { trk.pause(); } trkOn = false; }

  // ===== âm báo theo theme =====
  const arp = (fs, ty, vol, gap, dur) => fs.forEach((f, i) => tone(f, dur || 0.22, ty, vol, later(i * gap)));
  const SFX = {
    kahoot: {
      answer(n) { const f = 700 + Math.min(n, 24) * 30; tone(f, 0.11, 'triangle', 0.34); tone(f * 1.5, 0.1, 'sine', 0.2, later(0.05)); },
      tick() { tone(1320, 0.05, 'square', 0.06); },
      join() { tone(523, 0.08, 'sine', 0.14); tone(784, 0.1, 'sine', 0.14, later(0.07)); tone(1047, 0.12, 'sine', 0.1, later(0.14)); },
      go() { arp([392, 523, 659, 784, 1047], 'triangle', 0.16, 0.08); },
      count(n) { tone(n ? 660 : 990, n ? 0.18 : 0.4, 'triangle', 0.2); },
      whoosh() { noise(0.35, 0.08, null, 900); tone(300, 0.35, 'sine', 0.05, null, null, 900); },
      timeup() { tone(196, 0.9, 'sawtooth', 0.07); tone(147, 1.1, 'sine', 0.2, later(0.02)); noise(0.5, 0.06, null, 300); },
      reveal() { arp([784, 988, 1175, 1568], 'sine', 0.12, 0.07, 0.3); },
      climb() { tone(330, 0.5, 'sawtooth', 0.05, null, null, 1320); [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.22, 'sine', 0.1, later(0.45 + i * 0.07))); },
      win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.28, 'triangle', 0.15, later(i * 0.14))); },
    },
    // Hành baro: lấp lánh, kiểu sân khấu idol
    idol: {
      answer(n) { const f = 760 + Math.min(n, 24) * 30; tone(f, 0.08, 'square', 0.12); tone(f * 2, 0.16, 'sine', 0.22, later(0.04)); },
      tick() { tone(1568, 0.05, 'sine', 0.08); },
      join() { arp([1175, 1480, 1760, 2349], 'sine', 0.09, 0.05, 0.16); },
      go() { arp([587, 740, 880, 1175, 1480, 1760], 'square', 0.06, 0.07, 0.18); noise(0.3, 0.05, later(0.42), 4000); },
      count(n) { tone(n ? 880 : 1175, n ? 0.16 : 0.45, 'square', 0.08); tone(n ? 1760 : 2349, 0.12, 'sine', 0.05); },
      whoosh() { noise(0.3, 0.06, null, 3000); arp([1760, 2093, 2637], 'sine', 0.04, 0.05, 0.12); },
      timeup() { arp([880, 740, 587, 440], 'square', 0.07, 0.09, 0.2); noise(0.4, 0.08, later(0.3), 1500); },
      reveal() { arp([1175, 1480, 1760, 2349, 2960], 'sine', 0.1, 0.06, 0.32); },
      climb() { tone(440, 0.45, 'square', 0.04, null, null, 1760); arp([1760, 2217, 2637, 3520], 'sine', 0.08, 0.06, 0.2); },
      win() { [587, 740, 880, 1175, 880, 1175, 1480].forEach((f, i) => { tone(f, i === 6 ? 0.8 : 0.26, 'square', 0.06, later(i * 0.13)); tone(f * 2, 0.2, 'sine', 0.04, later(i * 0.13)); }); },
    },
    // Thiên thần: tiếng chuông, bong bóng, dễ thương
    y2k: {
      answer(n) { const f = 600 + Math.min(n, 24) * 28; tone(f, 0.14, 'sine', 0.36, null, null, f * 2); tone(f * 3, 0.1, 'sine', 0.06, later(0.08)); },
      tick() { tone(2093, 0.06, 'sine', 0.07); },
      join() { tone(698, 0.18, 'sine', 0.12, null, null, 1397); tone(2093, 0.3, 'sine', 0.05, later(0.12)); },
      go() { arp([698, 880, 1047, 1397, 1760], 'sine', 0.12, 0.09, 0.35); },
      count(n) { tone(n ? 1047 : 1397, n ? 0.3 : 0.6, 'sine', 0.16); tone((n ? 1047 : 1397) * 3, 0.2, 'sine', 0.02); },
      whoosh() { tone(400, 0.4, 'sine', 0.08, null, null, 1600); },
      timeup() { tone(880, 0.6, 'sine', 0.12, null, null, 330); tone(1319, 0.5, 'triangle', 0.04, later(0.05), null, 494); },
      reveal() { arp([1047, 1319, 1568, 2093], 'sine', 0.13, 0.08, 0.5); arp([3136, 4186], 'sine', 0.02, 0.08, 0.3); },
      climb() { tone(523, 0.5, 'sine', 0.1, null, null, 2093); arp([2093, 2637, 3136], 'sine', 0.06, 0.07, 0.3); },
      win() { [698, 880, 1047, 1397, 1047, 1397, 1760].forEach((f, i) => tone(f, i === 6 ? 1 : 0.4, 'sine', 0.13, later(i * 0.15))); },
    },
    // Băng hoại: tiếng điện tử, laser, máy móc
    scifi: {
      answer(n) { const f = 500 + Math.min(n, 24) * 26; tone(f, 0.1, 'square', 0.12, null, null, f * 2); tone(f * 2, 0.08, 'sine', 0.18, later(0.06)); },
      tick() { tone(1760, 0.04, 'square', 0.05); tone(880, 0.04, 'square', 0.03, later(0.05)); },
      join() { tone(1760, 0.18, 'sawtooth', 0.05, null, null, 440); tone(880, 0.08, 'square', 0.04, later(0.15)); },
      go() { tone(110, 0.6, 'sawtooth', 0.08, null, null, 880); arp([440, 659, 880, 1319], 'square', 0.05, 0.08, 0.12); },
      count(n) { tone(n ? 440 : 880, n ? 0.14 : 0.5, 'square', 0.07); tone(n ? 55 : 110, 0.25, 'sine', 0.25, null, null, 40); },
      whoosh() { noise(0.4, 0.07, null, 600); tone(1200, 0.4, 'sawtooth', 0.04, null, null, 150); },
      timeup() { tone(440, 1, 'sawtooth', 0.08, null, null, 55); tone(110, 0.8, 'square', 0.05, later(0.1), null, 40); },
      reveal() { arp([659, 880, 1319, 1760], 'square', 0.06, 0.06, 0.18); tone(110, 0.3, 'sine', 0.2, null, null, 50); },
      climb() { tone(220, 0.5, 'sawtooth', 0.06, null, null, 1760); arp([1319, 1760, 2637], 'square', 0.05, 0.06, 0.15); },
      win() { [440, 554, 659, 880, 659, 880, 1109].forEach((f, i) => { tone(f, i === 6 ? 0.8 : 0.24, 'sawtooth', 0.05, later(i * 0.13)); tone(f / 2, 0.24, 'square', 0.03, later(i * 0.13)); }); },
    },
  };
  const fx = () => SFX[theme] || SFX.kahoot;
  let unlocked = false; // thầy đã bấm/chạm vào trang: trình duyệt cho phát tiếng
  const live = () => !!ctx && (ctx.state === 'running' || unlocked);
  // nhạc nền nhỏ lại một chút trong 0.25 giây cho tiếng báo trả lời nghe rõ
  function duck() { if (!musicBus || !musicOn) return; const t = ctx.currentTime, g = musicBus.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(mGain() * 0.45, t + 0.02); g.linearRampToValueAtTime(mGain(), t + 0.28); }
  return {
    get music() { return musicOn; }, get sfx() { return sfxOn; },
    get musicVol() { return mVol; }, get sfxVol() { return sVol; },
    setMusic(v) { musicOn = v; if (v) startLoop(); else stopLoop(); },
    setSfx(v) { sfxOn = v; },
    // âm lượng 0–100
    setMusicVol(v) { mVol = Math.max(0, Math.min(100, +v || 0)); if (musicBus) musicBus.gain.setTargetAtTime(mGain(), ctx.currentTime, 0.05); },
    setSfxVol(v) { sVol = Math.max(0, Math.min(100, +v || 0)); if (sfxBus) sfxBus.gain.setTargetAtTime(sGain(), ctx.currentTime, 0.05); },
    // đổi bộ nhạc / âm báo theo theme (đang phát thì đổi luôn từ đầu ô nhịp)
    setTheme(id) {
      id = PACKS[id] ? id : 'kahoot'; if (id === theme) return;
      // đổi theme khi nhạc đang bật: dừng bài cũ, phát bài của theme mới (không dựa vào trạng thái lúc bài cũ còn đang tải)
      const on = musicOn && !paused; stopLoop(); theme = id; step = 0; levels(); if (on) startLoop();
    },
    // bài nhạc của theme vừa tải xong (đường dẫn blob:). Đang phát nhạc tự tạo của theme đó thì chuyển sang bài thật luôn
    setTrack(id, url, g) {
      const T = TRACKS[id]; if (!T || T.src === url) return;
      T.src = url; T.bad = false; if (g > 0) T.g = g;
      if (id === theme && musicOn && !paused) { stopLoop(); startLoop(); }
    },
    hasTrack(id) { return !!TRACKS[id]; },
    unlock() { const ua = navigator.userActivation; if (!ua || ua.hasBeenActive) unlocked = true; ac(); },
    // kiểu nhạc: 'lobby' | 'q' | null (tắt tạm)
    mode(m) { stopLoop(); fast = false; if (!m) { paused = true; return; } if (m !== mode) step = 0; mode = m; levels(); paused = false; startLoop(); },
    hurry(v) { fast = !!v; if (trk && trkOn) trk.playbackRate = fast ? 1.06 : 1; },
    pauseMusic() { paused = true; stopLoop(); }, resumeMusic() { paused = false; startLoop(); },
    // có bạn vừa chọn đáp án: tiếng nhỏ, cao dần theo số người đã trả lời
    answer(n) { if (!sfxOn || !live()) return; duck(); fx().answer(n); },
    tick() { if (sfxOn && live()) fx().tick(); },
    join() { if (sfxOn && live()) fx().join(); },
    go() { if (sfxOn && live()) fx().go(); },
    count(n) { if (sfxOn && live()) fx().count(n); },
    whoosh() { if (sfxOn && live()) fx().whoosh(); },
    timeup() { if (sfxOn && live()) fx().timeup(); },
    end() { this.timeup(); },
    reveal() { if (sfxOn && live()) fx().reveal(); },
    drum(sec) { if (!sfxOn || !live()) return; const n = Math.round((sec || 2) * 16); for (let i = 0; i < n; i++) noise(0.05, 0.03 + 0.07 * i / n, later(i / 16), 1500); tone(98, 0.6, 'sine', 0.25, later(sec || 2)); noise(0.6, 0.12, later(sec || 2), 3000); },
    // bạn lội ngược dòng vào top 5: tiếng vút lên + leng keng
    climb() { if (sfxOn && live()) fx().climb(); },
    win() { if (sfxOn && live()) fx().win(); },
    // nghe thử âm báo (khi kéo thanh âm lượng)
    preview() { if (sfxOn) fx().reveal(); },
  };
})();

// Nền chuyển động: các hình ▲ ◆ ● ■ trôi chầm chậm (CSS transform, nhẹ cho máy chiếu cũ)
// Mỗi theme có hình trôi và hiệu ứng riêng; đổi theme là vẽ lại (applyTheme gọi).
const FX = {
  kahoot: { g: ['▲', '◆', '●', '■'], c: ['#fff'] },
  // Hành baro (Miku): nốt nhạc, cột equalizer nhảy theo nhạc, đèn sân khấu xanh ngọc
  idol: { g: ['♪', '♫', '♬', '♪', '✦', '♫'], c: ['#86cecb', '#fff', '#ff8fc4', '#bdf3ee'], extra: '<div class="beam b1"></div><div class="beam b2"></div><div class="eq">' + '<i></i>'.repeat(32) + '</div>' },
  // Thiên thần (KAngel): tim pixel, lấp lánh, vầng hào quang, mây; quầng sáng hồng – tím
  y2k: { g: ['♡', '✧', '♥', '☆', '✧', '♡', '◌'], c: ['#fff', '#ffe1f0', '#ffd0ea', '#e9e0ff', '#fff6b0'], extra: '<div class="glow g1"></div><div class="glow g2"></div><div class="halo"></div>' },
  // Băng hoại (HI3): tinh thể Honkai đỏ – tím bay lên, lục giác vàng, vạch quét, lưới HUD
  scifi: { g: ['◆', '⬡', '◆', '◇', '⬢', '◆'], c: ['#e0475f', '#f2c14e', '#9b5cff', '#ff6b81', '#ffd978'], extra: '<div class="grid"></div><div class="scan"></div><div class="hud h1"></div><div class="hud h2"></div>' },
};
let fxN = 14;
function fxPaint(d) {
  const id = document.documentElement.getAttribute('data-qz') || 'kahoot', T = FX[id] || FX.kahoot;
  d.className = 'bgfx t-' + id;
  let h = T.extra || '';
  for (let i = 0; i < fxN; i++) {
    const sz = (id === 'kahoot' ? 40 : 26) + Math.round(Math.random() * (id === 'kahoot' ? 120 : 80)), x = Math.round(Math.random() * 100), dur = (id === 'scifi' ? 12 : id === 'y2k' ? 24 : 18) + Math.round(Math.random() * 22), del = -Math.round(Math.random() * dur), sub = (1.6 + Math.random() * 2.4).toFixed(1);
    h += '<span style="left:' + x + '%;font-size:' + sz + 'px;--d:' + dur + 's;--dl:' + del + 's;--s:' + sub + 's;color:' + T.c[i % T.c.length] + '"><i>' + T.g[i % T.g.length] + '</i></span>';
  }
  d.innerHTML = h;
}
// ---------- nhạc theme: lưu ở Firestore quizMusic, chỉ tài khoản thầy đọc được (không để file nhạc công khai trên GitHub) ----------
// quizMusic/{theme} = { n, at, type, g, size, name }; phần nhạc (base64) ở quizMusic/{theme}_{at}_{i}, mỗi phần < 1MB
export const MUSIC_THEMES = ['idol', 'y2k', 'scifi'];
export const MUSIC_PART = 900000;
export const musicPartId = (id, at, i) => id + '_' + at + '_' + i;
export async function fetchTrack(id) {
  const x = await window.MACC.fs(), F = x.F;
  const m = await F.getDoc(F.doc(x.db, 'quizMusic', id)); if (!m.exists()) return null;
  const M = m.data(), n = M.n | 0; if (!n || n > 20) return null;
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => F.getDoc(F.doc(x.db, 'quizMusic', musicPartId(id, M.at, i)))));
  if (parts.some((p) => !p.exists() || typeof p.data().d !== 'string')) throw new Error('thiếu phần nhạc');
  const bytes = parts.map((p) => { const b = atob(p.data().d), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; });
  return { url: URL.createObjectURL(new Blob(bytes, { type: M.type || 'audio/mpeg' })), g: +M.g || 0, at: M.at };
}
// màn host: tải nhạc của theme (mỗi theme một lần). Chưa có hoặc lỗi thì vẫn dùng nhạc tự tạo
const trackP = {};
export function loadTrack(id) {
  if (!Sound.hasTrack(id) || !window.MACC) return Promise.resolve(false);
  if (!trackP[id]) {
    trackP[id] = fetchTrack(id).then((t) => { if (!t) return false; Sound.setTrack(id, t.url, t.g); return true; })
      .catch((e) => { console.warn('Không tải được nhạc theme', id, e); delete trackP[id]; return false; });
  }
  return trackP[id];
}

export function bgfx(n) {
  if (n) fxN = n;
  let d = document.querySelector('.bgfx');
  if (!d) { d = document.createElement('div'); d.setAttribute('aria-hidden', 'true'); document.body.prepend(d); }
  fxPaint(d);
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
