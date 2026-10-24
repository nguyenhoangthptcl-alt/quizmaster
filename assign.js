/* Giao bài luyện tập / kiểm tra ở nhà: tạo bài, danh sách, kết quả */
(function () {
  const $ = id => document.getElementById(id);
  const esc = QM.escapeHtml;
  const app = () => window.QMApp;
  const A = { inited: false, list: {}, cur: null, rows: [], meta: null };
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const isTf = q => q && q.type === 'tf';
  const pageUrl = code => { const u = new URL('luyentap.html', location.href); u.search = ''; u.hash = ''; u.searchParams.set('code', code); return u.href; };

  /* ---------- Nguồn câu hỏi ---------- */
  let sources = [];
  function refreshSources() {
    const a = app(); sources = [{ id: 'cur', label: '📝 Bộ đề đang soạn ở tab Tạo đề', quiz: a.getQuiz() }];
    a.getLibrary().forEach(q => sources.push({ id: q.key, label: `${q.title} (${q.count || (q.questions || []).length} câu)`, quiz: q }));
    const cur = $('as-src').value;
    $('as-src').innerHTML = sources.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
    if (sources.some(s => s.id === cur)) $('as-src').value = cur;
    onSrc();
  }
  const counts = quiz => { const qs = (quiz && quiz.questions) || []; const tf = qs.filter(isTf).length; return { mcq: qs.length - tf, tf }; };
  function onSrc() {
    const s = sources.find(x => x.id === $('as-src').value) || sources[0]; if (!s) return;
    const c = counts(s.quiz);
    $('as-src-info').textContent = `Có ${c.mcq} câu nhiều lựa chọn và ${c.tf} câu đúng/sai.`;
    $('as-n-mcq').value = c.mcq; $('as-n-tf').value = c.tf;
    $('as-t-mcq').checked = c.mcq > 0; $('as-t-tf').checked = c.tf > 0;
    if (!$('as-title').dataset.edited) $('as-title').value = s.quiz.title || '';
  }
  $('as-src').addEventListener('change', () => { $('as-title').dataset.edited = ''; onSrc(); });
  $('as-title').addEventListener('input', () => { $('as-title').dataset.edited = '1'; });
  document.querySelectorAll('input[name="as-mode"]').forEach(r => r.addEventListener('change', () => {
    $('as-test-opts').classList.toggle('hidden', document.querySelector('input[name="as-mode"]:checked').value !== 'test');
  }));

  /* ---------- Tạo bài giao ---------- */
  const sample = (arr, n) => QM.shuffle(arr).slice(0, Math.max(0, n));
  async function create() {
    const a = app(), s = sources.find(x => x.id === $('as-src').value);
    if (!s) return;
    const title = $('as-title').value.trim(); if (!title) return QM.toast('Hãy nhập tên bài giao.', 'error');
    const all = s.quiz.questions || [];
    const mcq = $('as-t-mcq').checked ? sample(all.filter(q => !isTf(q)), parseInt($('as-n-mcq').value, 10) || 0) : [];
    const tf = $('as-t-tf').checked ? sample(all.filter(isTf), parseInt($('as-n-tf').value, 10) || 0) : [];
    if (!mcq.length && !tf.length) return QM.toast('Bài giao chưa có câu hỏi nào. Kiểm tra loại câu hỏi và số câu.', 'error');
    const mode = document.querySelector('input[name="as-mode"]:checked').value;
    const tl = mode === 'test' ? Math.max(1, parseInt($('as-time').value, 10) || 30) : 0;
    const ts = v => { const t = v ? new Date(v).getTime() : 0; return isFinite(t) ? t : 0; };
    const openAt = mode === 'test' ? ts($('as-open').value) : 0, closeAt = mode === 'test' ? ts($('as-close').value) : 0;
    if (openAt && closeAt && closeAt <= openAt) return QM.toast('Thời điểm đóng phải sau thời điểm mở.', 'error');
    const qs = [], key = [];
    mcq.forEach(q => { qs.push({ t: 'mcq', q: q.question, o: q.options.slice(0, 4) }); key.push({ a: q.answer, e: q.explanation || '' }); });
    tf.forEach(q => { qs.push({ t: 'tf', q: q.question, s: q.statements.map(x => x.text) }); key.push({ a: q.statements.map(x => !!x.answer), e: q.statements.map(x => x.explanation || '') }); });
    const u = a.user(), db = a.db();
    $('as-create').disabled = true; $('as-msg').textContent = 'Đang tạo...';
    try {
      let code = null;
      for (let i = 0; i < 12 && !code; i++) {
        const c = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
        if ((await db.ref(`assign/${c}/meta`).once('value')).exists()) continue;
        try {
          await db.ref(`assign/${c}/meta`).set({ ownerUid: u.uid, ownerUsername: u.username, ownerName: u.displayName || u.username, title, subject: s.quiz.subject || '', grade: s.quiz.grade || '', mode, timeLimit: tl, openAt, closeAt, attempts: mode === 'test' ? 1 : 0, status: 'open', shuffle: $('as-shuffle').checked, reveal: $('as-reveal').value, nMcq: mcq.length, nTf: tf.length, createdAt: QM.TS() });
          code = c;
        } catch (e) { if (i === 11) throw e; }
      }
      if (!code) throw new Error('Không tạo được mã bài, thử lại.');
      await db.ref(`assign/${code}/q`).set(qs);
      await db.ref(`assign/${code}/key`).set(key);
      await db.ref(`userAssign/${u.username}/${code}`).set({ title, mode, status: 'open', n: qs.length, createdAt: QM.TS() });
      $('as-link').value = pageUrl(code); $('as-code').textContent = code; $('as-created').classList.remove('hidden');
      QM.toast('Đã tạo bài giao, mã ' + code, 'success'); QM.sound.cheer();
    } catch (e) { QM.toast('Không tạo được: ' + QM.fbError(e), 'error'); }
    finally { $('as-create').disabled = false; $('as-msg').textContent = ''; }
  }
  $('as-create').onclick = create;
  $('as-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('as-link').value); QM.toast('Đã chép link bài giao.', 'success'); };

  /* ---------- Danh sách ---------- */
  function renderList() {
    const items = Object.entries(A.list).map(([code, v]) => ({ code, ...v })).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
    $('as-count').textContent = items.length + ' bài';
    $('as-list').innerHTML = items.length ? items.map(it => `
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div><div class="font-bold text-white text-sm">${esc(it.title)}</div>
          <div class="text-xs text-slate-400"><span class="px-1.5 py-0.5 rounded ${it.mode === 'test' ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}">${it.mode === 'test' ? 'Kiểm tra' : 'Tự luyện'}</span>
            • ${it.n || '?'} câu • Mã <b class="font-mono text-yellow-300">${esc(it.code)}</b> • ${it.status === 'closed' ? '<span class="text-rose-300">Đã đóng</span>' : '<span class="text-emerald-300">Đang mở</span>'} • ${it.createdAt ? new Date(it.createdAt).toLocaleString('vi-VN') : ''}</div></div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-g" data-as="link" data-c="${esc(it.code)}">🔗 Chép link</button>
          <button class="btn btn-p" data-as="res" data-c="${esc(it.code)}">📊 Kết quả</button>
          <button class="btn btn-g" data-as="toggle" data-c="${esc(it.code)}">${it.status === 'closed' ? '▶️ Mở lại' : '⏸ Đóng bài'}</button>
          <button class="btn btn-r" data-as="del" data-c="${esc(it.code)}">🗑</button>
        </div></div>`).join('') : '<div class="text-sm text-slate-500 italic">Chưa giao bài nào.</div>';
  }
  $('as-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-as]'); if (!b) return;
    const code = b.dataset.c, a = app(), db = a.db(), u = a.user(), it = A.list[code]; if (!it) return;
    try {
      if (b.dataset.as === 'link') { navigator.clipboard && navigator.clipboard.writeText(pageUrl(code)); QM.toast('Đã chép link: ' + pageUrl(code), 'success'); }
      else if (b.dataset.as === 'res') showResults(code);
      else if (b.dataset.as === 'toggle') {
        const st = it.status === 'closed' ? 'open' : 'closed';
        await db.ref(`assign/${code}/meta/status`).set(st); await db.ref(`userAssign/${u.username}/${code}/status`).set(st);
        QM.toast(st === 'closed' ? 'Đã đóng bài: học sinh không bắt đầu làm mới được.' : 'Đã mở lại bài.', 'info');
      } else if (b.dataset.as === 'del') {
        if (!confirm(`Xóa bài giao “${it.title}” cùng toàn bộ kết quả của học sinh?`)) return;
        await db.ref(`assign/${code}`).remove(); await db.ref(`userAssign/${u.username}/${code}`).remove();
        if (A.cur === code) $('as-res-card').classList.add('hidden');
        QM.toast('Đã xóa bài giao.', 'success');
      }
    } catch (x) { QM.toast(QM.fbError(x), 'error'); }
  });

  /* ---------- Kết quả ---------- */
  async function showResults(code) {
    const db = app().db(); A.cur = code;
    $('as-res-card').classList.remove('hidden'); $('as-res-title').textContent = 'Đang tải kết quả...';
    try {
      const [m, q, k, s] = await Promise.all(['meta', 'q', 'key', 'subs'].map(n => db.ref(`assign/${code}/${n}`).once('value')));
      const meta = m.val() || {}, qs = QM.arr(q.val()), key = QM.arr(k.val()), subs = s.val() || {};
      A.meta = meta; const test = meta.mode === 'test', tl = (meta.timeLimit || 0) * 60 * 1000;
      const rows = []; const itemStat = qs.map(() => ({ n: 0, sum: 0 }));
      Object.keys(subs).forEach(uid => {
        const si = subs[uid], atts = Object.keys(si.att || {}).sort((x, y) => parseInt(x.slice(1), 10) - parseInt(y.slice(1), 10)).map(n => ({ n, ...si.att[n] }));
        if (!atts.length) return;
        const scored = atts.map(at => ({ at, r: QM.scoreAssign(qs, key, at.a || {}, { onlyAnswered: !test }) })).filter(x => test || x.r.max > 0);
        if (!scored.length) return;
        const best = scored.reduce((p, c) => c.r.score10 > p.r.score10 ? c : p, scored[0]);
        const used = test ? scored[0] : best;
        const dur = used.at.sub && used.at.st ? (used.at.sub - used.at.st) / 60000 : null;
        let note = '';
        if (test) {
          if (!used.at.sub) note = 'Chưa nộp (tính theo phần đã lưu)';
          else if (tl && used.at.sub - used.at.st > tl + 45000) note = 'Nộp quá giờ';
        }
        rows.push({ uid, name: si.name || '(chưa nhập tên)', cls: si.cls || '', attempts: atts.length, score: used.r.score10, dur, last: used.at.sub || used.at.st, note });
        used.r.detail.forEach((d, i) => { if (!d) return; itemStat[i].n++; itemStat[i].sum += d.type === 'tf' ? d.f : (d.ok ? 1 : 0); });
      });
      rows.sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
      A.rows = rows;
      $('as-res-title').textContent = `Kết quả: ${meta.title || code} (${test ? 'kiểm tra' : 'tự luyện'}, mã ${code})`;
      const sc = rows.map(r => r.score), avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 0;
      const card = (l, v) => `<div class="rounded-xl bg-slate-900 border border-slate-800 p-2"><div class="text-slate-400">${l}</div><div class="text-lg font-black text-white">${v}</div></div>`;
      $('as-res-sum').innerHTML = card('Số học sinh', rows.length) + card('Điểm trung bình', sc.length ? fmt(avg) : '-') + card('Cao nhất', sc.length ? fmt(Math.max(...sc)) : '-') + card('Thấp nhất', sc.length ? fmt(Math.min(...sc)) : '-') + card('Từ 5 điểm trở lên', sc.length ? Math.round(sc.filter(x => x >= 5).length / sc.length * 100) + '%' : '-');
      $('as-res-table').querySelector('thead').innerHTML = `<tr><th>#</th><th>Họ tên</th><th>Lớp</th><th>${test ? 'Điểm' : 'Điểm tốt nhất'}</th><th>Số lần làm</th><th>${test ? 'Thời gian (phút)' : 'Lần cuối'}</th><th>Ghi chú</th></tr>`;
      $('as-res-table').querySelector('tbody').innerHTML = rows.length ? rows.map((r, i) => `<tr><td>${i + 1}</td><td class="font-bold">${esc(r.name)}</td><td>${esc(r.cls)}</td><td class="font-mono font-bold text-yellow-300">${fmt(r.score)}</td><td>${r.attempts}</td><td>${test ? (r.dur === null ? '-' : fmt(r.dur)) : (r.last ? new Date(r.last).toLocaleString('vi-VN') : '')}</td><td class="${r.note ? 'text-amber-300' : ''}">${esc(r.note)}</td></tr>`).join('') : '<tr><td colspan="7" class="text-slate-500 italic">Chưa có học sinh nào làm bài.</td></tr>';
      $('as-res-items').innerHTML = qs.map((q, i) => {
        const st = itemStat[i], p = st.n ? Math.round(st.sum / st.n * 100) : 0;
        return `<div class="flex items-center gap-2"><span class="w-14 shrink-0 text-slate-400">Câu ${i + 1}${q.t === 'tf' ? ' (Đ/S)' : ''}</span><div class="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden"><div class="h-full ${p < 40 ? 'bg-rose-500' : p < 70 ? 'bg-amber-400' : 'bg-emerald-500'}" style="width:${p}%"></div></div><span class="w-10 text-right font-mono">${st.n ? p + '%' : '-'}</span></div>`;
      }).join('');
    } catch (e) { $('as-res-title').textContent = 'Không tải được kết quả'; QM.toast(QM.fbError(e), 'error'); }
  }
  $('as-res-refresh').onclick = () => A.cur && showResults(A.cur);
  $('as-res-close').onclick = () => $('as-res-card').classList.add('hidden');
  $('as-res-csv').onclick = () => {
    if (!A.rows.length) return QM.toast('Chưa có dữ liệu.', 'error');
    const rows = [['STT', 'Họ tên', 'Lớp', 'Điểm', 'Số lần làm', 'Thời gian (phút)', 'Ghi chú']];
    A.rows.forEach((r, i) => rows.push([i + 1, r.name, r.cls, String(r.score).replace('.', ','), r.attempts, r.dur === null ? '' : fmt(r.dur), r.note]));
    const csv = '\ufeff' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'bang-diem-' + A.cur + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  function init() {
    if (A.inited) return; A.inited = true;
    const a = app();
    a.db().ref('userAssign/' + a.user().username).on('value', s => { A.list = s.val() || {}; renderList(); }, e => QM.toast(QM.fbError(e), 'error'));
  }
  window.QMAssign = { onShow() { init(); refreshSources(); }, _A: A };
})();
