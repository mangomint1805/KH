/* Minto Quiz — ⛏️ Đào vàng cả lớp (màn học sinh).
   Mỗi bạn tự trả lời liên tục tới khi hết giờ, không chờ cả lớp. Đúng: 10 vàng × hệ số chuỗi (×1.5 từ 3, ×2 từ 5, ×3 từ 10).
   Sai: hiện đáp án đúng vài giây, chuỗi về 0. Tiến độ ghi vào quiz/$pin/gold/$uid để máy chiếu hiện bảng vàng. */
import { $, esc, qtHtml, show, player, serverClock, bgfx, confetti, Sound, SHAPES, LETTERS, applyTheme } from './common.js?v=17';

const SS = { get: (k) => { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
const PIN = (new URLSearchParams(location.search).get('pin') || SS.get('qz.pin') || '').replace(/\D/g, '').slice(0, 6);
let P = null, now = () => Date.now(), meta = {}, state = {}, Q = [], K = [], me = { g: 0, n: 0, c: 0, s: 0 }, order = [], pos = 0, busy = false, tmr = 0, ended = false, sndOn = false;
const r = (p) => P.D.ref(P.db, 'quiz/' + PIN + (p ? '/' + p : ''));
const mult = (s) => (s >= 10 ? 3 : s >= 5 ? 2 : s >= 3 ? 1.5 : 1);

function msg(ic, t, s, link) { show('sMsg'); $('mIc').textContent = ic; $('mT').textContent = t; $('mS').textContent = s || ''; $('mA').hidden = !link; }
const LSK = () => 'qz.gold.' + PIN + '.' + P.uid;
function saveLocal() { SS.set(LSK(), JSON.stringify({ me, order, pos, at: state.startAt })); }

async function boot() {
  if (!/^\d{6}$/.test(PIN)) return msg('🤔', 'Thiếu mã phòng', 'Vào từ trang chơi và nhập mã PIN nha.', true);
  try { P = await player(); } catch (e) { console.error(e); return msg('📶', 'Không kết nối được', 'Kiểm tra mạng rồi tải lại trang nha.'); }
  now = serverClock(P.D, P.db);
  P.D.onValue(P.D.ref(P.db, '.info/connected'), (s) => { $('net').hidden = s.val() === true; });
  const [mS, pS] = await Promise.all([P.D.get(r('meta')), P.D.get(r('players/' + P.uid))]).catch(() => [null, null]);
  if (!mS || !mS.exists()) return msg('🚪', 'Không tìm thấy phòng ' + PIN, 'Phòng đã đóng hoặc mã PIN sai.', true);
  meta = mS.val();
  if (meta.mode !== 'gold') { location.replace('play.html?pin=' + PIN); return; }
  if (!pS || !pS.exists()) { location.replace('play.html?pin=' + PIN); return; }
  $('who').textContent = pS.val().name;
  applyTheme(meta.theme); Sound.setTheme(applyTheme(meta.theme));
  P.D.onValue(r('meta'), (s) => { if (!s.exists()) { stop(); msg('👋', 'Phòng đóng rồi nè', 'Cảm ơn em đã chơi nha 💖'); return; } const t = s.val().theme; if (t !== meta.theme) { meta.theme = t; Sound.setTheme(applyTheme(t)); } });
  P.D.onValue(r('players/' + P.uid), (s) => { if (!s.exists()) { stop(); ended = true; msg('🚪', 'Em bị mời ra khỏi phòng rồi', 'Có nhầm lẫn gì thì nói thầy nha.', true); } });
  P.D.onValue(r('state'), (s) => { state = s.val() || {}; route(); });
}

async function route() {
  if (ended && state.phase !== 'end') return;
  if (state.phase === 'lobby') return msg('⛏️', 'Vào phòng rồi nè!', 'Chờ thầy bắt đầu nha. Hết giờ ai nhiều vàng nhất thì thắng 🏆');
  if (state.phase === 'gold') {
    if (now() >= state.endAt) return finish();
    if (!Q.length) await load();
    if (!Q.length) return msg('😵', 'Không tải được câu hỏi', 'Tải lại trang thử nha.');
    hud(true); clearInterval(tmr); tmr = setInterval(tick, 250); tick();
    if (!busy && $('sQ').hidden) ask();
    return;
  }
  if (state.phase === 'end') return finish();
}

async function load() {
  const [qs, ks, gs] = await Promise.all([P.D.get(r('qpub')), P.D.get(r('key')), P.D.get(r('gold/' + P.uid))]).catch(() => [null, null, null]);
  if (!qs) return;
  const qv = qs.val() || {}, kv = (ks && ks.val()) || {};
  const ids = Object.keys(qv).map(Number).sort((a, b) => a - b);
  // RTDB có thể trả mảng hoặc object {0:…,1:…}: đổi hết về mảng
  const arr = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.keys(x).sort((a, b) => a - b).reduce((o, k) => { o[+k] = x[k]; return o; }, []) : []);
  Q = ids.map((i) => ({ ...qv[i], o: arr(qv[i].o) })); K = ids.map((i) => arr(kv[i] && kv[i].c).map(Number));
  const Lc = (() => { try { return JSON.parse(SS.get(LSK()) || 'null'); } catch (e) { return null; } })();
  const server = gs && gs.exists() ? gs.val() : null;
  if (Lc && Lc.at === state.startAt && Lc.order && Lc.order.length === Q.length) { me = Lc.me; order = Lc.order; pos = Lc.pos; }
  else { order = shuffle(Q.map((_, i) => i)); pos = 0; }
  // vàng trên máy chủ không bao giờ giảm (luật chặn): lấy số lớn hơn
  if (server && server.g > me.g) me = { g: server.g, n: server.n, c: server.c, s: server.s || 0 };
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function hud(on) {
  $('hud').hidden = !on; $('hBar').hidden = !on;
  $('hG').textContent = Math.round(me.g).toLocaleString('vi-VN');
  const m = mult(me.s);
  $('hS').innerHTML = me.s ? '🔥 ' + me.s + (m > 1 ? ' <b>×' + m + '</b>' : '') : '<span class="muted">chuỗi 0</span>';
  $('hS').classList.toggle('hot', m > 1);
}
function tick() {
  const left = Math.max(0, state.endAt - now()), sec = Math.ceil(left / 1000), tot = Math.max(1, state.endAt - state.startAt);
  $('hT').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  $('hT').classList.toggle('hurry', sec <= 10);
  $('hBarI').style.width = (left / tot * 100) + '%';
  if (left <= 0) finish();
}

function ask() {
  if (ended || state.phase !== 'gold') return;
  if (pos >= order.length) { order = shuffle(Q.map((_, i) => i)); pos = 0; } // hết bộ thì làm lại từ đầu (đảo thứ tự)
  const qi = order[pos], q = Q[qi];
  show('sQ'); $('qFb').hidden = true;
  $('qQ').innerHTML = qtHtml(q.t); $('qQ').classList.toggle('long', String(q.t || '').length > 100);
  const g = $('qGrid'); g.innerHTML = '';
  (q.o || []).forEach((txt, i) => {
    if (!txt) return;
    const b = document.createElement('button');
    b.className = 'pbtn k' + i; b.type = 'button'; b.dataset.i = i;
    b.innerHTML = '<span class="lt">' + SHAPES[i] + ' ' + LETTERS[i] + '</span><span class="tx">' + esc(txt) + '</span>';
    b.onclick = () => pick(qi, i, b);
    g.appendChild(b);
  });
}

function pick(qi, i, b) {
  if (busy || ended) return;
  busy = true;
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
  const ok = K[qi].includes(i), fb = $('qFb'), before = mult(me.s);
  me.n++;
  $('qGrid').querySelectorAll('.pbtn').forEach((x) => { const k = +x.dataset.i; x.disabled = true; x.classList.toggle('gok', K[qi].includes(k)); x.classList.toggle('gno', !ok && k === i); x.classList.toggle('dim', !K[qi].includes(k) && k !== i); });
  if (ok) {
    me.s++; me.c++;
    const m = mult(me.s), gain = Math.round(10 * m * 10) / 10;
    me.g = Math.round((me.g + gain) * 10) / 10;
    fb.className = 'gfb ok'; fb.innerHTML = '+' + gain + ' 🪙' + (m > before ? '<small>Chuỗi ' + me.s + ' · nhân ×' + m + ' 🔥</small>' : me.s >= 3 ? '<small>Chuỗi ' + me.s + ' 🔥</small>' : '');
    if (sndOn) { if (m > before) Sound.climb(); else Sound.answer(me.s); }
  } else {
    const lost = me.s;
    me.s = 0;
    const right = K[qi].map((k) => LETTERS[k] + '. ' + esc((Q[qi].o || [])[k] || '')).join(' / ');
    fb.className = 'gfb no'; fb.innerHTML = 'Chưa đúng 😢<small>Đáp án: ' + right + (lost >= 3 ? ' · mất chuỗi ' + lost + ' 💔' : '') + '</small>';
    if (sndOn) Sound.timeup();
  }
  fb.hidden = false;
  pos++; hud(true); saveLocal(); send();
  setTimeout(() => { busy = false; if (now() < state.endAt) ask(); else finish(); }, ok ? 800 : 2500);
}

let sendP = Promise.resolve(), sendQ = false;
function send() {
  if (sendQ) return; sendQ = true;
  sendP = sendP.then(async () => {
    sendQ = false;
    try { await P.D.set(r('gold/' + P.uid), { g: me.g, n: me.n, c: me.c, s: me.s, at: P.D.serverTimestamp() }); }
    catch (e) { console.warn('gold', e); }
  });
}

function stop() { clearInterval(tmr); }
async function finish() {
  stop();
  if (!ended) { ended = true; await sendP; }
  hud(false);
  show('sEnd');
  $('eG').textContent = Math.round(me.g).toLocaleString('vi-VN'); $('eC').textContent = me.c + '/' + me.n;
  if (state.phase !== 'end') { $('eR').textContent = '…'; $('eM').textContent = 'Chờ thầy chốt bảng vàng nha 👀'; return; }
  try {
    const all = (await P.D.get(r('gold'))).val() || {};
    const rk = Object.keys(all).filter((u) => u !== P.uid && (all[u].g || 0) > me.g).length + 1;
    $('eR').textContent = rk;
    $('eM').textContent = rk === 1 ? '👑 Vua đào vàng là em đó!' : rk <= 3 ? '🏆 Lên bục rồi nè, đỉnh quá!' : 'Cố lên, lần sau đào nhiều hơn nha 💪';
    if (rk <= 3 && !finish.fx) { finish.fx = 1; confetti($('fx'), 5000); if (sndOn) Sound.win(); }
  } catch (e) { $('eR').textContent = '–'; $('eM').textContent = ''; }
}

// âm thanh: mặc định tắt (cả lớp cùng bấm sẽ rất ồn), bấm 🔇 để bật
try { sndOn = localStorage.getItem('qz.gsnd') === '1'; } catch (e) {}
const paintSnd = () => { $('bSnd').textContent = sndOn ? '🔊' : '🔇'; };
$('bSnd').onclick = () => { sndOn = !sndOn; if (sndOn) { Sound.unlock(); Sound.setMusic(false); } try { localStorage.setItem('qz.gsnd', sndOn ? '1' : '0'); } catch (e) {} paintSnd(); };
document.addEventListener('pointerdown', () => { if (sndOn) Sound.unlock(); }, { once: true });
paintSnd();
document.addEventListener('visibilitychange', () => { if (!document.hidden && P) route(); });
bgfx(8);
boot();
