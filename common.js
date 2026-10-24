/* Hàm dùng chung cho trang học sinh (index.html) và trang giáo viên (giaovien.html) */
(function () {
  const QM = (window.QM = {});

  QM.escapeHtml = function (str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  QM.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- Toast ----------
  QM.toast = function (msg, type) {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      c.className = 'fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(c);
    }
    const colors = {
      success: 'bg-emerald-600 border-emerald-500', error: 'bg-rose-600 border-rose-500',
      info: 'bg-purple-600 border-purple-500'
    };
    const t = document.createElement('div');
    t.className = 'px-4 py-3 rounded-xl shadow-2xl border text-xs sm:text-sm font-semibold text-white flex items-center gap-2 transition-all duration-300 translate-y-4 opacity-0 pointer-events-auto max-w-xs ' + (colors[type] || colors.info);
    t.innerHTML = '<span>🔔</span><span>' + QM.escapeHtml(msg) + '</span>';
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.remove('translate-y-4', 'opacity-0'));
    setTimeout(() => { t.classList.add('opacity-0'); setTimeout(() => t.remove(), 300); }, 4000);
  };

  // ---------- Âm thanh (Web Audio) ----------
  class SoundFX {
    constructor() { this.ctx = null; this.isMuted = false; }
    tone(freq, type, dur, gain) {
      if (this.isMuted) return;
      try {
        if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(gain || 0.1, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + (dur || 0.15));
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + (dur || 0.15));
      } catch (e) { /* bỏ qua */ }
    }
    correct() { this.tone(523.25, 'triangle', .12, .15); setTimeout(() => this.tone(659.25, 'triangle', .12, .15), 100); setTimeout(() => this.tone(783.99, 'triangle', .25, .2), 200); }
    wrong() { this.tone(220, 'sawtooth', .2, .15); setTimeout(() => this.tone(180, 'sawtooth', .3, .15), 150); }
    tick() { this.tone(880, 'sine', .04, .05); }
    cheer() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', .3, .15), i * 120)); }
  }
  QM.sound = new SoundFX();


  // ---------- Chấm bài giao (dùng chung cho trang học sinh và trang giáo viên) ----------
  QM.arr = function (v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.keys(v).sort((a, b) => a - b).map(k => v[k]);
    return [];
  };
  // qs: [{t:'mcq'|'tf'}]; key: [{a: chỉ số đáp án | [4 boolean]}]; ans: {q0: số | "TFT-"}
  // Câu đúng/sai: đúng 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100% (trọng số wTf, mặc định bằng 4 câu nhiều lựa chọn)
  QM.scoreAssign = function (qs, key, ans, opt) {
    opt = opt || {}; ans = ans || {}; const wTf = opt.wTf || 4;
    let earned = 0, max = 0, nOk = 0; const detail = [];
    qs.forEach((q, i) => {
      const k = key[i] || {}, a = ans['q' + i];
      if (opt.onlyAnswered && a === undefined) { detail.push(null); return; }
      if (q.t === 'tf') {
        max += wTf; const str = typeof a === 'string' ? a : '', ka = QM.arr(k.a); let c = 0;
        for (let j = 0; j < 4; j++) { const ch = str.charAt(j); if ((ch === 'T' && ka[j] === true) || (ch === 'F' && ka[j] === false)) c++; }
        const f = [0, 0.1, 0.25, 0.5, 1][c]; earned += wTf * f; if (c === 4) nOk++;
        detail.push({ type: 'tf', c, f });
      } else {
        max += 1; const ok = a !== undefined && a === k.a; if (ok) { earned += 1; nOk++; }
        detail.push({ type: 'mcq', ok });
      }
    });
    return { earned, max, score10: max ? Math.round(earned / max * 1000) / 100 : 0, nOk, detail };
  };

  // ---------- Firebase ----------
  QM.firebaseReady = function () {
    const c = (window.QM_CONFIG || {}).firebase || {};
    return !!(c.apiKey && c.databaseURL && c.projectId);
  };

  // appName: 'giaovien' (mặc định) hoặc 'student'. persistence: 'local' | 'session'
  QM.initFirebase = function (appName, persistence) {
    if (!QM.firebaseReady() || !window.firebase) return null;
    const cfg = QM_CONFIG.firebase;
    let app;
    try { app = firebase.app(appName); } catch (e) { app = firebase.initializeApp(cfg, appName); }
    const auth = app.auth();
    const p = persistence === 'session' ? firebase.auth.Auth.Persistence.SESSION : firebase.auth.Auth.Persistence.LOCAL;
    const ready = auth.setPersistence(p).catch(() => {});
    const db = app.database();
    const fb = { app, auth, db, ready, offset: 0 };
    db.ref('.info/serverTimeOffset').on('value', s => { fb.offset = s.val() || 0; });
    fb.now = () => Date.now() + fb.offset;
    return fb;
  };

  QM.TS = function () { return firebase.database.ServerValue.TIMESTAMP; };

  QM.fbError = function (e) {
    const code = (e && e.code) || '';
    const map = {
      'auth/operation-not-allowed': 'Chưa bật phương thức đăng nhập trong Firebase (xem HUONG_DAN.md, Bước 1.3).',
      'auth/admin-restricted-operation': 'Chưa bật đăng nhập Ẩn danh (Anonymous) trong Firebase (HUONG_DAN.md, Bước 1.3).',
      'auth/email-already-in-use': 'Tên đăng nhập này đã tồn tại.',
      'auth/weak-password': 'Mật khẩu quá yếu (tối thiểu 6 ký tự).',
      'auth/wrong-password': 'Sai mật khẩu.',
      'auth/invalid-credential': 'Sai tên đăng nhập hoặc mật khẩu.',
      'auth/user-not-found': 'Không tìm thấy tài khoản.',
      'auth/too-many-requests': 'Thử quá nhiều lần, vui lòng đợi vài phút rồi thử lại.',
      'auth/network-request-failed': 'Mất kết nối mạng.',
      'PERMISSION_DENIED': 'Không đủ quyền (kiểm tra đã dán firebase-rules.json vào Firebase chưa).'
    };
    if (map[code]) return map[code];
    if (e && /permission_denied/i.test(e.message || '')) return map.PERMISSION_DENIED;
    return (e && e.message) || 'Lỗi không xác định';
  };
})();
