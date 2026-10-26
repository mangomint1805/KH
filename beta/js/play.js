/* Minto Quiz — màn học sinh */
import { $, esc, show, player, serverClock, bgfx, confetti, countUp, simWeak, COLORS, SHAPES, LETTERS } from './common.js?v=2';

const SS = { get: (k) => { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { sessionStorage.removeItem(k); } catch (e) {} } };
const LSget = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };

let P = null, now = () => Date.now(), PIN = '', meta = null, state = null, me = null, score = null;
const qpub = {}, mine = {}, offs = [];
let joined = false, tmr = 0, endFx = 0, sending = 0;

// màu nền theo trạng thái: tím (mặc định), xanh (đúng), đỏ (sai)
function bg(c) { document.body.classList.remove('st-ok', 'st-no'); if (c) document.body.classList.add(c); }
function msg(ic, t, s, q) {
  bg(''); show('sMsg'); $('sMsg').querySelectorAll('.x').forEach((e) => e.remove()); $('mIc').textContent = ic || ''; $('mT').textContent = t || ''; $('mS').textContent = s || '';
  $('mQ').hidden = !q; $('mQ').textContent = q || '';
}
function r(p) { return P.D.ref(P.db, 'quiz/' + PIN + (p ? '/' + p : '')); }

// ---------- vào phòng ----------
const url = new URLSearchParams(location.search);
$('pin').value = (url.get('pin') || SS.get('qz.pin') || '').replace(/\D/g, '').slice(0, 6);
let nm = SS.get('qz.name') || LSget('qz.name');
if (!nm) { try { const a = JSON.parse(LSget('mt.acc') || 'null'); nm = (LSget('cam20.name') || (a && a.name) || '').trim(); } catch (e) {} }
$('name').value = nm.slice(0, 20);
if ($('pin').value.length === 6) setTimeout(() => $('name').focus(), 50);
$('pin').addEventListener('input', () => { $('pin').value = $('pin').value.replace(/\D/g, '').slice(0, 6); });
['pin', 'name'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('go').click(); }));

$('go').onclick = async () => {
  const pin = $('pin').value.trim(), name = $('name').value.replace(/\s+/g, ' ').trim().slice(0, 20);
  $('jerr').textContent = '';
  if (!/^\d{6}$/.test(pin)) { $('jerr').textContent = 'Mã PIN gồm 6 chữ số.'; return; }
  if (!name) { $('jerr').textContent = 'Nhập tên của bạn nhé.'; return; }
  $('go').disabled = true; $('go').textContent = 'Đang vào…';
  try { await join(pin, name); } catch (e) { console.error(e); $('jerr').textContent = errText(e); }
  $('go').disabled = false; $('go').textContent = 'Vào phòng';
};
function errText(e) {
  const c = (e && (e.code || e.message)) || '';
  if (/admin-restricted|operation-not-allowed/.test(c)) return 'Phòng chơi chưa được mở (thầy cần bật đăng nhập ẩn danh).';
  if (/PERMISSION|permission/.test(c)) return 'Không vào được phòng này (phòng đã đóng hoặc bạn đã bị mời ra).';
  if (/network|unavailable|offline/i.test(c)) return 'Mạng đang yếu, thử lại nhé.';
  return e && e.ui ? e.message : 'Có lỗi, thử lại nhé.';
}
function uiErr(m) { const e = new Error(m); e.ui = 1; return e; }

async function join(pin, name, resume) {
  P = P || await player();
  if (!offs.length) { now = serverClock(P.D, P.db); watchNet(); simWeak(P.D, P.db, 'play'); }
  PIN = pin;
  const [mS, sS, meS] = await Promise.all([P.D.get(r('meta')), P.D.get(r('state')), P.D.get(r('players/' + P.uid))]);
  if (!mS.exists()) throw uiErr('Không tìm thấy phòng ' + pin + '. Kiểm tra lại mã PIN.');
  meta = mS.val(); const st = sS.val() || {};
  if (!meS.exists()) {
    if (resume) throw uiErr('');
    if (st.phase === 'end') throw uiErr('Trò chơi đã kết thúc.');
    if (Date.now() - (meta.at || 0) > 6 * 3600e3) throw uiErr('Phòng này đã hết hạn.');
    // trùng tên: thêm số phía sau
    const ps = (await P.D.get(r('players'))).val() || {};
    const taken = new Set(Object.values(ps).map((p) => String(p.name || '').toLowerCase()));
    let nn = name, i = 2;
    while (taken.has(nn.toLowerCase())) nn = (name.slice(0, 17) + ' ' + i++).slice(0, 20);
    await P.D.set(r('players/' + P.uid), { name: nn, at: P.D.serverTimestamp() });
    name = nn;
  } else name = meS.val().name;
  SS.set('qz.pin', pin); SS.set('qz.name', name);
  try { localStorage.setItem('qz.name', $('name').value.trim().slice(0, 20)); } catch (e) {}
  me = { name };
  $('who').textContent = name;
  joined = true;
  listen();
}

function watchNet() {
  let first = true;
  offs.push(P.D.onValue(P.D.ref(P.db, '.info/connected'), (s) => {
    const on = s.val() === true;
    if (on && !first && joined) setTimeout(render, 300); // có mạng lại: vẽ lại đúng màn hiện tại
    if (on) first = false;
    $('net').hidden = on || first;
  }));
}

function listen() {
  offs.splice(1).forEach((f) => f());
  offs.push(P.D.onValue(r('state'), (s) => { state = s.val() || {}; render(); }));
  offs.push(P.D.onValue(r('players/' + P.uid), (s) => {
    if (!s.exists() && joined) {
      joined = false; SS.del('qz.pin'); stopAll();
      msg('🚪', 'Bạn đã được mời ra khỏi phòng', 'Hỏi thầy nếu có nhầm lẫn nhé.');
    }
  }));
  offs.push(P.D.onValue(r('scores/' + P.uid), (s) => { score = s.val(); render(); }));
  offs.push(P.D.onValue(r('meta'), (s) => {
    if (!s.exists() && joined) { joined = false; SS.del('qz.pin'); stopAll(); msg('👋', 'Phòng đã đóng', 'Cảm ơn bạn đã chơi!'); }
  }));
}
function stopAll() { offs.splice(1).forEach((f) => f()); clearInterval(tmr); }

async function getQ(q) {
  if (!qpub[q]) { const s = await P.D.get(r('qpub/' + q)); if (s.exists()) qpub[q] = s.val(); }
  return qpub[q] || null;
}
async function getMine(q) {
  if (mine[q] == null) { const s = await P.D.get(r('answers/' + q + '/' + P.uid)); if (s.exists()) mine[q] = s.val().a; }
  return mine[q];
}

let seq = 0, retryT = 0;
async function render() {
  clearTimeout(retryT);
  try { await draw(); }
  catch (e) { console.warn('render', e); retryT = setTimeout(render, 1500); } // mạng yếu: thử lại, không đứng màn hình
}
async function draw() {
  if (!joined || !state) return;
  const my = ++seq, st = state, q = st.q, n = meta.n;
  clearInterval(tmr);
  if (st.phase === 'lobby' || !st.phase) return msg('🎉', 'Bạn đã vào phòng!', 'Thấy tên mình trên màn chiếu chưa? Chờ thầy bắt đầu nhé.');
  if (st.phase === 'end') {
    const rk = score && score.r;
    msg(rk === 1 ? '🏆' : rk === 2 ? '🥈' : rk === 3 ? '🥉' : '🎯', rk && rk <= 3 ? 'Bạn lên bục vinh danh!' : 'Kết thúc!', (score ? 'Bạn được ' + score.s + ' điểm' + (rk ? ', hạng ' + rk + '/' + score.n : '') : 'Cảm ơn bạn đã chơi!') + '.');
    if (rk && rk <= 3 && !endFx) { endFx = 1; setTimeout(() => confetti($('fx'), 6000), 2400); }
    return;
  }
  const Q = await getQ(q); if (my !== seq) return;
  if (!Q) return msg('⏳', 'Câu ' + (q + 1) + '/' + n, 'Đang tải câu hỏi…');
  if (st.phase === 'show') {
    msg('👀', 'Câu ' + (q + 1) + '/' + n, 'Nhìn lên màn hình, chuẩn bị nhé…', Q.t);
    $('mS').insertAdjacentHTML('afterend', '<div class="loadbar x" id="lb"><i></i></div>');
    return;
  }
  if (st.phase === 'answer') {
    const a = await getMine(q); if (my !== seq) return;
    if (a != null) return waiting(a);
    if (now() > st.endAt) return msg('⌛', 'Hết giờ!', 'Chờ thầy công bố đáp án nhé.');
    return answerScreen(q, Q, st);
  }
  if (st.phase === 'reveal' || st.phase === 'board') {
    const a = await getMine(q); if (my !== seq) return;
    if (!score || score.q !== q) return st.phase === 'reveal' && a != null ? msg('⏳', 'Đang chấm…', '') : msg('🎉', 'Bạn đã vào phòng!', 'Chờ câu tiếp theo nhé.');
    return result(q, Q, a);
  }
}

function waiting(a) {
  msg('', 'Đã chọn, chờ các bạn khác…', 'Bạn chọn ' + LETTERS[a]);
  $('mIc').innerHTML = '<span style="display:inline-flex;width:110px;height:110px;border-radius:20px;align-items:center;justify-content:center;color:#fff;font-size:56px;box-shadow:0 6px 0 rgba(0,0,0,.25);background:' + COLORS[a] + '">' + SHAPES[a] + '</span>';
  $('mS').insertAdjacentHTML('afterend', '<div class="spin x"></div><div class="sendst x" id="sendst">' + (sending ? 'Đang gửi…' : '✓ Đã gửi') + '</div>');
}
function sendSt(t) { const el = $('sendst'); if (el) el.textContent = t; }

function answerScreen(q, Q, st) {
  show('sAns');
  $('aNum').textContent = 'Câu ' + (q + 1) + '/' + meta.n;
  $('aQ').textContent = Q.t;
  const g = $('aGrid'); g.innerHTML = '';
  Q.o.forEach((txt, i) => {
    if (!txt) return;
    const b = document.createElement('button');
    b.className = 'pbtn k' + i; b.type = 'button';
    b.innerHTML = '<span class="lt">' + SHAPES[i] + ' ' + LETTERS[i] + '</span><span class="tx">' + esc(txt) + '</span>';
    b.onclick = () => { b.classList.add('chosen'); pick(q, i); };
    g.appendChild(b);
  });
  const tickT = () => { const s = Math.min(Q.time, Math.max(0, Math.ceil((st.endAt - now()) / 1000))); $('aTime').textContent = '⏱ ' + s + 's'; if (s <= 0) { clearInterval(tmr); render(); } };
  tickT(); tmr = setInterval(tickT, 250);
}

async function pick(q, i) {
  if (mine[q] != null) return;
  mine[q] = i;
  try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
  clearInterval(tmr);
  sending = 1; waiting(i);
  const slow = setTimeout(() => sendSt('Mạng yếu, đang gửi lại…'), 2500);
  try { await P.D.set(r('answers/' + q + '/' + P.uid), { a: i, at: P.D.serverTimestamp() }); sending = 0; sendSt('✓ Đã gửi'); }
  catch (e) {
    sending = 0;
    // có thể đã gửi rồi (mạng chập chờn) — kiểm tra lại
    delete mine[q];
    const a = await getMine(q).catch(() => null);
    if (a == null) msg('⌛', 'Không gửi kịp', 'Mạng chậm nên câu trả lời tới sau khi hết giờ.');
  }
  clearTimeout(slow);
}

let shownRes = '';
function result(q, Q, a) {
  show('sRes');
  const ok = score.ok, box = $('rBox'), key = q + ':' + score.s;
  bg(ok ? 'st-ok' : 'st-no');
  box.className = 'res ' + (ok ? 'ok' : 'no');
  let h;
  if (a == null) h = '<div class="ic">⌛</div><h2>Hết giờ</h2><div>Bạn chưa trả lời câu này</div>';
  else if (ok) h = '<div class="ic">✔</div><h2>Chính xác!</h2>' + (score.p ? '<div class="pts">+<span id="rp">' + score.p + '</span></div>' : '<div>Câu này không tính điểm</div>');
  else h = '<div class="ic">✘</div><h2>Chưa đúng</h2><div>Đáp án đúng: ' + esc((score.c || []).map((x) => LETTERS[x]).join(', ')) + '</div>';
  if (score.k >= 2) h += '<div style="margin-top:10px;font-weight:600"><span class="flame">🔥</span> Chuỗi đúng: ' + score.k + (score.b ? ' (+' + score.b + ')' : '') + '</div>';
  box.innerHTML = h;
  const fresh = shownRes !== key; shownRes = key;
  if (fresh) { countUp($('rp'), 0, score.p || 0, 700); countUp($('rScore'), Math.max(0, score.s - (score.p || 0)), score.s, 900); try { navigator.vibrate && navigator.vibrate(ok ? [40, 60, 40] : 200); } catch (e) {} }
  else $('rScore').textContent = score.s;
  $('rRank').textContent = score.r ? score.r + '/' + score.n : '–';
  rankMsg(q);
}
// "Bạn đang hạng 2, kém An 120 điểm" — đọc điểm cả lớp (luật cho phép người trong phòng đọc scores)
let rankQ = -1;
async function rankMsg(q) {
  const el = $('rMsg'); if (!el) return;
  if (!score || !score.r) { el.hidden = true; return; }
  if (score.r === 1) { el.hidden = false; el.textContent = score.n > 1 ? '🏆 Bạn đang dẫn đầu! Giữ vững nhé!' : '🏆 Bạn đang dẫn đầu!'; return; }
  if (rankQ === q && el.textContent) { el.hidden = false; return; }
  rankQ = q;
  try {
    const [sc, ps] = await Promise.all([P.D.get(r('scores')), P.D.get(r('players'))]);
    const S = sc.val() || {}, N = ps.val() || {};
    let best = null;
    Object.keys(S).forEach((u) => { const x = S[u]; if (u !== P.uid && x && x.s > score.s && (!best || x.s < best.s)) best = { s: x.s, name: (N[u] && N[u].name) || 'bạn phía trên' }; });
    el.hidden = false;
    el.textContent = best ? 'Bạn đang hạng ' + score.r + ', kém ' + best.name + ' ' + (best.s - score.s) + ' điểm. Cố lên!' : 'Bạn đang hạng ' + score.r + '.';
  } catch (e) { el.hidden = false; el.textContent = 'Bạn đang hạng ' + score.r + '.'; }
}

// điện thoại tắt màn hình rồi mở lại: vẽ lại ngay
document.addEventListener('visibilitychange', () => { if (!document.hidden && joined) render(); });
bgfx(8);

// tự vào lại phòng khi tải lại trang / rớt mạng
(async () => {
  const pin = SS.get('qz.pin');
  if (pin && (!url.get('pin') || url.get('pin') === pin)) {
    msg('⏳', 'Đang vào lại phòng…', '');
    try { await join(pin, '', true); return; } catch (e) { SS.del('qz.pin'); }
  }
  show('sJoin');
  player().catch((e) => { $('jerr').textContent = errText(e); });
})();
