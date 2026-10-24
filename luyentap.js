/* Trang học sinh: tự luyện và làm bài kiểm tra ở nhà */
(function () {
  const $ = id => document.getElementById(id);
  const esc = QM.escapeHtml;
  const L = ['A', 'B', 'C', 'D'], YL = ['a', 'b', 'c', 'd'];
  const SCREENS = ['noconfig', 'entry', 'info', 'practice', 'test', 'result'];
  const S = { fb: null, uid: null, code: '', meta: null, qs: [], key: null, sub: {}, ans: {}, st: 0, timer: null, saveT: null, order: [], pr: null, submitted: false, busy: false };
  const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const show = n => { SCREENS.forEach(s => $('scr-' + s).classList.toggle('hidden', s !== n)); if (n !== 'test') { $('hd-timer').classList.add('hidden'); $('hd-timer').classList.remove('flex'); } window.scrollTo(0, 0); };
  const ref = p => S.fb.db.ref('assign/' + S.code + '/' + p);
  const fmtTime = ms => new Date(ms).toLocaleString('vi-VN');

  function err(msg) { const e = $('entry-error'); e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }

  /* ---------- Nhập mã ---------- */
  async function enter() {
    err('');
    const code = $('in-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return err('Mã bài gồm 6 ký tự.');
    const btn = $('btn-enter'); btn.disabled = true; btn.textContent = 'Đang tải...';
    try {
      await S.fb.ready;
      if (!S.fb.auth.currentUser) await S.fb.auth.signInAnonymously();
      S.uid = S.fb.auth.currentUser.uid; S.code = code;
      const m = await ref('meta').once('value');
      if (!m.exists()) throw new Error('Không tìm thấy bài có mã ' + code + '. Em kiểm tra lại mã nhé.');
      S.meta = m.val();
      S.qs = QM.arr((await ref('q').once('value')).val());
      if (!S.qs.length) throw new Error('Bài này chưa có câu hỏi.');
      S.sub = (await ref('subs/' + S.uid).once('value')).val() || {};
      S.key = null; S.submitted = false;
      showInfo();
    } catch (e) { err(QM.fbError(e)); }
    finally { btn.disabled = false; btn.textContent = 'Tiếp tục'; }
  }

  function counts() { const tf = S.qs.filter(q => q.t === 'tf').length; return { mcq: S.qs.length - tf, tf }; }
  const isTest = () => S.meta.mode === 'test';

  function showInfo() {
    const m = S.meta, c = counts(), test = isTest();
    $('info-badge').textContent = test ? 'KIỂM TRA LẤY ĐIỂM' : 'TỰ LUYỆN';
    $('info-badge').className = 'inline-block text-[11px] font-bold px-2 py-0.5 rounded ' + (test ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300');
    $('info-title').textContent = m.title; $('info-teacher').textContent = m.ownerName ? 'Giáo viên: ' + m.ownerName : '';
    const facts = [['Số câu', `${S.qs.length} (${c.mcq} nhiều lựa chọn, ${c.tf} đúng/sai)`]];
    if (test) { facts.push(['Thời gian làm bài', m.timeLimit + ' phút'], ['Số lần làm', '1 lần']); if (m.openAt) facts.push(['Mở từ', fmtTime(m.openAt)]); if (m.closeAt) facts.push(['Đóng lúc', fmtTime(m.closeAt)]); }
    else facts.push(['Hình thức', 'Không giới hạn thời gian, xem đáp án ngay']);
    $('info-facts').innerHTML = facts.map(([k, v]) => `<div class="rounded-xl bg-slate-900 border border-slate-800 p-2"><div class="text-slate-400">${k}</div><div class="font-bold">${esc(v)}</div></div>`).join('');
    const prof = (() => { try { return JSON.parse(localStorage.getItem('qm_stu_profile') || '{}'); } catch (e) { return {}; } })();
    $('in-name').value = S.sub.name || prof.name || ''; $('in-cls').value = S.sub.cls || prof.cls || '';
    $('lbl-name').textContent = test ? 'Họ và tên (bắt buộc)' : 'Họ và tên (để thầy cô biết em đã luyện)';
    $('lbl-cls').textContent = test ? 'Lớp (bắt buộc)' : 'Lớp';
    $('info-practice-opts').classList.toggle('hidden', test);
    if (!test) {
      $('pr-mcq-wrap').classList.toggle('hidden', !c.mcq); $('pr-tf-wrap').classList.toggle('hidden', !c.tf);
      $('pr-mcq-n').textContent = c.mcq; $('pr-tf-n').textContent = c.tf; $('pr-mcq').checked = c.mcq > 0; $('pr-tf').checked = c.tf > 0; $('pr-n').value = '';
    }
    // Trạng thái
    const msg = $('info-msg'), btn = $('btn-start'), who = $('info-who'); msg.classList.add('hidden'); btn.disabled = false; who.classList.remove('hidden');
    const note = t => { msg.textContent = t; msg.classList.remove('hidden'); };
    btn.textContent = test ? '▶️ Bắt đầu làm bài' : '▶️ Bắt đầu luyện tập'; S.mode = 'start';
    const now = S.fb.now(), att = S.sub.att && S.sub.att.a1;
    if (test && att && att.sub) { btn.textContent = '📄 Xem kết quả của em'; S.mode = 'viewresult'; note('Em đã nộp bài này lúc ' + fmtTime(att.sub) + '. Mỗi học sinh chỉ được làm 1 lần.'); who.classList.add('hidden'); }
    else if (test && att) {
      const left = m.timeLimit * 60 - (now - att.st) / 1000;
      if (left > 0) { btn.textContent = '▶️ Tiếp tục làm bài'; S.mode = 'resume'; note('Em đang làm dở bài này, còn khoảng ' + Math.ceil(left / 60) + ' phút. Bấm “Tiếp tục làm bài”.'); }
      else { btn.textContent = '📤 Nộp phần đã làm'; S.mode = 'autosubmit'; note('Đã hết thời gian làm bài. Bấm nút để nộp phần em đã làm.'); who.classList.add('hidden'); }
    } else if (m.status === 'closed') { btn.disabled = true; note('Bài này đã được thầy cô đóng.'); }
    else if (test && m.openAt && now < m.openAt) { btn.disabled = true; note('Bài kiểm tra chưa mở. Mở lúc ' + fmtTime(m.openAt) + '.'); }
    else if (test && m.closeAt && now > m.closeAt) { btn.disabled = true; note('Bài kiểm tra đã hết hạn lúc ' + fmtTime(m.closeAt) + '.'); }
    show('info');
  }

  $('btn-start').onclick = async () => {
    if (S.busy) return; S.busy = true; const btn = $('btn-start'); btn.disabled = true;
    try {
      if (S.mode === 'viewresult') { await loadKey(); await openResultFromSaved(); }
      else if (S.mode === 'autosubmit') { await resumeTest(true); }
      else if (isTest()) { await startTest(); }
      else await startPractice();
    } catch (e) { QM.toast(QM.fbError(e), 'error'); }
    finally { S.busy = false; btn.disabled = false; }
  };
  $('btn-info-back').onclick = () => show('entry');

  async function loadKey() { if (!S.key) S.key = QM.arr((await ref('key').once('value')).val()); }
  function profile() {
    const name = $('in-name').value.trim(), cls = $('in-cls').value.trim();
    try { localStorage.setItem('qm_stu_profile', JSON.stringify({ name, cls })); } catch (e) { }
    return { name, cls };
  }

  /* ---------- Hiển thị câu hỏi dùng chung ---------- */
  function reviewHtml(i, q, k, a, num) {
    const e = k.e;
    if (q.t === 'tf') {
      const str = typeof a === 'string' ? a : '----', ka = QM.arr(k.a), ex = QM.arr(e);
      return `<div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2"><p class="font-bold text-sm whitespace-pre-line">Câu ${num}. ${esc(q.q)}</p>` +
        q.s.map((t, j) => { const ch = str.charAt(j), ok = (ch === 'T' && ka[j] === true) || (ch === 'F' && ka[j] === false); return `<div class="text-xs p-2 rounded-lg border ${ok ? 'border-emerald-700 bg-emerald-950/40' : 'border-rose-700 bg-rose-950/40'}"><b>${YL[j]})</b> ${esc(t)}<div class="mt-1">Em chọn: <b>${ch === 'T' ? 'Đúng' : ch === 'F' ? 'Sai' : 'chưa chọn'}</b> • Đáp án: <b class="${ka[j] ? 'text-emerald-300' : 'text-rose-300'}">${ka[j] ? 'Đúng' : 'Sai'}</b></div>${ex[j] ? `<div class="mt-1 text-slate-300 italic">💡 ${esc(ex[j])}</div>` : ''}</div>`; }).join('') + '</div>';
    }
    return `<div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2"><p class="font-bold text-sm whitespace-pre-line">Câu ${num}. ${esc(q.q)}</p>` +
      q.o.map((o, j) => `<div class="text-xs p-2 rounded-lg border ${j === k.a ? 'border-emerald-600 bg-emerald-950/50 text-emerald-100' : (j === a ? 'border-rose-600 bg-rose-950/50 text-rose-100' : 'border-slate-800 text-slate-300')}"><b>${L[j]}.</b> ${esc(o)}${j === k.a ? ' ✓' : ''}${j === a && j !== k.a ? ' ✗ (em chọn)' : ''}${j === a && j === k.a ? ' (em chọn)' : ''}</div>`).join('') +
      (a === undefined ? '<div class="text-xs text-amber-300">Em chưa trả lời câu này.</div>' : '') + (e ? `<p class="text-[11px] text-slate-400 italic">💡 ${esc(e)}</p>` : '') + '</div>';
  }

  /* ---------- TỰ LUYỆN ---------- */
  async function startPractice() {
    if (!$('pr-mcq').checked && !$('pr-tf').checked) return QM.toast('Em hãy chọn ít nhất một loại câu hỏi.', 'error');
    await loadKey();
    let idx = S.qs.map((q, i) => i).filter(i => (S.qs[i].t === 'tf' ? $('pr-tf').checked : $('pr-mcq').checked));
    idx = QM.shuffle(idx);
    const n = parseInt($('pr-n').value, 10); if (n > 0) idx = idx.slice(0, n);
    S.profile = profile();
    S.pr = { items: idx.map(i => ({ i, perm: S.qs[i].t === 'tf' ? null : QM.shuffle([0, 1, 2, 3]) })), pos: 0, ans: {}, sel: null, checked: false };
    show('practice'); renderPr();
  }
  function curScore() { const r = QM.scoreAssign(S.qs, S.key, S.pr.ans, { onlyAnswered: true }); return r; }
  function renderPr() {
    const P = S.pr, it = P.items[P.pos], q = S.qs[it.i], k = S.key[it.i] || {};
    P.checked = false; P.sel = q.t === 'tf' ? [null, null, null, null] : null;
    $('pr-prog').textContent = `Câu ${P.pos + 1}/${P.items.length}`;
    const sc = curScore(); $('pr-score').textContent = `Đúng ${sc.nOk}/${Object.keys(P.ans).length}`;
    $('pr-type').textContent = q.t === 'tf' ? 'CÂU ĐÚNG/SAI: chọn Đúng hoặc Sai cho từng ý' : 'CÂU NHIỀU LỰA CHỌN: chọn 1 đáp án đúng';
    $('pr-q').textContent = q.q;
    $('pr-fb').classList.add('hidden'); $('pr-next').classList.add('hidden'); $('pr-check').classList.toggle('hidden', q.t !== 'tf'); $('pr-check').disabled = true;
    $('pr-next').textContent = P.pos === P.items.length - 1 ? '🏁 Xem kết quả' : 'Câu tiếp ➡️';
    if (q.t === 'tf') {
      $('pr-body').innerHTML = q.s.map((t, j) => `<div class="p-3 rounded-xl border border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-2" data-row="${j}"><span class="text-sm flex-1 min-w-[200px]"><b>${YL[j]})</b> ${esc(t)}</span><span class="flex gap-2"><button class="tfb" data-j="${j}" data-v="T">Đúng</button><button class="tfb" data-j="${j}" data-v="F">Sai</button></span></div>`).join('');
    } else {
      $('pr-body').innerHTML = it.perm.map((orig, d) => `<button class="opt" data-orig="${orig}"><b>${L[d]}.</b> ${esc(q.o[orig])}</button>`).join('');
    }
  }
  function prFeedback(html, good) { const f = $('pr-fb'); f.className = 'p-3 rounded-xl text-sm space-y-1 ' + (good ? 'bg-emerald-950/50 border border-emerald-700 text-emerald-100' : 'bg-rose-950/40 border border-rose-700 text-rose-100'); f.innerHTML = html; f.classList.remove('hidden'); }
  $('pr-body').addEventListener('click', e => {
    const P = S.pr; if (!P || P.checked) return;
    const it = P.items[P.pos], q = S.qs[it.i], k = S.key[it.i] || {};
    const ob = e.target.closest('.opt');
    if (ob && q.t !== 'tf') {
      const orig = parseInt(ob.dataset.orig, 10); P.checked = true; P.ans['q' + it.i] = orig;
      const ok = orig === k.a;
      $('pr-body').querySelectorAll('.opt').forEach(b => { b.disabled = true; const o = parseInt(b.dataset.orig, 10); if (o === k.a) b.classList.add('ok'); else if (o === orig) b.classList.add('bad'); });
      prFeedback((ok ? '🎉 <b>Chính xác!</b>' : `😢 <b>Chưa đúng.</b> Đáp án đúng: <b>${esc(q.o[k.a])}</b>`) + (k.e ? `<div class="text-xs italic opacity-90">💡 ${esc(k.e)}</div>` : ''), ok);
      if (ok) QM.sound.correct(); else QM.sound.wrong();
      $('pr-next').classList.remove('hidden'); $('pr-score').textContent = `Đúng ${curScore().nOk}/${Object.keys(P.ans).length}`;
      return;
    }
    const tb = e.target.closest('.tfb');
    if (tb && q.t === 'tf') {
      const j = parseInt(tb.dataset.j, 10); P.sel[j] = tb.dataset.v;
      $('pr-body').querySelectorAll(`.tfb[data-j="${j}"]`).forEach(b => b.classList.toggle('sel', b.dataset.v === tb.dataset.v));
      $('pr-check').disabled = P.sel.some(x => !x);
    }
  });
  $('pr-check').onclick = () => {
    const P = S.pr, it = P.items[P.pos], q = S.qs[it.i], k = S.key[it.i] || {}, ka = QM.arr(k.a), ex = QM.arr(k.e);
    if (P.checked || P.sel.some(x => !x)) return; P.checked = true;
    P.ans['q' + it.i] = P.sel.join('');
    let c = 0; const lines = [];
    P.sel.forEach((v, j) => {
      const ok = (v === 'T') === ka[j]; if (ok) c++;
      $('pr-body').querySelectorAll(`.tfb[data-j="${j}"]`).forEach(b => { b.disabled = true; b.classList.remove('sel'); const bv = b.dataset.v === 'T'; if (bv === ka[j]) b.classList.add('ok'); else if (b.dataset.v === v) b.classList.add('bad'); });
      lines.push(`<div class="text-xs"><b>${YL[j]})</b> ${ka[j] ? 'ĐÚNG' : 'SAI'}${ok ? ' ✓' : ' ✗'}${ex[j] ? ' — ' + esc(ex[j]) : ''}</div>`);
    });
    prFeedback(`<b>${c}/4 ý đúng</b> (${c === 4 ? 'trọn điểm' : 'điểm từng phần: ' + [0, 10, 25, 50, 100][c] + '% điểm câu'})` + lines.join(''), c >= 3);
    if (c === 4) QM.sound.correct(); else QM.sound.wrong();
    $('pr-check').classList.add('hidden'); $('pr-next').classList.remove('hidden'); $('pr-score').textContent = `Đúng ${curScore().nOk}/${Object.keys(P.ans).length}`;
  };
  $('pr-next').onclick = () => { const P = S.pr; if (P.pos >= P.items.length - 1) finishPractice(); else { P.pos++; renderPr(); } };

  async function finishPractice() {
    const P = S.pr, r = QM.scoreAssign(S.qs, S.key, P.ans, { onlyAnswered: true });
    $('rs-icon').textContent = r.score10 >= 8 ? '🏆' : r.score10 >= 5 ? '👍' : '💪';
    $('rs-title').textContent = 'Hoàn thành luyện tập!'; $('rs-score').textContent = fmt(r.score10) + ' / 10';
    $('rs-detail').textContent = `Đúng hoàn toàn ${r.nOk}/${P.items.length} câu`;
    $('rs-note').textContent = 'Điểm tính theo thang 10 (câu đúng/sai được tính điểm từng phần).';
    $('btn-again').classList.remove('hidden');
    // Xem lại các câu chưa đúng hoàn toàn
    const wrong = P.items.map((it, n) => ({ it, n, d: r.detail[it.i] })).filter(x => x.d && ((x.d.type === 'mcq' && !x.d.ok) || (x.d.type === 'tf' && x.d.c < 4)));
    $('rs-review').innerHTML = wrong.length ? '<h3 class="font-bold text-sm text-amber-300">Các câu em cần xem lại</h3>' + wrong.map(x => reviewHtml(x.it.i, S.qs[x.it.i], S.key[x.it.i] || {}, P.ans['q' + x.it.i], x.n + 1)).join('') : '<div class="text-center text-emerald-300 font-bold">Em làm đúng hết tất cả các câu! 🎉</div>';
    show('result'); QM.sound.cheer();
    // Ghi nhận cho thầy cô (nếu em nhập tên)
    if (S.profile && S.profile.name) {
      try {
        const subs = (await ref('subs/' + S.uid + '/att').once('value')).val() || {};
        const n = Math.max(0, ...Object.keys(subs).map(k => parseInt(k.slice(1), 10) || 0)) + 1;
        if (n < 1000) {
          await ref('subs/' + S.uid).update({ name: S.profile.name, cls: S.profile.cls || '' });
          await ref('subs/' + S.uid + '/att/a' + n).set({ st: QM.TS(), sub: QM.TS(), a: P.ans });
        }
      } catch (e) { /* không ghi được cũng không sao */ }
    }
  }
  $('btn-again').onclick = () => { if (isTest()) return; showInfo(); };

  /* ---------- KIỂM TRA LẤY ĐIỂM ---------- */
  async function startTest() {
    const p = profile(); if (!p.name || !p.cls) return QM.toast('Em hãy nhập đầy đủ họ tên và lớp.', 'error');
    if (!confirm(`Bắt đầu làm bài? Đồng hồ ${S.meta.timeLimit} phút sẽ chạy ngay và em chỉ được làm 1 lần.`)) return;
    await ref('subs/' + S.uid).update({ name: p.name, cls: p.cls });
    await ref('subs/' + S.uid + '/att/a1').set({ st: QM.TS() });
    await resumeTest(false);
  }
  async function resumeTest(autoSubmit) {
    const a1 = (await ref('subs/' + S.uid + '/att/a1').once('value')).val();
    if (!a1) throw new Error('Chưa bắt đầu được bài, hãy thử lại.');
    S.st = a1.st; S.ans = Object.assign({}, a1.a || {});
    try { Object.assign(S.ans, JSON.parse(localStorage.getItem('qm_ans_' + S.code + S.uid) || '{}')); } catch (e) { }
    if (autoSubmit) { await submitTest(true); return; }
    // thứ tự câu hỏi (giữ nguyên khi tải lại trang)
    let ord = null; try { ord = JSON.parse(localStorage.getItem('qm_ord_' + S.code + S.uid) || 'null'); } catch (e) { }
    if (!ord || ord.length !== S.qs.length) { ord = S.qs.map((q, i) => i); if (S.meta.shuffle) ord = QM.shuffle(ord); try { localStorage.setItem('qm_ord_' + S.code + S.uid, JSON.stringify(ord)); } catch (e) { } }
    S.order = ord; S.submitted = false;
    $('te-title').textContent = S.meta.title; $('te-total').textContent = S.qs.length;
    $('te-list').innerHTML = S.order.map((i, n) => {
      const q = S.qs[i];
      if (q.t === 'tf') return `<div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3" data-q="${i}"><p class="font-bold text-sm whitespace-pre-line"><span class="text-amber-300 text-[11px] mr-1">[Đúng/Sai]</span>Câu ${n + 1}. ${esc(q.q)}</p>${q.s.map((t, j) => `<div class="p-2.5 rounded-xl border border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-2"><span class="text-sm flex-1 min-w-[200px]"><b>${YL[j]})</b> ${esc(t)}</span><span class="flex gap-2"><button class="tfb" data-qi="${i}" data-j="${j}" data-v="T">Đúng</button><button class="tfb" data-qi="${i}" data-j="${j}" data-v="F">Sai</button></span></div>`).join('')}</div>`;
      return `<div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2" data-q="${i}"><p class="font-bold text-sm whitespace-pre-line">Câu ${n + 1}. ${esc(q.q)}</p>${q.o.map((o, j) => `<button class="opt" data-qi="${i}" data-o="${j}"><b>${L[j]}.</b> ${esc(o)}</button>`).join('')}</div>`;
    }).join('');
    paintTest(); show('test');
    $('hd-timer').classList.remove('hidden'); $('hd-timer').classList.add('flex');
    startTimer();
  }
  function paintTest() {
    let done = 0;
    S.qs.forEach((q, i) => {
      const a = S.ans['q' + i], box = document.querySelector(`#te-list [data-q="${i}"]`); if (!box) return;
      if (q.t === 'tf') {
        const str = typeof a === 'string' ? a : '----'; if (/[TF]/.test(str) && !str.includes('-')) done++;
        box.querySelectorAll('.tfb').forEach(b => b.classList.toggle('sel', str.charAt(+b.dataset.j) === b.dataset.v));
      } else { if (a !== undefined) done++; box.querySelectorAll('.opt').forEach(b => b.classList.toggle('sel', parseInt(b.dataset.o, 10) === a)); }
    });
    $('te-done').textContent = done; return done;
  }
  $('te-list').addEventListener('click', e => {
    if (S.submitted) return;
    const ob = e.target.closest('.opt'), tb = e.target.closest('.tfb');
    if (ob) S.ans['q' + ob.dataset.qi] = parseInt(ob.dataset.o, 10);
    else if (tb) { const key = 'q' + tb.dataset.qi, cur = (typeof S.ans[key] === 'string' ? S.ans[key] : '----').split(''); cur[+tb.dataset.j] = tb.dataset.v; S.ans[key] = cur.join(''); }
    else return;
    paintTest(); scheduleSave();
  });
  function scheduleSave() {
    try { localStorage.setItem('qm_ans_' + S.code + S.uid, JSON.stringify(S.ans)); } catch (e) { }
    clearTimeout(S.saveT);
    S.saveT = setTimeout(() => { if (S.submitted || !Object.keys(S.ans).length) return; ref('subs/' + S.uid + '/att/a1/a').set(S.ans).catch(() => { }); }, 1200);
  }
  function startTimer() {
    clearInterval(S.timer);
    const tick = () => {
      const left = Math.max(0, S.meta.timeLimit * 60 - (S.fb.now() - S.st) / 1000);
      const m = Math.floor(left / 60), s = Math.floor(left % 60);
      $('timer-text').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      $('timer-text').className = 'font-mono font-black text-lg ' + (left <= 60 ? 'text-rose-400 animate-pulse' : 'text-yellow-300');
      if (left <= 0) { clearInterval(S.timer); QM.toast('Hết giờ! Hệ thống đang nộp bài của em...', 'info'); submitTest(true); }
    };
    tick(); S.timer = setInterval(tick, 1000);
  }
  async function submitTest(auto) {
    if (S.submitted || S.busy2) return;
    if (!auto) {
      const left = S.qs.length - paintTest();
      if (!confirm(left > 0 ? `Em còn ${left} câu chưa làm xong. Vẫn nộp bài?` : 'Nộp bài ngay bây giờ?')) return;
    }
    S.busy2 = true; clearTimeout(S.saveT); clearInterval(S.timer);
    try {
      const upd = { sub: QM.TS() }; if (Object.keys(S.ans).length) upd.a = S.ans;
      await ref('subs/' + S.uid + '/att/a1').update(upd);
      S.submitted = true; try { localStorage.removeItem('qm_ans_' + S.code + S.uid); localStorage.removeItem('qm_ord_' + S.code + S.uid); } catch (e) { }
      await loadKey(); showTestResult(S.ans);
    } catch (e) {
      QM.toast('Chưa nộp được bài: ' + QM.fbError(e) + ' — em kiểm tra mạng rồi bấm Nộp bài lại. Bài làm vẫn được lưu.', 'error');
      if (auto) { S.timer = null; }
    } finally { S.busy2 = false; }
  }
  $('btn-submit').onclick = () => submitTest(false); $('btn-submit2').onclick = () => submitTest(false);

  async function openResultFromSaved() {
    const a1 = (await ref('subs/' + S.uid + '/att/a1').once('value')).val() || {};
    S.submitted = true; showTestResult(a1.a || {}, a1);
  }
  function showTestResult(ans, att) {
    const r = QM.scoreAssign(S.qs, S.key, ans, {}), full = S.meta.reveal !== 'score';
    $('rs-icon').textContent = r.score10 >= 8 ? '🏆' : r.score10 >= 5 ? '👍' : '💪';
    $('rs-title').textContent = 'Em đã nộp bài!'; $('rs-score').textContent = fmt(r.score10) + ' / 10';
    $('rs-detail').textContent = `Đúng hoàn toàn ${r.nOk}/${S.qs.length} câu`;
    $('rs-note').textContent = full ? 'Điểm tính theo thang 10 (câu đúng/sai tính điểm từng phần). Điểm chính thức do thầy cô xác nhận.' : 'Thầy cô chọn không hiển thị đáp án. Điểm chính thức do thầy cô xác nhận.';
    $('btn-again').classList.add('hidden');
    $('rs-review').innerHTML = full ? '<h3 class="font-bold text-sm text-purple-300">Đáp án và giải thích</h3>' + S.qs.map((q, i) => reviewHtml(i, q, S.key[i] || {}, ans['q' + i], i + 1)).join('') : '';
    show('result'); QM.sound.cheer();
  }

  $('btn-home').onclick = () => { clearInterval(S.timer); show('entry'); };
  $('in-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
  $('in-code').addEventListener('keydown', e => { if (e.key === 'Enter') enter(); });
  $('btn-enter').onclick = enter;
  window.addEventListener('beforeunload', e => { if (S.timer && !S.submitted && isTest()) { e.preventDefault(); e.returnValue = ''; } });

  (function init() {
    if (!QM.firebaseReady()) { show('noconfig'); return; }
    S.fb = QM.initFirebase('practice', 'local');
    show('entry');
    const q = new URLSearchParams(location.search).get('code');
    if (q) { $('in-code').value = q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); enter(); }
  })();
})();
