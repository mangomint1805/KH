/* Minto Quiz — màn học sinh */
import { $, esc, qtHtml, show, player, serverClock, bgfx, confetti, countUp, simWeak, COLORS, SHAPES, LETTERS, applyTheme } from './common.js?v=20';

const SS = { get: (k) => { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { sessionStorage.removeItem(k); } catch (e) {} } };
const LSget = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };

let P = null, now = () => Date.now(), PIN = '', meta = null, state = null, me = null, score = null;
const qpub = {}, mine = {}, offs = [];
let joined = false, tmr = 0, endFx = 0, sending = 0;

// màu nền theo trạng thái: tím (mặc định), xanh (đúng), đỏ (sai)
function bg(c) { document.body.classList.remove('st-ok', 'st-no'); if (c) document.body.classList.add(c); }
// Lời thầy nói: chọn ngẫu nhiên nhưng cố định theo hạt giống, vẽ lại màn hình không bị nhảy chữ
function say(arr, seed) { let h = 7; String(seed) .split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) % 9973; }); return arr[h % arr.length]; }
const L = {
  ok: ['Đỉnh nóc kịch trần! 🔥', 'Ngon nha 😎', 'Out trình luôn á 🤯', 'Chuẩn không cần chỉnh ✨', 'Mãi đỉnh 💯', 'Ghê vậy sao 😳', 'Nailed it! 🎯', 'You got it! 🙌', 'Spot on! ✨', 'Big brain moment 🧠'],
  fast: ['Nhanh như chớp luôn á ⚡', 'Tay nhanh hơn não 😳⚡', 'Vận tốc ánh sáng 🏎️', 'The early bird gets the worm 🐦', 'Speed demon! 💨', 'Faster than light! ⚡'],
  slow: ['Chậm mà chắc 🐢', 'Đúng rồi nhưng lần sau bấm lẹ hơn xíu nha 😝', 'Từ từ cũng tới nha 🐢', 'Slow and steady wins the race 🐢', 'Better late than never 😅'],
  back: ['Gỡ lại rồi nè 😤', 'Comeback mạnh mẽ 💪', 'Biết ngay mà, sai một lần thôi 😎', 'Welcome back! 😎', 'That\'s the spirit! 💪'],
  no: ['Toang rồi em ơi 😭', 'Ủa alo?? 😭', 'Hụt mất tiêu 🥲', 'Ét o ét 🆘', 'U là trời 😭', 'Suýt nữa thui 🥲', 'Là cái gì nữa? 🤨', 'Hả? 😧', 'Học rồi mà???? 😤📚', 'Khóc rùi nè 😭', 'Oops! 🙈', 'Nope 🙅', 'So close! 🤏', 'Not quite 😬'],
  broken: ['Chuỗi đứt rồi 💔', 'Ủa sao rớt chuỗi vậy nè 😭', 'Đang ngon mà 💔', 'Combo breaker! 💔', 'Noooo, the streak! 😭'],
  noSub: ['Khum sao, câu sau gỡ lại nha 💪', 'Ghi nhớ để lần sau hổng sai nữa nha 📝', 'Bình tĩnh, còn nhiều câu mà 😤', 'Don\'t give up! 💪', 'You\'ll get it next time 🍀'],
  late: ['Ủa em đi đâu dzậy 😭', 'Ngủ quên hả 😴', 'Bấm đi chứ ơi 😭', 'Do somethingggg 🫵', 'Ground control to Major Tom? 👨‍🚀', 'Hello? Anybody home? 👀', 'Time flies ⏰'],
  streak: ['nóng quá trời', 'ai cản nổi nữa 😤', 'Godlike ⚡👑', 'Can\'t touch this 🕺', 'Ước gì bớt đẳng cấp một chút để sống hoà đồng thì tốt biết bao 😮‍💨✨', 'Woah woah woah 🗣️', 'Có được phép không cả lớp???? 🫨', 'On fire! 🔥', 'Unstoppable! 🚀', 'Hat trick! 🎩'],
  chosen: ['Chốt đơn! ✅', 'Chốt rồi nha ✅', 'Bấm rồi, hông đổi được nữa nha 😝', 'Final answer! ✅', 'Locked in! 🔒'],
  wait: ['Chờ các bạn khác xíu nha…', 'Hồi hộp quá trời 🫣', 'Ngồi im chờ kết quả nha 🙏', 'Chờ chíu... hổng ai nhanh như em đâu! 😏', 'Fingers crossed 🤞', 'Stay tuned 👀'],
  up: ['gét gô 🚀', 'cố lên nha 💪', 'rượt theo liền 🏃', 'lật kèo được nè 😤', 'let\'s go! 🚀', 'catch up! 🏃'],
  rankUp: ['📈 Lên {len} hạng nè!', '🚀 Vượt lên {len} hạng luôn!', '📈 Level up! +{len}'],
  rankDown: ['😱 Bị vượt mặt rồi!', '📉 Tụt hạng rồi nè!', '😱 Someone just passed you!'],
  newTop: ['👑 Soán ngôi top 1 rồi nè!', '👑 Lên top 1 rồi, ai chơi lại 😤', '👑 New champion!'],
  last: ['Câu cuối rồi nè, quẩy hết mình nha 🔥', 'Câu cuối, lật kèo là ở đây nè 😤', 'Final question! Give it all you got 🔥'],
};
function msg(ic, t, s, q) {
  bg(''); show('sMsg'); $('sMsg').querySelectorAll('.x').forEach((e) => e.remove()); $('mIc').textContent = ic || ''; $('mT').textContent = t || ''; $('mS').textContent = s || '';
  $('mQ').hidden = !q; $('mQ').innerHTML = qtHtml(q || '');
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
  if (!name) { $('jerr').textContent = 'Nhập tên của em nha.'; return; }
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
  applyTheme(meta.theme);
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
  // phòng Đào vàng cả lớp: mỗi bạn tự làm, chuyển sang trang riêng
  if (meta.mode === 'gold') { location.replace('vang.html?pin=' + pin); return; }
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
      msg('🚪', 'Em bị mời ra khỏi phòng rồi', 'Có nhầm lẫn gì thì nói thầy nha.');
    }
  }));
  offs.push(P.D.onValue(r('scores/' + P.uid), (s) => { score = s.val(); render(); }));
  offs.push(P.D.onValue(r('meta'), (s) => {
    if (s.exists()) { const t = (s.val() || {}).theme; if (t !== (meta && meta.theme)) meta = Object.assign({}, meta, { theme: t }); applyTheme(t); }
    if (!s.exists() && joined) { joined = false; SS.del('qz.pin'); stopAll(); msg('👋', 'Phòng đóng rồi nè', 'Cảm ơn em đã chơi nha 💖'); }
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
  if (st.phase === 'lobby' || !st.phase) return msg('🎉', 'Vào phòng rồi nè!', 'Thấy tên mình trên màn chiếu chưa? Chờ thầy xíu nha 😚');
  if (st.phase === 'end') {
    const rk = score && score.r;
    msg(rk === 1 ? '👑' : rk === 2 ? '🥈' : rk === 3 ? '🥉' : '🎮', rk === 1 ? 'Quán quân là em chứ ai 👑' : rk && rk <= 3 ? 'Lên bục rồi nè, đỉnh quá 🥳' : 'Hết game rồi nè!', score ? 'Em được ' + score.s + ' điểm' + (rk ? ', hạng ' + rk + '/' + score.n : '') + (rk && rk <= 3 ? '. Quá dữ 🔥' : '. Lần sau quẩy tiếp nha 💪') : 'Cảm ơn em đã chơi nha 💖');
    if (rk && rk <= 3 && !endFx) { endFx = 1; setTimeout(() => confetti($('fx'), 6000), 2400); }
    return;
  }
  const Q = await getQ(q); if (my !== seq) return;
  if (!Q) return msg('⏳', 'Câu ' + (q + 1) + '/' + n, 'Đang tải câu hỏi…');
  // 📦 nhóm câu: cả nhóm trên một màn, nộp một lần
  if (Q.gn && +Q.g === q && (st.phase === 'show' || st.phase === 'answer')) return drawGroup(my, st, q, Q);
  if (st.phase === 'show' && st.endAt) { // thầy bấm tạm dừng giữa câu
    const a = sending ? null : await getMine(q); if (my !== seq) return; // đang gửi dở: chưa chắc đã lưu
    return msg('⏸', 'Thầy tạm dừng xíu nha', a != null ? 'Em chọn ' + LETTERS[a] + ' rồi, chờ thầy bấm tiếp tục nha.' : 'Đồng hồ đang dừng, chờ thầy bấm tiếp tục rồi chọn đáp án nha.', Q.t);
  }
  if (st.phase === 'show') {
    msg('👀', 'Câu ' + (q + 1) + '/' + n, q + 1 === n && n > 1 ? say(L.last, PIN) : 'Nhìn lên bảng nè, chuẩn bị bấm nha 👀', Q.t);
    $('mS').insertAdjacentHTML('afterend', '<div class="loadbar x" id="lb"><i></i></div>');
    return;
  }
  if (st.phase === 'answer') {
    const a = await getMine(q); if (my !== seq) return;
    if (a != null) return waiting(a);
    if (now() > st.endAt) return msg('⌛', 'Hết giờ mất rồi 😭', 'Chờ thầy công bố đáp án nha.');
    return answerScreen(q, Q, st);
  }
  if (st.phase === 'reveal' || st.phase === 'board') {
    const a = await getMine(q); if (my !== seq) return;
    if (!score || score.q !== q) return st.phase === 'reveal' && a != null ? msg('🤔', 'Đang chấm nè…', '') : msg('🎉', 'Vào phòng rồi nè!', 'Chờ câu tiếp theo nha 😚');
    return result(q, Q, a);
  }
}

function waiting(a) {
  msg('', say(L.chosen, 'c' + a + (state && state.qs)), 'Em chọn ' + LETTERS[a] + '. ' + say(L.wait, 'w' + a + (state && state.qs)));
  $('mIc').innerHTML = '<span style="display:inline-flex;width:110px;height:110px;border-radius:20px;align-items:center;justify-content:center;color:#fff;font-size:56px;box-shadow:0 6px 0 rgba(0,0,0,.25);background:' + COLORS[a] + '">' + SHAPES[a] + '</span>';
  $('mS').insertAdjacentHTML('afterend', '<div class="spin x"></div><div class="sendst x" id="sendst">' + (sending ? 'Đang gửi…' : '✓ Đã gửi') + '</div>');
}
function sendSt(t) { const el = $('sendst'); if (el) el.textContent = t; }

function answerScreen(q, Q, st) {
  show('sAns');
  $('aNum').textContent = 'Câu ' + (q + 1) + '/' + meta.n;
  $('aQ').innerHTML = qtHtml(Q.t); $('aQ').classList.toggle('long', String(Q.t || '').length > 100);
  const g = $('aGrid'); g.innerHTML = '';
  Q.o.forEach((txt, i) => {
    if (!txt) return;
    const b = document.createElement('button');
    b.className = 'pbtn k' + i; b.type = 'button';
    b.innerHTML = '<span class="lt">' + SHAPES[i] + ' ' + LETTERS[i] + '</span><span class="tx">' + esc(txt) + '</span>';
    b.onclick = () => { b.classList.add('chosen'); pick(q, i); };
    g.appendChild(b);
  });
  const tickT = () => { if (st.endAt - now() > 3600e3) { $('aTime').textContent = '⏸ Thầy đang dừng giờ'; return; } const s = Math.min(Q.time, Math.max(0, Math.ceil((st.endAt - now()) / 1000))); $('aTime').textContent = '⏱ ' + s + 's'; if (s <= 0) { clearInterval(tmr); render(); } };
  tickT(); tmr = setInterval(tickT, 250);
}

async function pick(q, i) {
  if (mine[q] != null) return;
  mine[q] = i;
  try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
  clearInterval(tmr);
  sending = 1; waiting(i);
  const slow = setTimeout(() => sendSt('Mạng yếu, đang gửi lại…'), 2500);
  // Ghi giờ bấm (giờ máy chủ ước lượng) để mạng chậm dưới 5 giây không bị trừ điểm tốc độ;
  // nếu tới quá muộn, luật sẽ từ chối và mình gửi lại bằng giờ máy chủ.
  const tap = Math.round(now()) - 100, ref = r('answers/' + q + '/' + P.uid);
  try {
    try { await P.D.set(ref, { a: i, at: tap }); }
    catch (e1) { const s0 = await P.D.get(ref).catch(() => null); if (s0 && s0.exists()) throw 0; await P.D.set(ref, { a: i, at: P.D.serverTimestamp() }); }
    sending = 0; sendSt('✓ Đã gửi');
  }
  catch (e) {
    if (e === 0) { sending = 0; sendSt('✓ Đã gửi'); clearTimeout(slow); return; }
    sending = 0;
    // có thể đã gửi rồi (mạng chập chờn) — kiểm tra lại
    delete mine[q];
    const a = await getMine(q).catch(() => null);
    // thầy vừa tạm dừng: chưa phải hết giờ, vẽ lại để em chọn lại sau khi tiếp tục
    if (a == null) { if (state && state.phase === 'answer' && now() > state.endAt) msg('📶', 'Mạng lag quá, gửi không kịp 😭', 'Câu trả lời tới sau khi hết giờ mất rồi. Câu sau gỡ nha!'); else render(); }
  }
  clearTimeout(slow);
}

// ---------- 📦 nhóm câu (Part 3/4/6/7) ----------
// Thầy đưa cả nhóm lên qpub (câu đầu có gn = số câu, p = đoạn văn; mỗi câu có g = câu đầu, no = số câu trên đề).
// Em chọn hết rồi bấm Nộp bài: ghi câu trả lời từng câu vào answers/{câu}/{uid} trong MỘT lần ghi (cùng giờ nộp). Hết giờ tự nộp những câu đã chọn.
const lblOf = (q) => (qpub[q] && qpub[q].no) || q + 1;
const gpKey = (f) => 'qz.gp.' + PIN + '.' + f;
const gpGet = (f) => { try { return JSON.parse(SS.get(gpKey(f)) || '{}') || {}; } catch (e) { return {}; } };
const gpSet = (f, v) => SS.set(gpKey(f), JSON.stringify(v));
const gBusy = {};
let gOn = '';
async function drawGroup(my, st, f, Q0) {
  const ids = Array.from({ length: Q0.gn }, (_, i) => f + i);
  const QS = await Promise.all(ids.map(getQ)); if (my !== seq) return;
  const title = 'Câu ' + lblOf(f) + '–' + lblOf(ids[ids.length - 1]);
  if (QS.some((x) => !x)) return msg('⏳', title, 'Đang tải câu hỏi…');
  if (st.phase === 'show' && st.endAt) {
    const sent = gBusy[f] ? false : (await Promise.all(ids.map(getMine))).some((a) => a != null); if (my !== seq) return;
    return msg('⏸', 'Thầy tạm dừng xíu nha', sent ? 'Em nộp bài rồi, chờ thầy bấm tiếp tục nha.' : 'Đồng hồ đang dừng, đáp án em đã chọn vẫn còn đó. Chờ thầy bấm tiếp tục rồi làm tiếp nha.');
  }
  if (st.phase === 'show') {
    msg('📦', title, 'Nhóm ' + ids.length + ' câu: ' + (Q0.p ? 'đọc đoạn văn' : 'nhìn lên bảng / nghe') + ' rồi làm cả nhóm trên một màn, nộp một lần nha 👀');
    $('mS').insertAdjacentHTML('afterend', '<div class="loadbar x" id="lb"><i></i></div>');
    return;
  }
  const sent = gBusy[f] || (await Promise.all(ids.map(getMine))).some((a) => a != null); if (my !== seq) return;
  if (sent) return gWaiting(f, ids);
  if (now() > st.endAt) return msg('⌛', 'Hết giờ mất rồi 😭', 'Chờ thầy chữa từng câu nha.');
  groupScreen(f, ids, QS, st);
}
function groupScreen(f, ids, QS, st) {
  const key = f + ':' + st.endAt;
  if (gOn !== key || $('sGrp').hidden) {
    gOn = key; show('sGrp'); bg('');
    $('gNum').textContent = 'Câu ' + lblOf(f) + '–' + lblOf(ids[ids.length - 1]) + ' · nộp một lần';
    const p = QS[0].p || '';
    $('gPass').hidden = !p; $('gPT').innerHTML = qtHtml(p);
    $('gList').innerHTML = ids.map((q, k) => '<div class="gq" data-q="' + q + '"><div class="st"><b>' + lblOf(q) + '.</b> ' + qtHtml(QS[k].t) + '</div><div class="gopts">' +
      (QS[k].o || []).map((o, i) => o ? '<button type="button" class="gopt" data-q="' + q + '" data-a="' + i + '"><span class="lt k' + i + '">' + SHAPES[i] + ' ' + LETTERS[i] + '</span><span class="tx">' + esc(o) + '</span></button>' : '').join('') + '</div></div>').join('');
    $('gList').querySelectorAll('.gopt').forEach((b) => { b.onclick = () => {
      const v = gpGet(f); v[b.dataset.q] = +b.dataset.a; gpSet(f, v); $('gHint').textContent = '';
      try { navigator.vibrate && navigator.vibrate(25); } catch (e) {}
      paintG(f, ids);
    }; });
    $('gGo').onclick = () => gSubmit(f, ids, false);
    $('gHint').textContent = '';
  }
  paintG(f, ids);
  const tickT = () => {
    const ms = st.endAt - now(), s = Math.max(0, Math.ceil(ms / 1000));
    if (ms > 3600e3) { $('gTime').textContent = '⏱ Không giới hạn · làm xong bấm Nộp'; return; }
    $('gTime').textContent = '⏱ ' + s + 's';
    // sắp hết giờ: tự nộp những câu đã chọn (luật cho trễ tối đa 1,5 giây)
    if (ms <= 700) { clearInterval(tmr); if (state === st) gSubmit(f, ids, true); }
  };
  clearInterval(tmr); tickT(); tmr = setInterval(tickT, 250);
}
function paintG(f, ids) {
  const v = gpGet(f), done = ids.filter((q) => v[q] != null).length;
  $('gList').querySelectorAll('.gopt').forEach((b) => b.classList.toggle('chosen', v[b.dataset.q] === +b.dataset.a));
  $('gList').querySelectorAll('.gq').forEach((el) => el.classList.remove('miss'));
  $('gGo').textContent = 'Nộp bài (' + done + '/' + ids.length + ' câu)';
}
async function gSubmit(f, ids, auto) {
  if (gBusy[f]) return;
  const v = gpGet(f), ch = ids.filter((q) => v[q] != null), miss = ids.length - ch.length;
  if (!ch.length) {
    if (auto) return msg('⌛', 'Hết giờ mất rồi 😭', 'Em chưa chọn câu nào trong nhóm này. Chờ thầy chữa từng câu nha.');
    $('gHint').textContent = 'Chọn đáp án rồi mới nộp được nha 😝'; return;
  }
  if (!auto && miss) {
    const first = $('gList').querySelector('.gq[data-q="' + ids.find((q) => v[q] == null) + '"]');
    if (!$('gGo').dataset.warn) {
      $('gGo').dataset.warn = '1';
      $('gList').querySelectorAll('.gq').forEach((el) => el.classList.toggle('miss', v[el.dataset.q] == null));
      $('gHint').textContent = 'Còn ' + miss + ' câu chưa chọn (khung vàng). Bấm Nộp bài lần nữa để nộp luôn.';
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { delete $('gGo').dataset.warn; }, 6000);
      return;
    }
  }
  delete $('gGo').dataset.warn;
  gBusy[f] = 1; clearInterval(tmr); sending = 1;
  ch.forEach((q) => { mine[q] = v[q]; });
  try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
  gWaiting(f, ids);
  const slow = setTimeout(() => sendSt('Mạng yếu, đang gửi lại…'), 2500);
  const mk = (at) => { const up = {}; ch.forEach((q) => { up['answers/' + q + '/' + P.uid] = { a: v[q], at }; }); return up; };
  try {
    // giờ nộp (giờ máy chủ ước lượng); bị từ chối vì tới muộn thì gửi lại bằng giờ máy chủ
    try { await P.D.update(r(), mk(Math.round(now()) - 100)); }
    catch (e1) { const s0 = await P.D.get(r('answers/' + ch[0] + '/' + P.uid)).catch(() => null); if (s0 && s0.exists()) throw 0; await P.D.update(r(), mk(P.D.serverTimestamp())); }
    sending = 0; sendSt('✓ Đã nộp');
  } catch (e) {
    sending = 0;
    if (e === 0) sendSt('✓ Đã nộp');
    else {
      ch.forEach((q) => { delete mine[q]; });
      const a = await getMine(ch[0]).catch(() => null);
      if (a == null) { gBusy[f] = 0; gOn = ''; if (state && state.phase === 'answer' && now() > state.endAt) msg('📶', 'Mạng lag quá, nộp không kịp 😭', 'Bài tới sau khi hết giờ mất rồi. Nhóm sau gỡ nha!'); else render(); }
      else sendSt('✓ Đã nộp');
    }
  }
  clearTimeout(slow);
}
function gWaiting(f, ids) {
  msg('✅', 'Nộp bài rồi nha', 'Em chọn ' + ids.map((q) => lblOf(q) + '-' + (mine[q] != null ? LETTERS[mine[q]] : '–')).join(' · ') + '. ' + say(L.wait, 'g' + f));
  $('mS').insertAdjacentHTML('afterend', '<div class="spin x"></div><div class="sendst x" id="sendst">' + (sending ? 'Đang gửi…' : '✓ Đã nộp') + '</div>');
}

let shownRes = '';
// nhớ kết quả từng câu trong phiên để biết câu trước đúng hay sai, chuỗi và hạng câu trước
function hist() { try { return JSON.parse(SS.get('qz.h.' + PIN) || '{}'); } catch (e) { return {}; } }
function remember(q) { const h = hist(); h[q] = { ok: !!score.ok, k: score.k || 0, r: score.r || 0 }; SS.set('qz.h.' + PIN, JSON.stringify(h)); }
function result(q, Q, a) {
  show('sRes');
  const ok = score.ok, box = $('rBox'), key = q + ':' + score.s;
  bg(ok ? 'st-ok' : 'st-no');
  box.className = 'res ' + (ok ? 'ok' : 'no');
  const sd = q + (P && P.uid || ''), pv = hist()[q - 1];
  remember(q);
  let h;
  if (a == null) h = '<div class="ic">⌛</div><h2>' + say(L.late, sd) + '</h2><div>Câu này em chưa chọn đáp án nè</div>';
  else if (ok) {
    const sp = (score.p || 0) - (score.b || 0); // điểm tốc độ, không tính thưởng chuỗi
    const t = pv && !pv.ok ? L.back : sp >= 900 * (Q.pts || 1) ? L.fast : sp && sp < 600 * (Q.pts || 1) ? L.slow : L.ok;
    h = '<div class="ic">✔</div><h2>' + say(t, sd) + '</h2>' + (score.p ? '<div class="pts">+<span id="rp">' + score.p + '</span></div>' : '<div>Câu này hông tính điểm nha</div>');
  } else h = '<div class="ic">✘</div><h2>' + say(pv && pv.k >= 3 ? L.broken : L.no, sd) + '</h2><div>Đáp án đúng là <b>' + esc((score.c || []).map((x) => LETTERS[x]).join(', ')) + '</b> nè. ' + say(L.noSub, sd + 'n') + '</div>';
  if (score.k >= 2) h += '<div style="margin-top:10px;font-weight:600"><span class="flame">🔥</span> Chuỗi ' + score.k + ' câu đúng' + (score.b ? ' (+' + score.b + ')' : '') + ', ' + say(L.streak, sd + 'k') + '</div>';
  if (Q.g != null) h = '<div class="rlbl">Câu ' + lblOf(q) + '</div>' + h;
  box.innerHTML = h;
  const fresh = shownRes !== key; shownRes = key;
  if (fresh) { countUp($('rp'), 0, score.p || 0, 700); countUp($('rScore'), Math.max(0, score.s - (score.p || 0)), score.s, 900); try { navigator.vibrate && navigator.vibrate(ok ? [40, 60, 40] : 200); } catch (e) {} }
  else $('rScore').textContent = score.s;
  $('rRank').textContent = score.r ? score.r + '/' + score.n : '–';
  rankMsg(q, pv);
}
// "Em đang hạng 2, chỉ kém An 120 điểm" — đọc điểm cả lớp (luật cho phép người trong phòng đọc scores)
let rankQ = -1;
async function rankMsg(q, pv) {
  const el = $('rMsg'); if (!el) return;
  if (!score || !score.r) { el.hidden = true; return; }
  const sd = q + (P && P.uid || '');
  let pre = '';
  if (pv && pv.r && score.r < pv.r) pre = (score.r === 1 ? say(L.newTop, sd) : say(L.rankUp, sd).replace('{len}', pv.r - score.r)) + ' ';
  else if (pv && pv.r && score.r > pv.r) pre = say(L.rankDown, sd) + ' ';
  if (score.r === 1) { el.hidden = false; el.textContent = pre && score.n > 1 ? pre.trim() : score.n > 1 ? '👑 Em đang top 1 nè, giữ vững phong độ nha!' : '👑 Em đang top 1 nè!'; return; }
  if (rankQ === q && el.textContent) { el.hidden = false; return; }
  rankQ = q;
  try {
    const [sc, ps] = await Promise.all([P.D.get(r('scores')), P.D.get(r('players'))]);
    const S = sc.val() || {}, N = ps.val() || {};
    let best = null;
    Object.keys(S).forEach((u) => { const x = S[u]; if (u !== P.uid && x && x.s > score.s && (!best || x.s < best.s)) best = { s: x.s, name: (N[u] && N[u].name) || 'bạn phía trên' }; });
    el.hidden = false;
    el.textContent = pre + (best ? 'Em đang hạng ' + score.r + ', chỉ kém ' + best.name + ' ' + (best.s - score.s) + ' điểm thui, ' + say(L.up, q + best.name) : 'Em đang hạng ' + score.r + ' nè.');
  } catch (e) { el.hidden = false; el.textContent = pre + 'Em đang hạng ' + score.r + ' nè.'; }
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
