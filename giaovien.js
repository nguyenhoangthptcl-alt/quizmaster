/* Cổng giáo viên: đăng nhập, tạo đề theo phạm vi, phòng thi, quản lý tài khoản */
(function () {
  const $ = id => document.getElementById(id);
  const esc = QM.escapeHtml;
  const CFG = window.QM_CONFIG;
  const SUBJECTS = ['Công nghệ', 'Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 'Tin học', 'Ngữ văn', 'Lịch sử', 'Địa lý', 'Tiếng Anh', 'Giáo dục KT&PL', 'Khác'];
  const GRADES = ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12', 'Khác'];
  const LETTERS = ['A', 'B', 'C', 'D'];
  const COLORS = [
    { cls: 'from-red-600 to-rose-700 text-white', sym: '▲' }, { cls: 'from-blue-600 to-indigo-700 text-white', sym: '◆' },
    { cls: 'from-amber-500 to-yellow-600 text-slate-900', sym: '●' }, { cls: 'from-emerald-600 to-teal-700 text-white', sym: '■' }
  ];
  const S = {
    fb: null, user: null, registering: false, view: 'create',
    staticBooks: [], dbBooks: [], hidden: {}, parsed: {},        // sách và cache đã phân tích
    geminiKey: '', geminiModel: '',
    quiz: { title: '', subject: 'Công nghệ', grade: 'Lớp 10', questions: [] },
    scope: { mode: 'lesson', lessonId: null, chapterId: null, multi: new Set(), book: null, parsedBook: null, result: null, edited: false },
    room: null, refs: {}
  };
  const db = () => S.fb.db;
  const auth = () => S.fb.auth;

  /* ======================= ĐIỀU HƯỚNG ======================= */
  const SCREENS = ['noconfig', 'auth', 'pending', 'app'];
  function showScreen(n) { SCREENS.forEach(s => $(s === 'app' ? 'app' : 'scr-' + s).classList.toggle('hidden', s !== n)); }
  function setView(v) {
    S.view = v;
    ['create', 'exam', 'assign', 'library', 'room', 'books', 'settings', 'admin'].forEach(x => $('view-' + x).classList.toggle('hidden', x !== v));
    document.querySelectorAll('#main-nav .navtab').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'books') renderBooks();
    if (v === 'admin') loadAdmin();
    if (v === 'room') renderRoomNone();
    if (v === 'exam' && window.QMExam) window.QMExam.onShow();
    if (v === 'assign' && window.QMAssign) window.QMAssign.onShow();
  }
  document.querySelectorAll('#main-nav .navtab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('btn-sound').onclick = () => { QM.sound.isMuted = !QM.sound.isMuted; $('sound-icon').textContent = QM.sound.isMuted ? '🔇' : '🔊'; };

  /* ======================= TÀI KHOẢN ======================= */
  const normUser = u => (u || '').trim().toLowerCase();
  const validUser = u => /^[a-z0-9_]{3,20}$/.test(u);
  const rand = n => Math.random().toString(36).slice(2, 2 + n).padEnd(n, 'x');
  const emailFor = u => `${u}.${rand(6)}@${CFG.usernameDomain}`;
  function authError(msg) { const el = $('auth-error'); el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }

  $('tab-login').onclick = () => switchAuth('login');
  $('tab-register').onclick = () => switchAuth('register');
  function switchAuth(t) {
    $('tab-login').classList.toggle('on', t === 'login'); $('tab-register').classList.toggle('on', t === 'register');
    $('form-login').classList.toggle('hidden', t !== 'login'); $('form-register').classList.toggle('hidden', t !== 'register');
    authError('');
  }

  $('form-login').addEventListener('submit', async e => {
    e.preventDefault(); authError('');
    const u = normUser($('lg-user').value), p = $('lg-pass').value;
    if (!u || !p) return authError('Nhập tên đăng nhập và mật khẩu.');
    const btn = $('btn-login'); btn.disabled = true; btn.textContent = 'Đang đăng nhập...';
    try {
      const m = await db().ref('usernames/' + u).once('value');
      if (!m.exists()) throw { code: 'auth/invalid-credential' };
      await auth().signInWithEmailAndPassword(m.val().email, p);
    } catch (err) { authError(QM.fbError(err)); }
    finally { btn.disabled = false; btn.textContent = 'Đăng nhập'; }
  });

  $('form-register').addEventListener('submit', async e => {
    e.preventDefault(); authError('');
    const display = $('rg-display').value.trim(), u = normUser($('rg-user').value), p = $('rg-pass').value;
    if (!display) return authError('Nhập họ tên hiển thị.');
    if (!validUser(u)) return authError('Tên đăng nhập: 3-20 ký tự, chỉ gồm chữ thường a-z, số và dấu gạch dưới (_).');
    if (p.length < 6) return authError('Mật khẩu tối thiểu 6 ký tự.');
    if (p !== $('rg-pass2').value) return authError('Hai mật khẩu chưa khớp.');
    const btn = $('btn-register'); btn.disabled = true; btn.textContent = 'Đang tạo...';
    S.registering = true;
    let cred = null;
    try {
      if ((await db().ref('usernames/' + u).once('value')).exists()) throw { code: 'auth/email-already-in-use' };
      const email = emailFor(u);
      cred = await auth().createUserWithEmailAndPassword(email, p);
      const uid = cred.user.uid;
      const base = { username: u, displayName: display, createdAt: QM.TS() };
      let created = false;
      try { await db().ref('users/' + uid).set({ ...base, role: 'admin', status: 'active' }); created = true; } catch (x) { /* đã có người dùng -> đăng ký thường */ }
      if (!created) {
        let auto = false;
        try { auto = (await db().ref('settings/autoApprove').once('value')).val() === true; } catch (x) { }
        await db().ref('users/' + uid).set({ ...base, role: 'teacher', status: auto ? 'active' : 'pending' });
      }
      try { await db().ref('usernames/' + u).set({ email, uid }); }
      catch (x) { try { await cred.user.delete(); } catch (y) { await auth().signOut(); } throw { code: 'auth/email-already-in-use' }; }
      S.registering = false;
      await handleUser(auth().currentUser);
    } catch (err) { S.registering = false; authError(QM.fbError(err)); }
    finally { btn.disabled = false; btn.textContent = 'Tạo tài khoản'; S.registering = false; }
  });

  async function handleUser(fbUser) {
    if (S.registering) return;
    if (!fbUser) { S.user = null; stopAll(); $('main-nav').classList.add('hidden'); $('user-chip').classList.add('hidden'); showScreen('auth'); return; }
    let prof = null;
    try { prof = (await db().ref('users/' + fbUser.uid).once('value')).val(); } catch (e) { authError(QM.fbError(e)); }
    if (!prof) { authError('Tài khoản chưa có hồ sơ hoặc đã bị Admin xóa.'); await auth().signOut(); return; }
    S.user = { uid: fbUser.uid, email: fbUser.email, ...prof };
    $('user-chip').classList.remove('hidden'); $('user-chip').classList.add('flex');
    $('chip-name').textContent = prof.displayName || prof.username;
    $('chip-role').textContent = (prof.role === 'admin' ? 'Admin' : 'Giáo viên') + ' • @' + prof.username;
    if (prof.status !== 'active') {
      $('main-nav').classList.add('hidden');
      const locked = prof.status === 'locked';
      $('pending-icon').textContent = locked ? '🔒' : '⏳';
      $('pending-title').textContent = locked ? 'Tài khoản đã bị khóa' : 'Tài khoản đang chờ Admin duyệt';
      $('pending-text').textContent = locked ? 'Vui lòng liên hệ Admin để được mở khóa.' : 'Khi Admin duyệt, thầy/cô bấm “Kiểm tra lại” để vào hệ thống.';
      $('btn-recheck').classList.toggle('hidden', locked);
      showScreen('pending'); return;
    }
    enterApp();
  }
  $('btn-recheck').onclick = () => handleUser(auth().currentUser);
  async function logout() { stopAll(); await auth().signOut(); }
  $('btn-logout').onclick = logout;
  document.querySelectorAll('.btn-logout2').forEach(b => b.onclick = logout);
  const isAdmin = () => S.user && S.user.role === 'admin';

  function stopAll() {
    Object.values(S.refs).forEach(r => { try { r.off(); } catch (e) { } }); S.refs = {};
    if (S.room) { S.room.refs.forEach(r => r.off()); clearInterval(S.room.timer); S.room = null; }
  }

  /* ======================= VÀO ỨNG DỤNG ======================= */
  async function enterApp() {
    showScreen('app');
    $('main-nav').classList.remove('hidden'); $('main-nav').classList.add('flex');
    $('nav-admin').classList.toggle('hidden', !isAdmin());
    fillSelect($('ai-subject'), SUBJECTS, localStorage.getItem('qm_subj') || 'Công nghệ');
    fillSelect($('ai-grade'), GRADES, localStorage.getItem('qm_grade') || 'Lớp 10');
    fillSelect($('mb-subject'), SUBJECTS); fillSelect($('mb-grade'), GRADES);
    await Promise.all([loadStaticBooks(), loadPrivate()]);
    // Tài liệu dùng chung & thư viện đề
    S.refs.curr = db().ref('curriculum');
    S.refs.curr.on('value', snap => {
      S.dbBooks = [];
      snap.forEach(ch => { const v = ch.val(); if (v && v.text) S.dbBooks.push({ id: 'db_' + ch.key, key: ch.key, source: 'db', ...v }); });
      refreshBookSelect(true); if (S.view === 'books') renderBooks();
    }, e => QM.toast('Không đọc được thư viện tài liệu: ' + QM.fbError(e), 'error'));
    S.refs.hid = db().ref('settings/hiddenBooks');
    S.refs.hid.on('value', snap => { S.hidden = snap.val() || {}; refreshBookSelect(true); if (S.view === 'books') renderBooks(); }, () => { });
    S.refs.quizzes = db().ref('quizzes/' + S.user.username);
    S.refs.quizzes.on('value', snap => renderLibrary(snap), () => { });
    refreshBookSelect();
    renderQuestions();
    setView('create');
    checkResumeRoom();
  }
  function fillSelect(sel, arr, val) {
    sel.innerHTML = arr.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    if (val && arr.includes(val)) sel.value = val;
  }
  async function loadPrivate() {
    try {
      const v = (await db().ref('private/' + S.user.username).once('value')).val() || {};
      S.geminiKey = v.geminiKey || ''; S.geminiModel = v.geminiModel || '';
    } catch (e) { }
    $('st-key').value = S.geminiKey; $('st-model').value = S.geminiModel; updateAiBadge();
  }
  function updateAiBadge() {
    const b = $('ai-badge');
    b.textContent = S.geminiKey ? 'AI: Gemini đã sẵn sàng' : 'AI: chưa có API key (vào Cài đặt)';
    b.className = 'text-[11px] px-2 py-0.5 rounded border ' + (S.geminiKey ? 'border-emerald-700 text-emerald-300' : 'border-amber-700 text-amber-300');
  }

  /* ======================= SÁCH / TÀI LIỆU ======================= */
  async function loadStaticBooks() {
    try { const j = await (await fetch('sgk/index.json', { cache: 'no-cache' })).json(); S.staticBooks = (j.books || []).map(b => ({ ...b, source: 'file' })); }
    catch (e) { S.staticBooks = []; }
  }
  const allBooks = () => {
    const rep = new Set(S.dbBooks.map(b => b.replaces).filter(Boolean));
    return [...S.staticBooks.filter(b => !(S.hidden || {})[b.id] && !rep.has(b.id)), ...S.dbBooks];
  };
  const verOf = b => b ? b.id + ':' + (b.updatedAt || b.createdAt || 0) + ':' + (b.text ? b.text.length : 0) : '';
  async function getParsed(b) {
    const ver = verOf(b);
    if (S.parsed[ver]) return S.parsed[ver];
    let text, supplement = null;
    if (b.source === 'file') {
      const r = await fetch('sgk/' + b.file); if (!r.ok) throw new Error('Không tải được sgk/' + b.file);
      text = await r.text();
      if (b.supplement) { try { supplement = (await (await fetch('sgk/' + b.supplement)).json())[b.file] || null; } catch (e) { } }
    } else text = b.text;
    const parsed = SGK.parseBook(text);
    return (S.parsed[ver] = { parsed, supplement, book: b });
  }
  async function getBank(b) {
    if (b.source !== 'file' || !b.bank) return [];
    try { return (await (await fetch('sgk/' + b.bank)).json())[b.file] || []; } catch (e) { return []; }
  }

  $('ai-subject').addEventListener('change', () => { localStorage.setItem('qm_subj', $('ai-subject').value); refreshBookSelect(); });
  $('ai-grade').addEventListener('change', () => { localStorage.setItem('qm_grade', $('ai-grade').value); refreshBookSelect(); });
  $('ai-book').addEventListener('change', onBookChange);

  function refreshBookSelect(keep) {
    const subj = $('ai-subject').value, grade = $('ai-grade').value, prev = $('ai-book').value;
    const list = allBooks().filter(b => b.subject === subj && b.grade === grade);
    $('ai-book').innerHTML = list.map(b => `<option value="${esc(b.id)}">${esc(b.title)}${b.source === 'db' ? ' (thư viện chung)' : ''}</option>`).join('');
    if (keep && list.some(b => b.id === prev)) { $('ai-book').value = prev; const cur = list.find(b => b.id === prev); if (S.scope.book && S.scope.book.id === prev && verOf(S.scope.book) === verOf(cur)) { return; } }
    $('book-none').classList.toggle('hidden', list.length > 0);
    $('bn-subject').textContent = subj; $('bn-grade').textContent = grade;
    $('ai-book').classList.toggle('hidden', list.length === 0);
    onBookChange();
  }

  async function onBookChange() {
    const b = allBooks().find(x => x.id === $('ai-book').value) || null;
    const sc = S.scope; sc.book = b; sc.parsedBook = null;
    if (!b) { sc.mode = 'free'; applyMode(); return; }
    try { const p = await getParsed(b); if (sc.book !== b) return; sc.parsedBook = p; }
    catch (e) { QM.toast(e.message, 'error'); sc.mode = 'free'; applyMode(); return; }
    if (sc.mode === 'free' && !sc.userFree) sc.mode = 'lesson';
    fillScopeControls(); applyMode();
  }

  function fillScopeControls() {
    const pb = S.scope.parsedBook.parsed, sc = S.scope;
    $('sel-lesson').innerHTML = pb.chapters.map(c =>
      `<optgroup label="${esc(SGK.chapterLabel(c))}">${c.lessonIds.map(id => { const l = pb.lessons.find(x => x.id === id); return `<option value="${esc(id)}">${esc(SGK.lessonLabel(l))}</option>`; }).join('')}</optgroup>`).join('');
    $('sel-chapter').innerHTML = pb.chapters.map(c => `<option value="${esc(c.id)}">${esc(SGK.chapterLabel(c))} (${c.lessonIds.length} bài)</option>`).join('');
    if (!pb.lessons.some(l => l.id === sc.lessonId)) sc.lessonId = pb.lessons[0] && pb.lessons[0].id;
    if (!pb.chapters.some(c => c.id === sc.chapterId)) sc.chapterId = pb.chapters[0] && pb.chapters[0].id;
    sc.multi = new Set([...sc.multi].filter(id => pb.lessons.some(l => l.id === id)));
    $('sel-lesson').value = sc.lessonId; $('sel-chapter').value = sc.chapterId;
    $('multi-box').innerHTML = pb.chapters.map(c => `
      <div class="rounded-lg border border-slate-800 p-2">
        <label class="flex items-center gap-2 font-bold text-purple-200 cursor-pointer"><input type="checkbox" class="accent-purple-500 mc" data-ch="${esc(c.id)}"> ${esc(SGK.chapterLabel(c))}</label>
        <div class="pl-5 mt-1 space-y-0.5">${c.lessonIds.map(id => { const l = pb.lessons.find(x => x.id === id); return `<label class="flex items-start gap-2 cursor-pointer text-slate-300"><input type="checkbox" class="accent-purple-500 ml mt-0.5" data-l="${esc(id)}" data-ch="${esc(c.id)}" ${sc.multi.has(id) ? 'checked' : ''}> <span>${esc(SGK.lessonLabel(l))}</span></label>`; }).join('')}</div>
      </div>`).join('');
    syncChapterChecks();
  }
  function syncChapterChecks() {
    document.querySelectorAll('#multi-box .mc').forEach(cb => {
      const ls = [...document.querySelectorAll(`#multi-box .ml[data-ch="${cb.dataset.ch}"]`)];
      cb.checked = ls.length > 0 && ls.every(x => x.checked);
      cb.indeterminate = !cb.checked && ls.some(x => x.checked);
    });
  }
  $('multi-box').addEventListener('change', e => {
    const t = e.target;
    if (t.classList.contains('mc')) document.querySelectorAll(`#multi-box .ml[data-ch="${t.dataset.ch}"]`).forEach(x => { x.checked = t.checked; });
    S.scope.multi = new Set([...document.querySelectorAll('#multi-box .ml:checked')].map(x => x.dataset.l));
    syncChapterChecks(); computeScope();
  });
  $('multi-all').onclick = () => { document.querySelectorAll('#multi-box .ml').forEach(x => x.checked = true); S.scope.multi = new Set([...document.querySelectorAll('#multi-box .ml')].map(x => x.dataset.l)); syncChapterChecks(); computeScope(); };
  $('multi-none').onclick = () => { document.querySelectorAll('#multi-box .ml').forEach(x => x.checked = false); S.scope.multi = new Set(); syncChapterChecks(); computeScope(); };
  $('sel-lesson').addEventListener('change', e => { S.scope.lessonId = e.target.value; computeScope(); });
  $('sel-chapter').addEventListener('change', e => { S.scope.chapterId = e.target.value; computeScope(); });
  $('mode-pills').addEventListener('click', e => {
    const p = e.target.closest('.mode-pill'); if (!p || p.classList.contains('off')) return;
    S.scope.mode = p.dataset.mode; S.scope.userFree = p.dataset.mode === 'free'; applyMode();
  });
  $('btn-add-book-here').onclick = () => { const sj = $('ai-subject').value, gr = $('ai-grade').value; openBookModal(null); $('mb-subject').value = sj; $('mb-grade').value = gr; };

  function applyMode() {
    const sc = S.scope, has = !!sc.parsedBook;
    document.querySelectorAll('#mode-pills .mode-pill').forEach(p => {
      p.classList.toggle('on', p.dataset.mode === sc.mode);
      p.classList.toggle('off', p.dataset.mode !== 'free' && !has);
    });
    $('scope-lesson').classList.toggle('hidden', sc.mode !== 'lesson');
    $('scope-chapter').classList.toggle('hidden', sc.mode !== 'chapter');
    $('scope-multi').classList.toggle('hidden', sc.mode !== 'multi');
    computeScope();
  }

  let topicEdited = false;
  $('ai-topic').addEventListener('input', () => { topicEdited = true; });
  $('scope-text').addEventListener('input', () => { S.scope.edited = true; $('scope-chars').textContent = '— ' + $('scope-text').value.length + ' ký tự (đã chỉnh sửa)'; });

  function computeScope() {
    const sc = S.scope, p = sc.parsedBook, ta = $('scope-text'), warn = $('scope-warn');
    warn.classList.add('hidden'); warn.textContent = '';
    let label = '', ids = [], res = null;
    if (sc.mode === 'free' || !p) {
      label = 'Nội dung tự nhập';
      $('scope-summary').textContent = '🎯 Phạm vi: toàn bộ nội dung thầy/cô nhập ở khung “Nội dung AI được phép dùng”.';
      $('scope-details').open = true;
      ta.placeholder = 'Dán nội dung bài học / đề cương vào đây. AI sẽ chỉ ra đề từ nội dung này.';
      $('scope-chars').textContent = '— ' + ta.value.length + ' ký tự';
      sc.result = { label, ids: [], res: null };
      if (!topicEdited && !$('ai-topic').value) $('ai-topic').value = '';
      return;
    }
    const pb = p.parsed;
    if (sc.mode === 'lesson') { ids = sc.lessonId ? [sc.lessonId] : []; const l = pb.lessons.find(x => x.id === sc.lessonId); label = l ? SGK.lessonLabel(l) : ''; }
    else if (sc.mode === 'chapter') { const c = pb.chapters.find(x => x.id === sc.chapterId); ids = c ? c.lessonIds.slice() : []; label = c ? SGK.chapterLabel(c) : ''; }
    else if (sc.mode === 'multi') {
      const ls = pb.lessons.filter(l => sc.multi.has(l.id)); ids = ls.map(l => l.id);
      label = ls.length ? (ls.length === 1 ? SGK.lessonLabel(ls[0]) : `${ls.length} bài: ` + ls.map(l => 'Bài ' + l.num).join(', ')) : '';
    } else { ids = pb.lessons.map(l => l.id); label = 'Toàn bộ ' + (sc.book.title || pb.title || 'sách'); }
    res = SGK.buildScope(pb, ids, p.supplement);
    sc.result = { label, ids, res };
    ta.value = res.text; sc.edited = false;
    $('scope-chars').textContent = '— ' + res.chars + ' ký tự';
    $('scope-summary').textContent = ids.length ? `🎯 Phạm vi: ${label} • ${ids.length} bài • ${res.chars} ký tự kiến thức` : '⚠️ Chưa chọn bài nào.';
    $('scope-details').open = false;
    if (!topicEdited || !$('ai-topic').value) { $('ai-topic').value = label; topicEdited = false; }
    const msgs = [];
    if (res.thin.length) msgs.push('Nội dung trong file khá ngắn ở: ' + res.thin.map(l => 'Bài ' + l.num).join(', ') + '. Thầy nên dán thêm nội dung bài học vào khung “Nội dung AI được phép dùng” để câu hỏi phong phú và không lặp ý.');
    if (msgs.length) { warn.textContent = '⚠️ ' + msgs.join(' '); warn.classList.remove('hidden'); }
  }

  /* ======================= SINH ĐỀ BẰNG AI ======================= */
  const clampInt = (v, lo, hi, def) => { const n = parseInt(v, 10); return isNaN(n) ? def : Math.max(lo, Math.min(hi, n)); };
  function currentParams() {
    return {
      subject: $('ai-subject').value, grade: $('ai-grade').value, count: clampInt($('ai-count').value, 0, 60, 10), countTf: clampInt($('ai-count-tf').value, 0, 20, 0),
      diff: $('ai-diff').value, title: $('ai-topic').value.trim(), text: $('scope-text').value.trim(),
      sc: S.scope.result, book: S.scope.book, parsed: S.scope.parsedBook
    };
  }

  function buildPrompt(P, quotas, count, existing) {
    const lessons = P.sc && P.sc.res ? P.sc.res.lessons : [];
    const bookTitle = P.book ? P.book.title : '';
    const lines = [];
    lines.push(`Bạn là giáo viên ${P.subject} ${P.grade}, đang soạn câu hỏi trắc nghiệm cho học sinh.`);
    lines.push(`PHẠM VI KIẾN THỨC: ${P.sc && P.sc.label ? P.sc.label : P.title}${bookTitle ? ' — ' + bookTitle : ''}`);
    lines.push('', 'QUY TẮC BẮT BUỘC:');
    if (P.text) {
      lines.push('1. CHỈ được dùng thông tin nằm trong khối <TAI_LIEU>. Không dùng kiến thức bên ngoài, không thêm số liệu/tiêu chuẩn/công thức không có trong tài liệu, không hỏi về bài hoặc chương khác.');
    } else {
      lines.push(`1. Không có tài liệu kèm theo: hãy ra câu hỏi đúng chuẩn chương trình phổ thông Việt Nam về chủ đề "${P.title}", tuyệt đối chính xác về kiến thức.`);
    }
    if (lessons.length) {
      lines.push('2. Mỗi câu kiểm tra đúng một ý có trong tài liệu và PHẢI có trường "lesson" = số bài (số nguyên) chứa ý đó. Chỉ được dùng các số bài: ' + lessons.map(l => l.num).join(', ') + '.');
      lines.push('3. Số câu theo từng bài (tổng đúng ' + count + ' câu): ' + Object.keys(quotas).map(n => `Bài ${n}: ${quotas[n]} câu`).join('; ') + '. Nếu tài liệu của một bài quá ngắn để ra đủ câu không trùng ý, hãy ra ít câu hơn cho bài đó, KHÔNG bịa thêm.');
    } else lines.push(`2. Tạo đúng ${count} câu hỏi.`);
    lines.push(`4. Mức độ: ${P.diff}.`);
    lines.push('5. Mỗi câu có đúng 4 phương án, chỉ 1 đáp án đúng; phương án sai hợp lí, cùng dạng với đáp án đúng; không dùng "tất cả các đáp án trên". Vị trí đáp án đúng ngẫu nhiên.');
    lines.push(`6. "explanation": 1-2 câu nêu căn cứ trong tài liệu, bắt đầu bằng "[Nguồn: ${bookTitle || P.subject}${lessons.length ? ' - Bài <số bài>' : ''}]". Không ghi số trang.`);
    lines.push('7. Các câu không trùng ý nhau' + (existing && existing.length ? ' và không trùng các câu đã có:\n' + existing.map(q => '   - ' + q).join('\n') : '') + '.');
    lines.push('8. Viết tiếng Việt, dùng đúng thuật ngữ và kí hiệu trong tài liệu.');
    if (P.text) lines.push('', '<TAI_LIEU>', P.text.slice(0, 150000), '</TAI_LIEU>');
    lines.push('', 'Chỉ trả về JSON hợp lệ, không kèm giải thích hay markdown, theo mẫu:',
      '{"questions":[{' + (lessons.length ? '"lesson":5,' : '') + '"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}');
    return lines.join('\n');
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const TRANSIENT = [429, 500, 502, 503, 504];
  // Gọi Gemini. Tự thử lại khi máy chủ quá tải/giới hạn lượt gọi, rồi tự chuyển sang mô hình dự phòng.
  // opts.parts: phần đính kèm (vd PDF inline_data) | opts.onWait(giây, mã lỗi): báo tiến trình chờ
  async function callGemini(prompt, opts) {
    opts = opts || {};
    const EXTRA = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const tried = [], names = [S.geminiModel || CFG.defaultGeminiModel, ...(CFG.geminiFallbackModels || []), ...EXTRA].filter((m, i, a) => m && a.indexOf(m) === i);
    const notify = (secs, status) => {
      if (opts.onWait) opts.onWait(secs, status);
      else QM.toast(status === 429 ? `Đã chạm giới hạn lượt gọi, tự thử lại sau ${secs} giây...` : `Máy chủ AI đang bận, tự thử lại sau ${secs} giây...`, 'info');
    };
    let lastErr = null, busy = false;
    for (const m of names) {
      tried.push(m);
      let res = null, attempt = 0;
      for (;;) {
        try {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.geminiKey },
            body: JSON.stringify({ contents: [{ parts: [...(opts.parts || []), { text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
          });
        } catch (e) {
          if (attempt < 1) { attempt++; await sleep(3000); continue; }
          throw new Error('Không kết nối được Google AI (kiểm tra mạng).');
        }
        const maxTry = res.status === 429 ? 2 : 3;
        if (TRANSIENT.includes(res.status) && attempt < maxTry) {
          attempt++; const secs = res.status === 429 ? attempt * 20 : attempt * 6;
          notify(secs, res.status); await sleep(secs * 1000); continue;
        }
        break;
      }
      if (res.ok) {
        const data = await res.json();
        const txt = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts || []).map(p => p.text || '').join('');
        if (!txt) { lastErr = new Error('AI không trả về nội dung (có thể bị chặn bộ lọc an toàn).'); continue; }
        S.workingModel = m; return txt;
      }
      let body = {}; try { body = await res.json(); } catch (e) { }
      const msg = (body.error && body.error.message) || ('HTTP ' + res.status);
      lastErr = new Error(msg);
      if (TRANSIENT.includes(res.status)) { busy = true; continue; }                 // quá tải: thử mô hình khác
      if (res.status === 404 || (res.status === 400 && /not found|not supported|unknown model/i.test(msg))) continue;   // tên mô hình không còn
      if (res.status === 400 && /API key/i.test(msg)) throw new Error('API key không hợp lệ.');
      if (res.status === 403 || res.status === 401) throw new Error('API key bị từ chối: ' + msg);
      throw lastErr;
    }
    if (busy) throw new Error('Máy chủ Google AI đang quá tải hoặc đã hết lượt gọi tạm thời (đã thử ' + tried.length + ' mô hình: ' + tried.join(', ') + '). Thầy đợi 1-2 phút rồi bấm lại. Nếu vẫn lỗi, thử vào Cài đặt nhập tên mô hình khác (ví dụ gemini-2.5-flash-lite).');
    throw new Error((lastErr ? lastErr.message : 'Lỗi AI') + ' (đã thử: ' + tried.join(', ') + '). Thầy vào Cài đặt nhập tên mô hình còn hoạt động.');
  }

  function parseJsonLoose(t) {
    t = String(t).replace(/```json/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(t); } catch (e) { const m = t.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('AI trả về dữ liệu sai định dạng, hãy thử lại.'); }
  }

  function shuffleQ(q) {
    const correct = q.options[q.answer];
    const o = QM.shuffle(q.options);
    return { ...q, options: o, answer: Math.max(0, o.indexOf(correct)) };
  }

  function normalize(arr, allowed, seen) {
    const out = []; let dropped = 0;
    (arr || []).forEach(r => {
      if (!r || typeof r.question !== 'string' || !Array.isArray(r.options) || r.options.length < 4) { dropped++; return; }
      const opts = r.options.slice(0, 4).map(o => String(o).replace(/^\s*[A-Da-d][.):]\s+/, '').trim());
      if (opts.some(o => !o) || new Set(opts).size < 4) { dropped++; return; }
      let a = r.answer; if (typeof a === 'string') { const L = a.trim().toUpperCase(); a = LETTERS.includes(L) ? LETTERS.indexOf(L) : parseInt(a, 10); }
      if (!Number.isInteger(a) || a < 0 || a > 3) { dropped++; return; }
      let lesson = r.lesson !== undefined ? parseInt(r.lesson, 10) : undefined;
      if (allowed) { if (!allowed.has(lesson)) { dropped++; return; } }
      const key = r.question.toLowerCase().replace(/\W+/g, '').slice(0, 60);
      if (seen.has(key)) { dropped++; return; }
      seen.add(key);
      const q = { question: r.question.trim(), options: opts, answer: a, explanation: String(r.explanation || '').trim() };
      if (allowed) q.lesson = lesson;
      out.push(shuffleQ(q));
    });
    return { out, dropped };
  }

  /* ---- Câu đúng/sai (GDPT 2018): 1 dẫn + 4 ý a,b,c,d ---- */
  function tfPrompt(P, quotas, count, existing) {
    const lessons = P.sc && P.sc.res ? P.sc.res.lessons : [];
    const bookTitle = P.book ? P.book.title : '';
    const L = [];
    L.push(`Bạn là giáo viên ${P.subject} ${P.grade}, đang soạn câu hỏi trắc nghiệm ĐÚNG/SAI theo Chương trình GDPT 2018: mỗi câu gồm một "dẫn" chung (đoạn thông tin, tình huống hoặc số liệu bằng văn bản) và 4 ý a), b), c), d); mỗi ý là một nhận định mà học sinh chọn ĐÚNG hoặc SAI.`);
    L.push(`PHẠM VI KIẾN THỨC: ${P.sc && P.sc.label ? P.sc.label : P.title}${bookTitle ? ' — ' + bookTitle : ''}`, '', 'QUY TẮC BẮT BUỘC:');
    L.push(P.text ? '1. CHỈ dùng thông tin trong khối <TAI_LIEU>. Không dùng kiến thức bên ngoài, không bịa số liệu, không hỏi về bài/chương khác.' : `1. Không có tài liệu kèm theo: ra câu hỏi đúng chuẩn chương trình phổ thông Việt Nam về chủ đề "${P.title}".`);
    if (lessons.length) {
      L.push('2. Mỗi câu PHẢI có trường "lesson" = số bài (số nguyên) mà kiến thức thuộc về. Chỉ dùng các số bài: ' + lessons.map(l => l.num).join(', ') + '.');
      L.push('3. Số câu theo bài (tổng đúng ' + count + ' câu): ' + Object.keys(quotas).map(n => `Bài ${n}: ${quotas[n]} câu`).join('; ') + '. Nếu tài liệu một bài quá ngắn, ra ít câu hơn, KHÔNG bịa.');
    } else L.push(`2. Tạo đúng ${count} câu.`);
    L.push(`4. Mức độ: ${P.diff}. Ý a, b dễ hơn; ý c, d khó dần.`);
    L.push('5. Mỗi ý là mệnh đề khẳng định rõ ràng, kết luận được Đúng hoặc Sai dứt khoát. Mỗi câu nên có cả ý đúng và ý sai. Dẫn phải phù hợp với cả 4 ý.');
    L.push('6. "giaiThich" của từng ý: nêu căn cứ; nếu ý sai thì nêu mệnh đề đúng sửa lại. Không ghi số trang.');
    L.push('7. Các câu không trùng ý nhau' + (existing && existing.length ? ' và không trùng:\n' + existing.map(q => '   - ' + q.slice(0, 90)).join('\n') : '') + '. Không dùng LaTeX hay markdown.');
    if (P.text) L.push('', '<TAI_LIEU>', P.text.slice(0, 150000), '</TAI_LIEU>');
    L.push('', 'Chỉ trả về JSON hợp lệ:', '{"cau":[{' + (lessons.length ? '"lesson":5,' : '') + '"dan":"...","y":[{"noiDung":"...","dung":true,"giaiThich":"..."},{"noiDung":"...","dung":false,"giaiThich":"..."},{"noiDung":"...","dung":true,"giaiThich":"..."},{"noiDung":"...","dung":false,"giaiThich":"..."}]}]}');
    return L.join('\n');
  }
  function normTf(r, allowed) {
    if (!r || typeof r.dan !== 'string' || !Array.isArray(r.y) || r.y.length < 4) return null;
    const st = r.y.slice(0, 4).map(y => {
      if (!y || typeof y.noiDung !== 'string') return null;
      let d = y.dung; if (typeof d === 'string') d = /^(đ|d|true|đúng|dung)/i.test(d.trim());
      if (typeof d !== 'boolean') return null;
      return { text: y.noiDung.replace(/\*\*/g, '').replace(/^\s*[a-dA-D][.)]\s+/, '').trim(), answer: d, explanation: String(y.giaiThich || '').replace(/\*\*/g, '').trim() };
    });
    if (st.some(x => !x || !x.text)) return null;
    const q = { type: 'tf', question: r.dan.replace(/\*\*/g, '').trim(), statements: st, explanation: '' };
    if (allowed) { const l = parseInt(r.lesson, 10); if (!allowed.has(l)) return null; q.lesson = l; }
    return q;
  }
  async function genTf(P, hasLessons, allowed) {
    const seen = new Set(); let got = [];
    for (let attempt = 0; attempt < Math.ceil(P.countTf / 6) + 2 && got.length < P.countTf; attempt++) {
      const need = Math.min(P.countTf - got.length, 6);
      const quotas = hasLessons ? SGK.allocate(P.sc.res.lessons, need) : {};
      const raw = parseJsonLoose(await callGemini(tfPrompt(P, quotas, need, got.map(q => q.question))));
      (Array.isArray(raw) ? raw : (raw.cau || raw.questions || [])).forEach(r => {
        const q = normTf(r, allowed); if (!q) return;
        const key = q.question.toLowerCase().replace(/\W+/g, '').slice(0, 60);
        if (seen.has(key)) return; seen.add(key); got.push(q);
      });
    }
    return got.slice(0, P.countTf);
  }

  async function generate() {
    const P = currentParams();
    if (!P.title) { QM.toast('Hãy nhập tên bài kiểm tra.', 'error'); return; }
    const hasLessons = P.sc && P.sc.res && P.sc.ids.length > 0;
    if (S.scope.mode !== 'free' && S.scope.parsedBook && !hasLessons) { QM.toast('Thầy chưa chọn bài/chương nào.', 'error'); return; }
    if (P.count + P.countTf === 0) { QM.toast('Hãy chọn ít nhất 1 câu (nhiều lựa chọn hoặc đúng/sai).', 'error'); return; }
    if (!S.geminiKey) {
      if (P.count > 0) { QM.toast('Chưa có API key nên chuyển sang lấy câu mẫu. Nhập key ở tab Cài đặt để AI tự sinh đề.', 'info'); return loadSample(); }
      QM.toast('Cần nhập Gemini API key ở tab Cài đặt để tạo câu đúng/sai.', 'error'); return;
    }
    const btn = $('btn-generate'); btn.disabled = true; $('gen-spin').classList.remove('hidden'); $('gen-text').textContent = 'AI đang đọc phạm vi đã chọn và ra đề...';
    try {
      const allowed = hasLessons ? new Set(P.sc.res.lessons.map(l => l.num)) : null;
      const quotaFull = hasLessons ? SGK.allocate(P.sc.res.lessons, P.count) : {};
      const seen = new Set(); let got = [];
      for (let attempt = 0; attempt < Math.ceil(P.count / 15) + 2 && got.length < P.count; attempt++) {
        const need = Math.min(P.count - got.length, 15);   // mỗi lần gọi AI tối đa 15 câu để không bị cắt cụt
        let quotas = quotaFull;
        if (hasLessons) {
          const have = {}; got.forEach(q => { have[q.lesson] = (have[q.lesson] || 0) + 1; });
          const def = {}; let sum = 0;
          Object.keys(quotaFull).forEach(n => { const d = quotaFull[n] - (have[n] || 0); if (d > 0) { def[n] = d; sum += d; } });
          quotas = def;
          if (sum > need) { let ex = sum - need; Object.keys(quotas).reverse().forEach(n => { while (ex > 0 && quotas[n] > 0) { quotas[n]--; ex--; } }); }
          if (!Object.keys(quotas).length || Object.values(quotas).reduce((a, b) => a + b, 0) === 0) { quotas = SGK.allocate(P.sc.res.lessons, need); }
        }
        const raw = parseJsonLoose(await callGemini(buildPrompt(P, quotas, need, got.map(q => q.question))));
        const r = normalize(raw.questions || raw, allowed, seen);
        got = got.concat(r.out);
      }
      got = got.slice(0, P.count);
      let tf = [];
      if (P.countTf > 0) { $('gen-text').textContent = 'AI đang soạn câu đúng/sai...'; tf = await genTf(P, hasLessons, allowed); }
      if (!got.length && !tf.length) throw new Error('AI chưa tạo được câu hỏi hợp lệ trong phạm vi đã chọn. Thầy thử bổ sung thêm nội dung vào khung kiến thức rồi tạo lại.');
      setQuiz({ title: P.title, subject: P.subject, grade: P.grade, bookTitle: P.book ? P.book.title : '', scopeLabel: P.sc ? P.sc.label : '', questions: got.concat(tf) });
      QM.sound.cheer();
      let msg = `Đã tạo ${got.length} câu nhiều lựa chọn` + (tf.length ? ` và ${tf.length} câu đúng/sai` : '') + (hasLessons ? ' đúng phạm vi: ' + P.sc.label : '') + '.';
      const short = got.length < P.count || tf.length < P.countTf;
      if (short) msg += ' (Nội dung chỉ đủ cho số câu như trên - hãy bổ sung nội dung hoặc giảm số câu.)';
      QM.toast(msg, short ? 'info' : 'success');
    } catch (e) { QM.toast(e.message, 'error'); }
    finally { btn.disabled = false; $('gen-spin').classList.add('hidden'); $('gen-text').textContent = '✨ Tạo đề bằng AI theo phạm vi đã chọn'; }
  }
  $('btn-generate').onclick = generate;

  // Câu mẫu có sẵn (chỉ lấy đúng các bài thuộc phạm vi)
  async function loadSample() {
    const P = currentParams();
    if (!P.book || !P.sc || !P.sc.res) { QM.toast('Câu mẫu chỉ có cho tài liệu có sẵn trong hệ thống (Công nghệ 10-11-12). Với nội dung khác, hãy dùng AI.', 'info'); return; }
    const bank = await getBank(P.book);
    const nums = new Set(P.sc.res.lessons.map(l => l.num));
    let pool = QM.shuffle(bank.filter(q => nums.has(q.bai)));
    if (!pool.length) { QM.toast('Chưa có câu mẫu cho ' + P.sc.label + '. Hãy nhập API key (tab Cài đặt) để AI tự ra đề cho đúng bài này.', 'error'); return; }
    pool = pool.slice(0, P.count || 10).map(q => shuffleQ({ question: q.question, options: q.options, answer: q.answer, explanation: q.explanation, lesson: q.bai }));
    setQuiz({ title: P.title || P.sc.label, subject: P.subject, grade: P.grade, bookTitle: P.book.title, scopeLabel: P.sc.label, questions: pool });
    QM.toast(`Đã lấy ${pool.length} câu mẫu thuộc phạm vi “${P.sc.label}”` + (pool.length < P.count ? ' (trong kho chỉ có từng đó câu cho phạm vi này).' : '.'), 'success');
  }
  $('btn-sample').onclick = loadSample;

  /* ======================= DANH SÁCH CÂU HỎI ======================= */
  let editIdx = -1;
  const isTf = q => q && q.type === 'tf';
  function setQuiz(q) { S.quiz = { ...q, createdAt: Date.now() }; editIdx = -1; renderQuestions(); }
  function renderQuestions() {
    const qs = S.quiz.questions || [];
    const nT = qs.filter(isTf).length;
    $('q-count').textContent = qs.length;
    $('q-meta').textContent = qs.length ? `${S.quiz.title || 'Bộ đề'} • ${S.quiz.scopeLabel || S.quiz.subject || ''} • ${qs.length - nT} nhiều lựa chọn, ${nT} đúng/sai` : 'Chưa có câu hỏi.';
    if (!qs.length) { $('q-list').innerHTML = '<div class="p-8 text-center text-slate-500 italic text-sm">Chưa có câu hỏi. Chọn phạm vi ở bên trái rồi bấm tạo đề.</div>'; return; }
    const btns = i => `<button class="text-slate-400 hover:text-white text-xs p-1" data-act="edit" data-i="${i}" title="Sửa">✏️</button><button class="text-slate-500 hover:text-rose-400 text-xs p-1" data-act="del" data-i="${i}" title="Xóa">✕</button>`;
    const chip = q => `${q.lesson !== undefined ? `<span class="inline-block mt-1 mr-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">Bài ${q.lesson}</span>` : ''}${isTf(q) ? '<span class="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">Đúng/Sai</span>' : ''}`;
    $('q-list').innerHTML = qs.map((q, i) => {
      if (i === editIdx && isTf(q)) return `
        <div class="p-4 rounded-xl bg-slate-900 border border-purple-600 space-y-2">
          <label class="lbl">Dẫn (đoạn thông tin / tình huống)</label><textarea id="eq-q" rows="3" class="inp">${esc(q.question)}</textarea>
          ${q.statements.map((s, j) => `<div class="grid grid-cols-12 gap-2 items-center"><span class="col-span-1 text-xs font-bold">${'abcd'[j]})</span><input id="eq-s${j}" class="inp col-span-7" value="${esc(s.text)}"><select id="eq-a${j}" class="inp col-span-2"><option value="1" ${s.answer ? 'selected' : ''}>Đúng</option><option value="0" ${s.answer ? '' : 'selected'}>Sai</option></select><span></span><input id="eq-x${j}" class="inp col-span-12" placeholder="Giải thích ý ${'abcd'[j]}" value="${esc(s.explanation || '')}"></div>`).join('')}
          <div class="flex gap-2"><button class="btn btn-ok" data-act="save" data-i="${i}">Lưu</button><button class="btn btn-g" data-act="cancel">Hủy</button></div>
        </div>`;
      if (i === editIdx) return `
        <div class="p-4 rounded-xl bg-slate-900 border border-purple-600 space-y-2">
          <textarea id="eq-q" rows="2" class="inp">${esc(q.question)}</textarea>
          ${q.options.map((o, j) => `<div class="flex items-center gap-2"><span class="text-xs font-bold w-5">${LETTERS[j]}</span><input id="eq-o${j}" class="inp" value="${esc(o)}"></div>`).join('')}
          <textarea id="eq-e" rows="2" class="inp" placeholder="Giải thích">${esc(q.explanation || '')}</textarea>
          <div class="flex gap-2"><button class="btn btn-ok" data-act="save" data-i="${i}">Lưu</button><button class="btn btn-g" data-act="cancel">Hủy</button></div>
        </div>`;
      if (isTf(q)) return `
        <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div class="flex items-start gap-2">
            <span class="w-6 h-6 rounded-md bg-amber-900/60 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">${i + 1}</span>
            <div class="flex-1"><p class="text-sm font-bold text-white leading-snug">${esc(q.question)}</p>${chip(q)}</div>${btns(i)}
          </div>
          <div class="space-y-1.5 text-xs">${q.statements.map((s, j) => `<div data-act="tf" data-i="${i}" data-j="${j}" class="cursor-pointer p-2 rounded-lg border flex items-start justify-between gap-2 ${s.answer ? 'bg-emerald-600/20 border-emerald-600 text-emerald-100' : 'bg-rose-600/15 border-rose-700 text-rose-100'}"><span><b>${'abcd'[j]})</b> ${esc(s.text)}</span><b class="shrink-0">${s.answer ? 'ĐÚNG' : 'SAI'}</b></div>`).join('')}</div>
          <p class="text-[10px] text-slate-500">Bấm vào từng ý để đổi Đúng/Sai.</p>
          ${q.statements.some(s => s.explanation) ? `<div class="text-[11px] text-slate-400 italic bg-slate-950 p-2 rounded border border-slate-800 space-y-0.5">${q.statements.map((s, j) => s.explanation ? `<div>💡 ${'abcd'[j]}) ${esc(s.explanation)}</div>` : '').join('')}</div>` : ''}
        </div>`;
      return `
        <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div class="flex items-start gap-2">
            <span class="w-6 h-6 rounded-md bg-purple-900/60 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0">${i + 1}</span>
            <div class="flex-1"><p class="text-sm font-bold text-white leading-snug">${esc(q.question)}</p>${chip(q)}</div>${btns(i)}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            ${q.options.map((o, j) => `<div data-act="ans" data-i="${i}" data-j="${j}" class="cursor-pointer p-2 rounded-lg border flex items-center justify-between gap-2 ${j === q.answer ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'}"><span><b class="opacity-70">${LETTERS[j]}.</b> ${esc(o)}</span>${j === q.answer ? '<span>✓</span>' : ''}</div>`).join('')}
          </div>
          ${q.explanation ? `<p class="text-[11px] text-slate-400 italic bg-slate-950 p-2 rounded border border-slate-800">💡 ${esc(q.explanation)}</p>` : ''}
        </div>`;
    }).join('');
  }
  $('q-list').addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const i = parseInt(t.dataset.i, 10), qs = S.quiz.questions;
    switch (t.dataset.act) {
      case 'del': qs.splice(i, 1); editIdx = -1; break;
      case 'ans': qs[i].answer = parseInt(t.dataset.j, 10); break;
      case 'tf': { const s = qs[i].statements[parseInt(t.dataset.j, 10)]; s.answer = !s.answer; break; }
      case 'edit': editIdx = i; break;
      case 'cancel': editIdx = -1; break;
      case 'save': {
        const q = qs[i];
        if (isTf(q)) {
          const st = [0, 1, 2, 3].map(j => ({ text: $('eq-s' + j).value.trim(), answer: $('eq-a' + j).value === '1', explanation: $('eq-x' + j).value.trim() }));
          if (!$('eq-q').value.trim() || st.some(s => !s.text)) { QM.toast('Dẫn và 4 ý không được để trống.', 'error'); return; }
          q.question = $('eq-q').value.trim(); q.statements = st;
        } else {
          const opts = [0, 1, 2, 3].map(j => $('eq-o' + j).value.trim());
          if (!$('eq-q').value.trim() || opts.some(o => !o)) { QM.toast('Câu hỏi và 4 phương án không được để trống.', 'error'); return; }
          q.question = $('eq-q').value.trim(); q.options = opts; q.explanation = $('eq-e').value.trim();
        }
        editIdx = -1; break;
      }
    }
    renderQuestions();
  });
  $('btn-add-q').onclick = () => {
    S.quiz.questions.push({ question: 'Nội dung câu hỏi mới...', options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'], answer: 0, explanation: '' });
    if (!S.quiz.title) S.quiz.title = $('ai-topic').value.trim() || 'Bộ đề thủ công';
    editIdx = S.quiz.questions.length - 1; renderQuestions();
  };
  $('btn-add-tf').onclick = () => {
    S.quiz.questions.push({ type: 'tf', question: 'Dẫn / tình huống của câu đúng sai...', statements: [0, 1, 2, 3].map(j => ({ text: 'Nhận định ' + 'abcd'[j], answer: j % 2 === 0, explanation: '' })), explanation: '' });
    if (!S.quiz.title) S.quiz.title = $('ai-topic').value.trim() || 'Bộ đề thủ công';
    editIdx = S.quiz.questions.length - 1; renderQuestions();
  };
  $('btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(S.quiz, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'de_' + Date.now() + '.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('btn-import').onclick = () => $('file-import').click();
  $('file-import').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result); const arr = Array.isArray(d) ? (d[0] && d[0].questions) : d.questions;
        if (!arr || !arr.length) throw 0;
        setQuiz({ ...(Array.isArray(d) ? d[0] : d), questions: arr.map(q => ({ ...q })) });
        $('ai-topic').value = S.quiz.title || ''; topicEdited = true;
        QM.toast('Đã nạp bộ đề: ' + (S.quiz.title || 'mới'), 'success');
      } catch (x) { QM.toast('File JSON không hợp lệ.', 'error'); }
    };
    r.readAsText(f); e.target.value = '';
  });

  $('btn-save-quiz').onclick = async () => {
    if (!S.quiz.questions.length) return QM.toast('Chưa có câu hỏi để lưu.', 'error');
    const title = $('ai-topic').value.trim() || S.quiz.title || 'Bộ đề không tên';
    const rec = { title, subject: S.quiz.subject || $('ai-subject').value, grade: S.quiz.grade || $('ai-grade').value, bookTitle: S.quiz.bookTitle || '', scopeLabel: S.quiz.scopeLabel || '', count: S.quiz.questions.length, questions: S.quiz.questions, createdAt: QM.TS() };
    try {
      if (S.quiz.libKey) { await db().ref(`quizzes/${S.user.username}/${S.quiz.libKey}`).set(rec); QM.toast('Đã cập nhật đề trong thư viện.', 'success'); }
      else { const r = db().ref(`quizzes/${S.user.username}`).push(); await r.set(rec); S.quiz.libKey = r.key; QM.toast('Đã lưu vào “Đề của tôi”.', 'success'); }
      S.quiz.title = title;
    } catch (e) { QM.toast('Không lưu được: ' + QM.fbError(e), 'error'); }
  };
  $('btn-open-room').onclick = () => { S.quiz.title = $('ai-topic').value.trim() || S.quiz.title || 'Bộ đề'; openRoom(S.quiz); };

  /* ======================= THƯ VIỆN ĐỀ ======================= */
  let libData = [];
  function renderLibrary(snap) {
    libData = []; snap.forEach(ch => { libData.push({ key: ch.key, ...ch.val() }); });
    libData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    $('lib-count').textContent = libData.length + ' đề';
    $('lib-list').innerHTML = libData.length ? libData.map(q => `
      <div class="card p-4 space-y-2">
        <div class="font-bold text-white">${esc(q.title)}</div>
        <div class="text-xs text-slate-400">${esc(q.subject || '')} • ${esc(q.grade || '')} • ${q.count || (q.questions || []).length} câu${q.scopeLabel ? ' • ' + esc(q.scopeLabel) : ''}</div>
        <div class="text-[11px] text-slate-500">${q.createdAt ? new Date(q.createdAt).toLocaleString('vi-VN') : ''}</div>
        <div class="flex flex-wrap gap-2 pt-1">
          <button class="btn btn-g" data-lib="edit" data-k="${q.key}">✏️ Mở để sửa</button>
          <button class="btn btn-ok" data-lib="room" data-k="${q.key}">🚀 Mở phòng</button>
          <button class="btn btn-r" data-lib="del" data-k="${q.key}">🗑 Xóa</button>
        </div>
      </div>`).join('') : '<div class="card p-8 text-center text-slate-500 italic text-sm md:col-span-2">Chưa có đề nào được lưu.</div>';
  }
  $('lib-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-lib]'); if (!b) return;
    const q = libData.find(x => x.key === b.dataset.k); if (!q) return;
    if (b.dataset.lib === 'del') { if (confirm('Xóa đề “' + q.title + '”?')) await db().ref(`quizzes/${S.user.username}/${q.key}`).remove(); return; }
    const quiz = { title: q.title, subject: q.subject, grade: q.grade, bookTitle: q.bookTitle, scopeLabel: q.scopeLabel, questions: (q.questions || []).map(x => ({ ...x })), libKey: q.key };
    if (b.dataset.lib === 'room') { openRoom(quiz); return; }
    S.quiz = quiz; editIdx = -1; $('ai-topic').value = q.title; topicEdited = true; renderQuestions(); setView('create');
  });

  /* ======================= TÀI LIỆU: DANH SÁCH + THÊM ======================= */
  async function renderBooks() {
    const list = allBooks(), admin = isAdmin();
    const rows = list.map(b => {
      const mine = b.source === 'db' && (admin || b.owner === S.user.username);
      const edit = b.source === 'db' ? (mine ? '<button class="btn btn-g" data-bk="edit">✏️ Sửa</button>' : '')
        : (admin ? '<button class="btn btn-g" data-bk="edit">✏️ Sửa (thay bản gốc)</button>' : '<button class="btn btn-g" data-bk="edit">📋 Nhân bản để sửa</button>');
      const del = b.source === 'db' ? (mine ? '<button class="btn btn-r" data-bk="del">🗑 Xóa</button>' : '') : (admin ? '<button class="btn btn-r" data-bk="hide">🗑 Ẩn</button>' : '');
      return `<div class="card p-4 space-y-2" data-book="${esc(b.id)}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div><div class="font-bold text-white">${esc(b.title)}</div>
            <div class="text-xs text-slate-400">${esc(b.subject)} • ${esc(b.grade)} • ${b.source === 'file' ? 'Có sẵn trong hệ thống' : 'Thư viện chung • thêm bởi @' + esc(b.owner || '?')}${b.replaces ? ' • <span class="text-amber-300">bản sửa của sách có sẵn</span>' : ''}</div></div>
          <div class="flex flex-wrap gap-2"><button class="btn btn-g" data-bk="toc">📑 Mục lục</button>${edit}<button class="btn btn-g" data-bk="dl">⬇️ Tải .md</button>${del}</div>
        </div><div class="toc hidden text-xs text-slate-300 pt-2 border-t border-slate-800"></div></div>`;
    }).join('');
    const hiddenList = admin ? S.staticBooks.filter(b => S.hidden[b.id]) : [];
    $('books-list').innerHTML = (rows || '<div class="card p-8 text-center text-slate-500 italic text-sm">Chưa có tài liệu nào.</div>') +
      (hiddenList.length ? `<div class="card p-4 space-y-2"><div class="text-sm font-bold text-slate-300">Tài liệu có sẵn đã bị ẩn</div>${hiddenList.map(b => `<div class="flex items-center justify-between text-xs"><span>${esc(b.title)}</span><button class="btn btn-g" data-restore="${esc(b.id)}">↩️ Khôi phục</button></div>`).join('')}</div>` : '');
  }
  async function bookText(b) {
    if (b.source === 'db') return b.text || '';
    const r = await fetch('sgk/' + b.file); if (!r.ok) throw new Error('Không tải được sgk/' + b.file); return r.text();
  }
  $('books-list').addEventListener('click', async e => {
    const rs = e.target.closest('[data-restore]');
    if (rs) { try { await db().ref('settings/hiddenBooks/' + rs.dataset.restore).remove(); QM.toast('Đã khôi phục tài liệu.', 'success'); } catch (x) { QM.toast(QM.fbError(x), 'error'); } return; }
    const btn = e.target.closest('[data-bk]'); if (!btn) return;
    const card = btn.closest('[data-book]'), b = allBooks().find(x => x.id === card.dataset.book); if (!b) return;
    try {
      switch (btn.dataset.bk) {
        case 'del':
          if (confirm('Xóa tài liệu “' + b.title + '” khỏi thư viện chung?' + (b.replaces ? '\nBản sách có sẵn ban đầu sẽ được hiển thị trở lại.' : ''))) { await db().ref('curriculum/' + b.key).remove(); QM.toast('Đã xóa tài liệu.', 'success'); }
          return;
        case 'hide':
          if (confirm('Ẩn tài liệu có sẵn “' + b.title + '” với tất cả giáo viên? (có thể khôi phục ở cuối danh sách)')) { await db().ref('settings/hiddenBooks/' + b.id).set(true); QM.toast('Đã ẩn tài liệu.', 'success'); }
          return;
        case 'dl': {
          const text = await bookText(b);
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
          a.download = (b.title || 'sgk').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') + '.md'; a.click(); URL.revokeObjectURL(a.href); return;
        }
        case 'edit': {
          const text = await bookText(b);
          openBookModal(b.source === 'db' ? { kind: 'db', key: b.key, book: b, text } : { kind: 'static', book: b, text, replace: isAdmin() });
          return;
        }
        case 'toc': {
          const toc = card.querySelector('.toc');
          if (!toc.classList.contains('hidden')) { toc.classList.add('hidden'); return; }
          const p = await getParsed(b), pb = p.parsed;
          toc.innerHTML = (pb.fallback ? '<p class="text-amber-300 mb-2">Không thấy mẫu “Bài N” - hệ thống đã tách theo các tiêu đề #.</p>' : '') +
            pb.chapters.map(c => `<div class="mb-2"><div class="font-bold text-purple-300">${esc(SGK.chapterLabel(c))}</div><ul class="pl-4 list-disc">${c.lessonIds.map(id => { const l = pb.lessons.find(x => x.id === id); const n = (l.body || '').length; return `<li>${esc(SGK.lessonLabel(l))} <span class="text-slate-500">(${n} ký tự${n < 120 ? ' - ngắn' : ''})</span></li>`; }).join('')}</ul></div>`).join('') +
            `<div class="text-slate-400">Tổng: ${pb.chapters.length} chương, ${pb.lessons.length} bài.</div>`;
          toc.classList.remove('hidden'); return;
        }
      }
    } catch (x) { QM.toast(x.message || QM.fbError(x), 'error'); }
  });

  let mbEdit = null;
  function openBookModal(edit) {
    mbEdit = edit || null;
    $('modal-book').classList.remove('hidden');
    const note = $('mb-note');
    if (!edit) {
      $('mb-heading').textContent = '➕ Thêm tài liệu SGK'; $('mb-title').value = ''; $('mb-text').value = ''; $('mb-filename').textContent = ''; note.classList.add('hidden');
      $('mb-save').textContent = 'Lưu tài liệu';
    } else {
      const b = edit.book;
      $('mb-heading').textContent = '✏️ ' + (edit.kind === 'db' ? 'Sửa tài liệu SGK' : (edit.replace ? 'Sửa sách có sẵn (thay bản gốc)' : 'Nhân bản sách có sẵn để sửa'));
      $('mb-subject').value = b.subject; $('mb-grade').value = b.grade; $('mb-title').value = b.title + (edit.kind === 'static' && !edit.replace ? ' (bản sao)' : '');
      $('mb-text').value = edit.text; $('mb-filename').textContent = '';
      $('mb-save').textContent = edit.kind === 'db' ? 'Lưu thay đổi' : (edit.replace ? 'Lưu và thay bản gốc' : 'Lưu bản sao');
      note.textContent = edit.kind === 'static' ? (edit.replace ? 'Bản thầy sửa sẽ thay thế sách có sẵn cho tất cả giáo viên (xóa bản sửa thì bản gốc hiện lại). Lưu ý: phần tóm tắt bổ sung và câu hỏi mẫu đi kèm bản gốc sẽ không còn áp dụng.' : 'Tạo một bản sao trong thư viện chung để thầy/cô chỉnh sửa; sách có sẵn vẫn giữ nguyên.') : 'Thầy/cô có thể sửa nội dung trực tiếp, hoặc bấm “Chọn file” để thay bằng file .md mới.';
      note.classList.remove('hidden');
    }
    previewBook();
  }
  function closeBookModal() { $('modal-book').classList.add('hidden'); mbEdit = null; }
  $('btn-add-book').onclick = () => { const s = $('ai-subject').value, g = $('ai-grade').value; openBookModal(null); $('mb-subject').value = s; $('mb-grade').value = g; };
  $('mb-close').onclick = closeBookModal; $('mb-cancel').onclick = closeBookModal;
  $('mb-pick').onclick = () => $('mb-file').click();
  $('mb-file').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { $('mb-text').value = ev.target.result; $('mb-filename').textContent = f.name; if (!$('mb-title').value) $('mb-title').value = f.name.replace(/\.(md|txt)$/i, ''); previewBook(); };
    r.readAsText(f, 'utf-8'); e.target.value = '';
  });
  $('mb-text').addEventListener('input', previewBook);
  function previewBook() {
    const t = $('mb-text').value;
    if (t.trim().length < 20) { $('mb-preview').textContent = 'Chưa có nội dung.'; return; }
    const pb = SGK.parseBook(t);
    $('mb-preview').innerHTML = `Nhận diện được <b class="text-emerald-300">${pb.chapters.length} chương, ${pb.lessons.length} bài</b> • ${t.length.toLocaleString()} ký tự` +
      (pb.fallback ? '<br><span class="text-amber-300">Không thấy mẫu “Bài N” - sẽ tách theo các tiêu đề # (nên đánh số “Bài N” để chọn bài dễ hơn).</span>' : '') +
      '<div class="mt-2 max-h-28 overflow-y-auto text-slate-400">' + pb.lessons.slice(0, 80).map(l => esc(SGK.lessonLabel(l))).join(' • ') + '</div>';
  }
  $('mb-sample').onclick = () => {
    const sample = `# Tên sách - Lớp ...\n\n## PHẦN 1: Tên phần (không bắt buộc)\n\n### CHƯƠNG I: Tên chương thứ nhất\n- **Bài 1: Tên bài thứ nhất**\n  - Ý kiến thức 1: định nghĩa, công thức, số liệu...\n  - Ý kiến thức 2: ...\n- **Bài 2: Tên bài thứ hai**\n  - Nội dung bài 2...\n\n### CHƯƠNG II: Tên chương thứ hai\n- **Bài 3: Tên bài thứ ba**\n  - Nội dung bài 3...\n`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([sample], { type: 'text/markdown' })); a.download = 'mau-cau-truc-sgk.md'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('mb-save').onclick = async () => {
    const title = $('mb-title').value.trim(), text = $('mb-text').value.trim(), subject = $('mb-subject').value, grade = $('mb-grade').value;
    if (!title) return QM.toast('Nhập tên sách.', 'error');
    if (text.length < 50) return QM.toast('Nội dung quá ngắn.', 'error');
    if (text.length > 800000) return QM.toast('File quá lớn (tối đa ~800.000 ký tự). Hãy tách thành nhiều tài liệu.', 'error');
    try {
      if (mbEdit && mbEdit.kind === 'db') {
        await db().ref('curriculum/' + mbEdit.key).update({ subject, grade, title, text, updatedAt: QM.TS() });
        QM.toast('Đã cập nhật tài liệu.', 'success');
      } else {
        const rec = { subject, grade, title, owner: S.user.username, text, createdAt: QM.TS(), updatedAt: QM.TS() };
        if (mbEdit && mbEdit.kind === 'static' && mbEdit.replace) rec.replaces = mbEdit.book.id;
        await db().ref('curriculum').push().set(rec);
        QM.toast(mbEdit ? 'Đã lưu tài liệu.' : 'Đã thêm tài liệu vào thư viện chung.', 'success');
        $('ai-subject').value = subject; $('ai-grade').value = grade; refreshBookSelect();
      }
      closeBookModal();
    } catch (e) { QM.toast('Không lưu được: ' + QM.fbError(e), 'error'); }
  };

  /* ======================= CÀI ĐẶT ======================= */
  $('st-save').onclick = async () => {
    const key = $('st-key').value.trim(), model = $('st-model').value.trim();
    try {
      await db().ref('private/' + S.user.username).set({ geminiKey: key, geminiModel: model });
      S.geminiKey = key; S.geminiModel = model; updateAiBadge(); $('st-msg').textContent = 'Đã lưu.'; QM.toast('Đã lưu cấu hình AI.', 'success');
    } catch (e) { QM.toast(QM.fbError(e), 'error'); }
  };
  $('st-clear').onclick = async () => {
    try { await db().ref('private/' + S.user.username).remove(); S.geminiKey = ''; S.geminiModel = ''; $('st-key').value = ''; $('st-model').value = ''; updateAiBadge(); QM.toast('Đã xóa key.', 'info'); } catch (e) { QM.toast(QM.fbError(e), 'error'); }
  };
  $('st-test').onclick = async () => {
    const key = $('st-key').value.trim(); if (!key) return QM.toast('Nhập API key trước.', 'error');
    S.geminiKey = key; S.geminiModel = $('st-model').value.trim(); $('st-msg').textContent = 'Đang kiểm tra...';
    try { await callGemini('Trả về JSON: {"ok":true}'); $('st-msg').textContent = '✅ Kết nối thành công với mô hình ' + S.workingModel + '.'; if (!S.geminiModel) $('st-model').placeholder = S.workingModel; updateAiBadge(); }
    catch (e) { $('st-msg').textContent = '❌ ' + e.message; }
  };
  $('pw-save').onclick = async () => {
    const o = $('pw-old').value, n = $('pw-new').value;
    if (n.length < 6) return QM.toast('Mật khẩu mới tối thiểu 6 ký tự.', 'error');
    if (n !== $('pw-new2').value) return QM.toast('Hai mật khẩu mới chưa khớp.', 'error');
    try {
      const u = auth().currentUser;
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, o));
      await u.updatePassword(n); QM.toast('Đã đổi mật khẩu.', 'success');
      ['pw-old', 'pw-new', 'pw-new2'].forEach(i => $(i).value = '');
    } catch (e) { QM.toast(QM.fbError(e), 'error'); }
  };

  /* ======================= PHÒNG THI (MÁY GIÁO VIÊN ĐIỀU KHIỂN) ======================= */
  function studentUrl(pin) { const u = new URL('index.html', location.href); u.search = ''; u.hash = ''; u.searchParams.set('pin', pin); return u.href; }
  const ROOM_SCREENS = ['none', 'lobby', 'question', 'result', 'podium'];
  function showRoomScreen(n) { ROOM_SCREENS.forEach(s => $(s === 'none' ? 'room-none' : 'host-' + s).classList.toggle('hidden', s !== n)); }
  const roomRef = () => db().ref('rooms/' + S.room.pin);
  const realPlayers = () => Object.values(S.room.players).filter(p => !p.bot);

  function newRoom(pin, quiz, timeLimit) {
    return { pin, quiz: { title: quiz.title, subject: quiz.subject, grade: quiz.grade, questions: quiz.questions }, players: {}, refs: [], timer: null, qKey: null, ending: false, state: null, shown: null, votes: null, votesKey: null, answers: {}, ansRef: null, timeLimit: timeLimit || 20, qrPin: null, confetti: false };
  }

  async function openRoom(quiz) {
    if (!quiz.questions || !quiz.questions.length) return QM.toast('Hãy tạo hoặc chọn bộ đề có câu hỏi trước.', 'error');
    const mcq = quiz.questions.filter(q => !q.type || q.type === 'mcq');
    if (!mcq.length) return QM.toast('Phòng thi trực tiếp chỉ dùng câu nhiều lựa chọn. Bộ đề này chỉ có câu đúng/sai - hãy dùng tab “Giao bài”.', 'error');
    if (mcq.length < quiz.questions.length) { QM.toast(`Phòng thi trực tiếp chỉ dùng ${mcq.length} câu nhiều lựa chọn (bỏ ${quiz.questions.length - mcq.length} câu đúng/sai).`, 'info'); quiz = { ...quiz, questions: mcq }; }
    if (S.room) { if (!confirm('Đang có một phòng thi mở. Đóng phòng cũ và mở phòng mới?')) return; await closeRoom(true); }
    try {
      let pin = null;
      for (let i = 0; i < 12 && !pin; i++) {
        const c = String(Math.floor(100000 + Math.random() * 900000));
        if ((await db().ref(`rooms/${c}/meta`).once('value')).exists()) continue;
        try { await db().ref(`rooms/${c}/meta`).set({ hostUid: S.user.uid, hostUsername: S.user.username, title: quiz.title || 'Bộ đề', subject: quiz.subject || '', grade: quiz.grade || '', totalQ: quiz.questions.length, createdAt: QM.TS() }); pin = c; }
        catch (e) { if (i === 11) throw e; }
      }
      if (!pin) throw new Error('Không tạo được mã phòng, thử lại.');
      await db().ref(`rooms/${pin}/state`).set({ status: 'lobby', totalQ: quiz.questions.length });
      S.room = newRoom(pin, quiz, parseInt($('lobby-time').value, 10));
      persistRoom(); attachRoom(); setView('room');
      QM.sound.cheer(); QM.toast('Đã mở phòng thi, mã: ' + pin, 'success');
    } catch (e) { QM.toast('Không mở được phòng: ' + QM.fbError(e), 'error'); }
  }
  function persistRoom() { try { localStorage.setItem('qm_host_room', JSON.stringify({ pin: S.room.pin, uid: S.user.uid, quiz: S.room.quiz, timeLimit: S.room.timeLimit })); } catch (e) { } }

  function attachRoom() {
    const R = S.room, base = roomRef();
    const pl = base.child('players'), st = base.child('state');
    R.refs = [pl, st];
    pl.on('value', s => { R.players = s.val() || {}; onPlayers(); });
    st.on('value', s => applyHostState(s.val()));
  }

  function onPlayers() {
    const R = S.room; if (!R) return;
    const list = Object.entries(R.players);
    $('lobby-count').textContent = list.length;
    $('lobby-grid').innerHTML = list.length ? list.map(([id, p]) => `<span class="px-3 py-1.5 rounded-xl bg-slate-800 border border-purple-500/30 text-sm font-bold flex items-center gap-2"><span class="text-lg">${esc(p.avatar || '')}</span>${esc(p.name || '')}${p.bot ? ' <span class="text-[10px] text-slate-400">(ảo)</span>' : ''}<button class="text-slate-500 hover:text-rose-400 text-xs" data-kick="${esc(id)}" title="Mời ra khỏi phòng">✕</button></span>`).join('')
      : '<span class="text-sm text-slate-500 italic">Đang chờ học sinh vào phòng...</span>';
    updateAnswerCount();
    if (R.state && R.state.status === 'result') renderBoard();
    if (R.state && R.state.status === 'podium') renderPodium();
  }
  $('lobby-grid').addEventListener('click', e => { const b = e.target.closest('[data-kick]'); if (b && S.room) roomRef().child('players/' + b.dataset.kick).remove(); });

  function applyHostState(st) {
    const R = S.room; if (!R) return;
    if (!st) return;
    R.state = st;
    if (st.status === 'lobby') { showRoomScreen('lobby'); renderLobby(); }
    else if (st.status === 'question') { if (R.qKey !== st.qKey || R.shown !== 'question') setupHostQuestion(st); }
    else if (st.status === 'result') { clearInterval(R.timer); detachAnswers(); renderResult(st); }
    else if (st.status === 'podium') { clearInterval(R.timer); detachAnswers(); renderPodium(); showRoomScreen('podium'); if (!R.confetti) { R.confetti = true; QM.sound.cheer(); if (window.confetti) confetti({ particleCount: 140, spread: 80, origin: { y: .6 } }); } }
    R.shown = st.status;
  }

  function renderLobby() {
    const R = S.room;
    $('lobby-title').textContent = R.quiz.title;
    $('lobby-pin').textContent = R.pin;
    const url = studentUrl(R.pin); $('lobby-link').value = url;
    if (R.qrPin !== R.pin) {
      R.qrPin = R.pin; $('qr-box').innerHTML = '';
      try { new QRCode($('qr-box'), { text: url, width: 144, height: 144 }); } catch (e) { $('qr-box').textContent = ''; }
    }
    onPlayers();
  }
  $('btn-copy-pin').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(S.room.pin); QM.toast('Đã chép mã phòng ' + S.room.pin, 'success'); };
  $('btn-copy-link').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(studentUrl(S.room.pin)); QM.toast('Đã chép link học sinh (đã kèm mã phòng).', 'success'); };
  $('btn-open-stu').onclick = () => window.open(studentUrl(S.room.pin), '_blank');
  $('btn-bots').onclick = async () => {
    const bots = [['bot_1', 'Minh Khang', '🚀'], ['bot_2', 'Bảo Ngọc', '🐱'], ['bot_3', 'Hải Đăng', '⚡']];
    try { for (const [id, name, avatar] of bots) await roomRef().child('players/' + id).update({ name, avatar, bot: true, score: 0, streak: 0, correct: 0, lastPoints: 0, joinedAt: QM.TS() }); QM.sound.correct(); }
    catch (e) { QM.toast(QM.fbError(e), 'error'); }
  };

  $('btn-start').onclick = async () => {
    const R = S.room;
    if (!Object.keys(R.players).length) {
      if (!confirm('Chưa có học sinh nào trong phòng. Bắt đầu thử với 3 học sinh ảo?')) return;
      await $('btn-bots').onclick();
    }
    R.timeLimit = parseInt($('lobby-time').value, 10) || 20; persistRoom();
    startQuestion(0);
  };

  async function startQuestion(i) {
    const R = S.room, q = R.quiz.questions[i]; if (!q) return;
    try {
      await roomRef().child('state').set({ status: 'question', qIndex: i, qKey: 'q' + i, totalQ: R.quiz.questions.length, timeLimit: R.timeLimit, startedAt: QM.TS(), question: { text: q.question, options: q.options } });
    } catch (e) { QM.toast(QM.fbError(e), 'error'); }
  }

  function setupHostQuestion(st) {
    const R = S.room, q = R.quiz.questions[st.qIndex];
    R.qKey = st.qKey; R.ending = false; R.answers = {}; R.votes = null;
    $('hq-index').textContent = `Câu ${st.qIndex + 1} / ${st.totalQ}`;
    $('hq-text').textContent = q.question;
    $('hq-options').innerHTML = q.options.map((o, i) => `<div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${COLORS[i].cls} font-bold flex items-center justify-between shadow-lg"><div class="flex items-center gap-3"><span class="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center font-black text-sm">${COLORS[i].sym} ${LETTERS[i]}</span><span class="text-base sm:text-lg">${esc(o)}</span></div></div>`).join('');
    showRoomScreen('question'); QM.sound.tone(500, 'sine', .2);
    detachAnswers();
    R.ansRef = roomRef().child('answers/' + st.qKey);
    R.ansRef.on('value', s => { R.answers = s.val() || {}; updateAnswerCount(); });
    clearInterval(R.timer);
    const limit = st.timeLimit || 20;
    const tick = () => {
      const left = limit - (S.fb.now() - st.startedAt) / 1000;
      $('hq-timer').textContent = Math.max(0, Math.ceil(left));
      if (left <= 5 && left > 0) QM.sound.tick();
      if (left <= 0) endQuestion();
    };
    tick(); R.timer = setInterval(tick, 1000);
  }
  function detachAnswers() { const R = S.room; if (R && R.ansRef) { R.ansRef.off(); R.ansRef = null; } }

  function updateAnswerCount() {
    const R = S.room; if (!R || !R.state || R.state.status !== 'question') return;
    const real = Object.entries(R.players).filter(([, p]) => !p.bot).map(([id]) => id);
    const answered = real.filter(id => R.answers[id]).length;
    $('hq-answered').textContent = answered; $('hq-total').textContent = real.length;
    if (real.length > 0 && answered >= real.length && !R.ending) setTimeout(endQuestion, 700);
  }
  $('btn-skip').onclick = endQuestion;

  async function endQuestion() {
    const R = S.room;
    if (!R || R.ending || !R.state || R.state.status !== 'question') return;
    R.ending = true; clearInterval(R.timer);
    const st = R.state, q = R.quiz.questions[st.qIndex], limit = st.timeLimit || 20, base = roomRef();
    try {
      const answers = (await base.child('answers/' + st.qKey).once('value')).val() || {};
      const players = (await base.child('players').once('value')).val() || {};
      const updates = {}, votes = [0, 0, 0, 0];
      Object.keys(players).forEach(id => {
        const p = players[id]; let choice = null, elapsed = limit;
        if (p.bot) { choice = Math.random() < 0.7 ? q.answer : Math.floor(Math.random() * 4); elapsed = 2 + Math.random() * Math.max(1, limit - 4); }
        else if (answers[id] && typeof answers[id].choice === 'number') { choice = answers[id].choice; elapsed = Math.min(limit, Math.max(0, (answers[id].ts - st.startedAt) / 1000)); }
        if (choice !== null) votes[choice]++;
        const ok = choice === q.answer, sb = p.streak || 0;
        const pts = ok ? Math.round(500 + 500 * (1 - elapsed / limit)) + Math.min(sb, 5) * 50 : 0;
        updates[`players/${id}/score`] = (p.score || 0) + pts;
        updates[`players/${id}/streak`] = ok ? sb + 1 : 0;
        updates[`players/${id}/correct`] = (p.correct || 0) + (ok ? 1 : 0);
        updates[`players/${id}/lastPoints`] = pts;
      });
      updates[`reveal/${st.qKey}`] = { answer: q.answer, correctText: q.options[q.answer], explanation: q.explanation || '' };
      updates['state/status'] = 'result';
      R.votes = votes; R.votesKey = st.qKey;
      await base.update(updates);
    } catch (e) { R.ending = false; QM.toast('Lỗi khi chốt câu hỏi: ' + QM.fbError(e), 'error'); }
  }

  async function renderResult(st) {
    const R = S.room, q = R.quiz.questions[st.qIndex];
    $('hr-correct').textContent = `${LETTERS[q.answer]}: ${q.options[q.answer]}`;
    $('hr-exp').textContent = q.explanation || '';
    let votes = R.votesKey === st.qKey ? R.votes : null;
    if (!votes) {
      votes = [0, 0, 0, 0];
      try { const a = (await roomRef().child('answers/' + st.qKey).once('value')).val() || {}; Object.values(a).forEach(x => { if (votes[x.choice] !== undefined) votes[x.choice]++; }); } catch (e) { }
    }
    $('hr-votes').innerHTML = votes.map((v, i) => `<div class="rounded-xl p-2 border ${i === q.answer ? 'border-emerald-500 bg-emerald-950/50' : 'border-slate-800 bg-slate-900'}"><div class="font-bold">${LETTERS[i]} ${i === q.answer ? '✓' : ''}</div><div class="text-lg font-black">${v}</div><div class="text-slate-400">chọn</div></div>`).join('');
    const last = st.qIndex >= st.totalQ - 1;
    $('btn-next').textContent = last ? '🏆 Xem bục vinh danh' : 'Câu tiếp theo ➡️';
    renderBoard(); showRoomScreen('result'); QM.sound.correct();
  }
  const sortedPlayers = () => Object.entries(S.room.players).map(([id, p]) => ({ id, ...p })).sort((a, b) => (b.score || 0) - (a.score || 0));
  function renderBoard() {
    $('hr-board').innerHTML = sortedPlayers().slice(0, 5).map((s, i) => `
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-sm">
        <div class="flex items-center gap-3"><span class="w-6 h-6 rounded-full font-bold flex items-center justify-center text-xs ${i === 0 ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-slate-400'}">${i + 1}</span>
          <span class="text-xl">${esc(s.avatar || '')}</span><span class="font-bold">${esc(s.name || '')}</span>
          ${(s.streak || 0) >= 2 ? `<span class="text-xs px-2 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-700/50">🔥 ${s.streak}</span>` : ''}
          ${s.lastPoints ? `<span class="text-xs text-emerald-400">+${s.lastPoints}</span>` : ''}</div>
        <span class="font-black text-yellow-400 font-mono">${(s.score || 0).toLocaleString()} đ</span></div>`).join('');
  }
  $('btn-next').onclick = async () => {
    const R = S.room, st = R.state; if (!st) return;
    if (st.qIndex >= st.totalQ - 1) { try { await roomRef().child('state/status').set('podium'); } catch (e) { QM.toast(QM.fbError(e), 'error'); } }
    else startQuestion(st.qIndex + 1);
  };

  function renderPodium() {
    const R = S.room, list = sortedPlayers();
    [1, 2, 3].forEach(r => {
      const p = list[r - 1];
      $('pd-name-' + r).textContent = p ? p.name : '-'; $('pd-sc-' + r).textContent = p ? (p.score || 0).toLocaleString() + ' đ' : '';
      if (p) $('pd-av-' + r).textContent = p.avatar || '';
    });
    $('pd-table').innerHTML = list.map((s, i) => `<div class="px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm"><div class="flex items-center gap-2"><span class="w-6 text-center font-bold text-slate-500">#${i + 1}</span><span>${esc(s.avatar || '')}</span><span class="font-bold">${esc(s.name || '')}</span></div><span class="text-slate-400 text-xs">${s.correct || 0}/${R.quiz.questions.length} đúng</span><span class="font-mono font-bold text-yellow-400">${(s.score || 0).toLocaleString()}</span></div>`).join('');
  }
  $('btn-csv').onclick = () => {
    const R = S.room, rows = [['Hạng', 'Tên', 'Điểm', 'Số câu đúng', 'Tổng số câu']];
    sortedPlayers().filter(p => !p.bot).forEach((p, i) => rows.push([i + 1, p.name, p.score || 0, p.correct || 0, R.quiz.questions.length]));
    const csv = '\ufeff' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'bang-diem-' + R.pin + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('btn-replay').onclick = async () => { const q = S.room.quiz; await closeRoom(true); openRoom(q); };
  document.querySelectorAll('.btn-close-room').forEach(b => b.onclick = async () => { if (confirm('Đóng phòng thi? Học sinh sẽ bị thoát khỏi phòng.')) await closeRoom(false); });

  async function closeRoom(silent) {
    const R = S.room; if (!R) return;
    clearInterval(R.timer); R.refs.forEach(r => r.off()); detachAnswers();
    try { await db().ref('rooms/' + R.pin).remove(); } catch (e) { QM.toast('Không xóa được phòng: ' + QM.fbError(e), 'error'); }
    S.room = null; try { localStorage.removeItem('qm_host_room'); } catch (e) { }
    if (!silent) { QM.toast('Đã đóng phòng thi.', 'info'); renderRoomNone(); }
  }

  function renderRoomNone() {
    if (S.room) { const m = { lobby: 'lobby', question: 'question', result: 'result', podium: 'podium' }[S.room.shown] || 'lobby'; showRoomScreen(m); return; }
    showRoomScreen('none');
    $('room-resume').classList.toggle('hidden', !S.resume);
    if (S.resume) $('resume-pin').textContent = S.resume.pin;
  }
  async function checkResumeRoom() {
    try {
      const saved = JSON.parse(localStorage.getItem('qm_host_room') || 'null'); if (!saved || saved.uid !== S.user.uid) return;
      const m = (await db().ref(`rooms/${saved.pin}/meta`).once('value')).val();
      if (!m || m.hostUid !== S.user.uid) { localStorage.removeItem('qm_host_room'); return; }
      S.resume = saved; QM.toast('Phòng ' + saved.pin + ' vẫn đang mở - vào tab Phòng thi để tiếp tục.', 'info');
    } catch (e) { }
  }
  $('btn-resume').onclick = () => { const s = S.resume; S.resume = null; S.room = newRoom(s.pin, s.quiz, s.timeLimit); attachRoom(); setView('room'); };
  $('btn-resume-close').onclick = async () => { const s = S.resume; S.resume = null; try { await db().ref('rooms/' + s.pin).remove(); } catch (e) { } localStorage.removeItem('qm_host_room'); renderRoomNone(); };

  /* ======================= ADMIN: QUẢN LÝ TÀI KHOẢN ======================= */
  async function createAuthUser(email, pw) {
    let app; try { app = firebase.app('secondary'); } catch (e) { app = firebase.initializeApp(CFG.firebase, 'secondary'); }
    const cred = await app.auth().createUserWithEmailAndPassword(email, pw);
    const uid = cred.user.uid; await app.auth().signOut(); return uid;
  }
  let usersCache = {};
  async function loadAdmin() {
    if (!isAdmin()) return;
    if (S.refs.users) S.refs.users.off();
    S.refs.users = db().ref('users');
    S.refs.users.on('value', snap => { usersCache = snap.val() || {}; renderUsers(); }, e => QM.toast(QM.fbError(e), 'error'));
    try { $('ad-auto').checked = (await db().ref('settings/autoApprove').once('value')).val() === true; } catch (e) { }
    loadRooms();
  }
  $('ad-auto').addEventListener('change', async e => { try { await db().ref('settings/autoApprove').set(e.target.checked); QM.toast(e.target.checked ? 'Đã bật tự duyệt đăng ký.' : 'Đã tắt tự duyệt.', 'info'); } catch (x) { QM.toast(QM.fbError(x), 'error'); } });
  function renderUsers() {
    const rows = Object.entries(usersCache).map(([uid, u]) => ({ uid, ...u })).sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || (a.username || '').localeCompare(b.username || ''));
    const badge = { active: 'bg-emerald-950 text-emerald-300 border-emerald-800', pending: 'bg-amber-950 text-amber-300 border-amber-800', locked: 'bg-rose-950 text-rose-300 border-rose-800' };
    const label = { active: 'Đang hoạt động', pending: 'Chờ duyệt', locked: 'Bị khóa' };
    $('ad-table').querySelector('tbody').innerHTML = rows.map(u => {
      const me = u.uid === S.user.uid, a = (act, txt, cls) => `<button class="btn ${cls || 'btn-g'} !py-1 !px-2 !text-[11px]" data-ad="${act}" data-uid="${u.uid}">${txt}</button>`;
      return `<tr><td class="font-mono font-bold">${esc(u.username)}${me ? ' <span class="text-[10px] text-purple-300">(bạn)</span>' : ''}</td><td>${esc(u.displayName || '')}</td>
        <td>${u.role === 'admin' ? '🛡️ Admin' : 'Giáo viên'}</td>
        <td><span class="px-2 py-0.5 rounded-full text-[11px] border ${badge[u.status] || ''}">${label[u.status] || u.status}</span></td>
        <td class="text-slate-400 text-xs">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : ''}</td>
        <td class="space-x-1 whitespace-nowrap">${u.status === 'pending' ? a('approve', 'Duyệt', 'btn-ok') : ''}${!me && u.status === 'active' ? a('lock', 'Khóa') : ''}${!me && u.status === 'locked' ? a('unlock', 'Mở khóa', 'btn-ok') : ''}${!me ? a('role', u.role === 'admin' ? 'Hạ xuống GV' : 'Nâng lên Admin') : ''}${a('reset', 'Đặt lại MK')}${!me ? a('del', 'Xóa', 'btn-r') : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="text-slate-500 italic">Chưa có tài khoản.</td></tr>';
  }
  $('ad-table').addEventListener('click', async e => {
    const b = e.target.closest('[data-ad]'); if (!b) return;
    const uid = b.dataset.uid, u = usersCache[uid]; if (!u) return; const ref = db().ref('users/' + uid);
    try {
      switch (b.dataset.ad) {
        case 'approve': case 'unlock': await ref.update({ status: 'active' }); break;
        case 'lock': if (confirm('Khóa tài khoản @' + u.username + '?')) await ref.update({ status: 'locked' }); break;
        case 'role': { const r = u.role === 'admin' ? 'teacher' : 'admin'; if (confirm(`Đổi vai trò @${u.username} thành ${r === 'admin' ? 'Admin' : 'Giáo viên'}?`)) await ref.update({ role: r }); break; }
        case 'reset': {
          const pw = prompt('Nhập mật khẩu mới (tối thiểu 6 ký tự) cho @' + u.username + ':'); if (!pw) return;
          if (pw.length < 6) return QM.toast('Mật khẩu tối thiểu 6 ký tự.', 'error');
          const email = emailFor(u.username), newUid = await createAuthUser(email, pw);
          const { username, displayName, role, status, createdAt } = u;
          await db().ref('users/' + newUid).set({ username, displayName: displayName || '', role, status, createdAt: createdAt || QM.TS() });
          await db().ref('usernames/' + u.username).set({ email, uid: newUid });
          if (newUid !== uid) await ref.remove();
          QM.toast('Đã đặt lại mật khẩu cho @' + u.username + '. Hãy gửi mật khẩu mới cho thầy/cô đó.', 'success'); break;
        }
        case 'del':
          if (confirm(`Xóa hẳn tài khoản @${u.username} cùng các đề đã lưu của người này?`)) {
            await db().ref('usernames/' + u.username).remove(); await db().ref('quizzes/' + u.username).remove();
            await db().ref('private/' + u.username).remove(); await ref.remove(); QM.toast('Đã xóa tài khoản.', 'success');
          } break;
      }
    } catch (x) { QM.toast(QM.fbError(x), 'error'); }
  });
  $('ad-create').onclick = async () => {
    const u = normUser($('ad-u').value), d = $('ad-d').value.trim(), p = $('ad-p').value, r = $('ad-r').value;
    if (!validUser(u)) return QM.toast('Tên đăng nhập 3-20 ký tự: a-z, 0-9, _', 'error');
    if (!d) return QM.toast('Nhập họ tên.', 'error');
    if (p.length < 6) return QM.toast('Mật khẩu tạm tối thiểu 6 ký tự.', 'error');
    try {
      if ((await db().ref('usernames/' + u).once('value')).exists()) return QM.toast('Tên đăng nhập đã tồn tại.', 'error');
      const email = emailFor(u), uid = await createAuthUser(email, p);
      await db().ref('users/' + uid).set({ username: u, displayName: d, role: r, status: 'active', createdAt: QM.TS() });
      await db().ref('usernames/' + u).set({ email, uid });
      ['ad-u', 'ad-d', 'ad-p'].forEach(i => $(i).value = ''); QM.toast('Đã tạo tài khoản @' + u, 'success');
    } catch (e) { QM.toast(QM.fbError(e), 'error'); }
  };
  async function loadRooms() {
    try {
      const rooms = (await db().ref('rooms').once('value')).val() || {};
      $('ad-rooms').querySelector('tbody').innerHTML = Object.entries(rooms).map(([pin, r]) => { const m = r.meta || {}; return `<tr><td class="font-mono font-bold">${esc(pin)}</td><td>${esc(m.title || '')}</td><td>@${esc(m.hostUsername || '?')}</td><td class="text-xs text-slate-400">${m.createdAt ? new Date(m.createdAt).toLocaleString('vi-VN') : ''}</td><td><button class="btn btn-r !py-1 !px-2 !text-[11px]" data-room="${esc(pin)}">Xóa</button></td></tr>`; }).join('') || '<tr><td colspan="5" class="text-slate-500 italic">Không có phòng nào.</td></tr>';
    } catch (e) { }
  }
  $('ad-rooms-refresh').onclick = loadRooms;
  $('ad-rooms').addEventListener('click', async e => { const b = e.target.closest('[data-room]'); if (!b) return; if (confirm('Xóa phòng ' + b.dataset.room + '?')) { await db().ref('rooms/' + b.dataset.room).remove(); loadRooms(); } });

  window.QMApp = { S, db: () => db(), user: () => S.user, getLibrary: () => libData.slice(), getQuiz: () => S.quiz, callGemini, parseJsonLoose, allBooks, getParsed, setView, setQuiz: q => { setQuiz(q); }, setTopic: t => { $('ai-topic').value = t; topicEdited = true; }, isReady: () => !!S.user };

  /* ======================= KHỞI ĐỘNG ======================= */
  (function init() {
    if (!QM.firebaseReady()) { showScreen('noconfig'); return; }
    S.fb = QM.initFirebase('giaovien', 'local');
    showScreen('auth');
    S.fb.ready.then(() => auth().onAuthStateChanged(u => handleUser(u)));
  })();
})();
