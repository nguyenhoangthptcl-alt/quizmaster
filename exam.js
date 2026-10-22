/* Tạo bộ đề kiểm tra theo Ma trận - Đặc tả (GDPT 2018: Phần I nhiều lựa chọn, Phần II đúng/sai) */
(function () {
  const $ = id => document.getElementById(id);
  const esc = QM.escapeHtml;
  const LV = ['Biết', 'Hiểu', 'Vận dụng'];
  const LETTERS = ['A', 'B', 'C', 'D'];
  const YL = ['a', 'b', 'c', 'd'];
  const MAX_EXAMS = 8;
  const app = () => window.QMApp;

  const E = { bp: newBp(), exams: [], busy: false, cancel: false, diemAuto: true, codesEdited: false, inited: false, steps: { done: 0, total: 0 } };
  function newBp() { return { rows: [] }; }
  const fmt = n => { const v = Math.round(n * 100) / 100; return String(v).replace('.', ','); };
  const clean = t => String(t == null ? '' : t).replace(/\*\*/g, '').replace(/`/g, '').trim();
  const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
  const num = v => { const n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : 0; };

  /* ================= GIAO DIỆN MA TRẬN ================= */
  function metaGet() {
    return { truong: $('ex-truong').value.trim(), to: $('ex-to').value.trim(), kyThi: $('ex-kythi').value.trim(), namHoc: $('ex-namhoc').value.trim(), mon: $('ex-mon').value.trim(), lop: $('ex-lop').value.trim(), thoiGian: parseInt($('ex-time').value, 10) || 45 };
  }
  function metaSave() { try { const m = metaGet(); localStorage.setItem('qm_exam_meta', JSON.stringify({ truong: m.truong, to: m.to, namHoc: m.namHoc })); } catch (e) { } }

  function renderRows() {
    const rows = E.bp.rows;
    const inp = (r, k, i, v) => `<input type="number" min="0" class="inp !px-1 !py-1 text-center w-12" data-r="${r}" data-k="${k}" data-i="${i}" value="${v || 0}">`;
    $('ex-rows').innerHTML = rows.length ? rows.map((r, i) => `<tr>
      <td class="text-center text-slate-500">${i + 1}</td>
      <td><textarea rows="2" class="inp !text-xs min-w-[180px]" data-r="${i}" data-f="noiDung">${esc(r.noiDung)}</textarea></td>
      <td><textarea rows="2" class="inp !text-xs min-w-[220px]" data-r="${i}" data-f="yeuCau">${esc(r.yeuCau)}</textarea></td>
      ${[0, 1, 2].map(j => `<td class="text-center">${inp(i, 'p1', j, r.p1[j])}</td>`).join('')}
      ${[0, 1, 2].map(j => `<td class="text-center">${inp(i, 'p2', j, r.p2[j])}</td>`).join('')}
      <td><button class="text-slate-500 hover:text-rose-400" data-del="${i}" title="Xóa dòng">✕</button></td></tr>`).join('')
      : '<tr><td colspan="10" class="text-slate-500 italic">Chưa có dòng nào. Tải file ma trận để AI phân tích hoặc bấm “Thêm dòng”.</td></tr>';
    updateTotals();
  }

  function totals() {
    const t = { p1: [0, 0, 0], p2: [0, 0, 0] };
    E.bp.rows.forEach(r => { for (let j = 0; j < 3; j++) { t.p1[j] += num(r.p1[j]); t.p2[j] += num(r.p2[j]); } });
    t.n1 = t.p1[0] + t.p1[1] + t.p1[2]; t.y2 = t.p2[0] + t.p2[1] + t.p2[2]; t.n2 = Math.ceil(t.y2 / 4);
    return t;
  }
  function updateTotals() {
    const t = totals();
    $('ex-totals').innerHTML = `<b class="text-white">Phần I:</b> ${t.n1} câu (Biết ${t.p1[0]} • Hiểu ${t.p1[1]} • Vận dụng ${t.p1[2]}) &nbsp;|&nbsp; <b class="text-white">Phần II:</b> ${t.y2} ý ⇒ <b class="text-emerald-300">${t.n2} câu</b> (Biết ${t.p2[0]} • Hiểu ${t.p2[1]} • Vận dụng ${t.p2[2]})` +
      (t.y2 % 4 ? ` <span class="text-amber-300">⚠ Số ý không chia hết cho 4: hệ thống sẽ bổ sung ${4 - (t.y2 % 4)} ý để đủ câu.</span>` : '');
    if (E.diemAuto) { $('ex-d1').value = fmt(t.n1 * 0.25).replace(',', '.'); $('ex-d2').value = fmt(t.n2 * 1).replace(',', '.'); }
    updateScoreInfo(t);
  }
  function updateScoreInfo(t) {
    t = t || totals();
    const d1 = parseFloat($('ex-d1').value) || 0, d2 = parseFloat($('ex-d2').value) || 0;
    const a = t.n1 ? d1 / t.n1 : 0, b = t.n2 ? d2 / t.n2 : 0;
    $('ex-score-info').innerHTML = `Tổng điểm bài: <b class="text-white">${fmt(d1 + d2)}</b> • Mỗi câu Phần I: <b class="text-white">${fmt(a)}</b> điểm • Mỗi câu Phần II tối đa: <b class="text-white">${fmt(b)}</b> điểm` +
      (Math.abs(d1 + d2 - 10) > 0.001 ? ' <span class="text-amber-300">(lưu ý: tổng chưa bằng 10)</span>' : '');
  }
  $('ex-d1').addEventListener('input', () => { E.diemAuto = false; updateScoreInfo(); });
  $('ex-d2').addEventListener('input', () => { E.diemAuto = false; updateScoreInfo(); });

  $('ex-rows').addEventListener('input', e => {
    const t = e.target, r = E.bp.rows[parseInt(t.dataset.r, 10)]; if (!r) return;
    if (t.dataset.f) r[t.dataset.f] = t.value;
    else if (t.dataset.k) { r[t.dataset.k][parseInt(t.dataset.i, 10)] = num(t.value); updateTotals(); }
  });
  $('ex-rows').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { E.bp.rows.splice(parseInt(b.dataset.del, 10), 1); renderRows(); } });
  $('ex-add-row').onclick = () => { E.bp.rows.push({ noiDung: '', yeuCau: '', p1: [0, 0, 0], p2: [0, 0, 0] }); renderRows(); };
  ['ex-truong', 'ex-to', 'ex-namhoc'].forEach(id => $(id).addEventListener('input', metaSave));

  /* ================= ĐỌC FILE MA TRẬN ================= */
  $('ex-file').addEventListener('change', () => { const f = $('ex-file').files[0]; $('ex-filename').textContent = f ? `${f.name} (${Math.round(f.size / 1024)} KB)` : ''; });
  const readAB = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Không đọc được file.')); r.readAsArrayBuffer(f); });
  function b64(ab) { let s = ''; const u = new Uint8Array(ab), n = 0x8000; for (let i = 0; i < u.length; i += n) s += String.fromCharCode.apply(null, u.subarray(i, i + n)); return btoa(s); }

  // HTML (từ mammoth) -> văn bản, giữ cấu trúc bảng (ô gộp được lặp lại để các cột thẳng hàng)
  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html'), out = [];
    const cellText = el => el.textContent.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const tableText = tb => {
      const grid = [], trs = [...tb.querySelectorAll('tr')];
      trs.forEach((tr, ri) => {
        grid[ri] = grid[ri] || []; let ci = 0;
        [...tr.children].filter(c => /^(td|th)$/i.test(c.tagName)).forEach(c => {
          while (grid[ri][ci] !== undefined) ci++;
          const txt = cellText(c), cs = Math.max(1, parseInt(c.getAttribute('colspan') || '1', 10)), rs = Math.max(1, parseInt(c.getAttribute('rowspan') || '1', 10));
          for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) { grid[ri + dr] = grid[ri + dr] || []; grid[ri + dr][ci + dc] = txt; }
          ci += cs;
        });
      });
      return '[BẢNG]\n' + grid.map(r => '| ' + r.map(x => x === undefined ? '' : x).join(' | ') + ' |').join('\n') + '\n[HẾT BẢNG]';
    };
    [...doc.body.children].forEach(el => {
      if (/^table$/i.test(el.tagName)) out.push(tableText(el));
      else if (/^(ul|ol)$/i.test(el.tagName)) [...el.querySelectorAll('li')].forEach(li => out.push('- ' + cellText(li)));
      else { const t = cellText(el); if (t) out.push(t); }
    });
    return out.join('\n');
  }

  function analyzePrompt(text) {
    return `Bạn là chuyên gia khảo thí của Việt Nam. ${text ? 'Dưới đây là nội dung' : 'File đính kèm là'} MA TRẬN và BẢN ĐẶC TẢ đề kiểm tra theo Chương trình giáo dục phổ thông 2018 (thường là bảng nhiều cột). Hãy đọc kỹ và trích xuất thành JSON.

Cấu trúc đề theo GDPT 2018: PHẦN I - trắc nghiệm nhiều phương án lựa chọn (4 phương án, 1 đáp án đúng); PHẦN II - trắc nghiệm đúng/sai (mỗi câu có 4 ý a, b, c, d, mỗi ý đúng hoặc sai). Nếu ma trận có dạng khác (tự luận, trả lời ngắn...), bỏ qua dạng đó và ghi chú trong "ghiChu".

QUY TẮC:
- Mỗi dòng ma trận (một nội dung/đơn vị kiến thức) là một phần tử trong "dong".
- "p1" = SỐ CÂU Phần I theo mức nhận thức: biet, hieu, vandung (mức "Vận dụng cao" gộp vào vandung).
- "p2" = SỐ Ý (nhận định) của Phần II theo mức: biet, hieu, vandung. Nếu ma trận ghi số CÂU Phần II thì nhân 4 để ra số ý và phân mức theo mức ghi trong ma trận.
- "yeuCau": tóm tắt yêu cầu cần đạt (từ bản đặc tả) cho dòng đó, tối đa 400 ký tự, giữ đúng động từ mức độ (nêu được, giải thích được, vận dụng được...).
- Không bịa số liệu. Không có thì để 0 hoặc null.
- "phan1Diem", "phan2Diem" là tổng điểm của từng phần nếu ma trận có ghi.

CHỈ trả về JSON hợp lệ theo mẫu:
{"tenDe":"Kiểm tra giữa học kì I","monHoc":"Công nghệ","lop":"12","thoiGian":45,"phan1Diem":6,"phan2Diem":4,"ghiChu":"",
 "dong":[{"chuDe":"Chương I...","noiDung":"Bài 3...","yeuCau":"...","p1":{"biet":2,"hieu":1,"vandung":0},"p2":{"biet":1,"hieu":2,"vandung":1}}]}
${text ? '\n===== NỘI DUNG FILE =====\n' + text.slice(0, 120000) + '\n===== HẾT =====' : ''}`;
  }

  async function analyze() {
    if (E.busy) return;
    const a = app(); if (!a || !a.S.geminiKey) return QM.toast('Cần nhập Gemini API key ở tab Cài đặt trước.', 'error');
    const f = $('ex-file').files[0]; if (!f) return QM.toast('Hãy chọn file ma trận (.docx hoặc .pdf).', 'error');
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ext === 'doc') return QM.toast('File .doc đời cũ chưa đọc được trực tiếp. Thầy mở bằng Word, chọn Lưu thành (Save As) → định dạng .docx hoặc PDF rồi tải lên lại.', 'error');
    if (!['docx', 'pdf'].includes(ext)) return QM.toast('Chỉ hỗ trợ file .docx hoặc .pdf.', 'error');
    if (f.size > 15 * 1024 * 1024) return QM.toast('File quá lớn (tối đa 15 MB).', 'error');
    setBusy(true, 'Đang đọc file...');
    try {
      let parts = [], text = '';
      const ab = await readAB(f);
      if (ext === 'pdf') parts = [{ inline_data: { mime_type: 'application/pdf', data: b64(ab) } }];
      else {
        if (!window.mammoth) throw new Error('Thiếu thư viện đọc Word (vendor/mammoth.browser.min.js).');
        const r = await mammoth.convertToHtml({ arrayBuffer: ab });
        text = htmlToText(r.value);
        if (text.trim().length < 30) throw new Error('Không đọc được nội dung từ file Word này.');
      }
      $('ex-analyze-status').textContent = 'AI đang đọc ma trận và đặc tả...';
      const raw = await a.callGemini(analyzePrompt(text), { parts, retry: true, onWait: s => { $('ex-analyze-status').textContent = `Máy chủ AI đang bận, tự thử lại sau ${s} giây...`; } });
      applyAnalysis(a.parseJsonLoose(raw));
    } catch (e) { QM.toast(e.message, 'error'); $('ex-analyze-status').textContent = ''; }
    finally { setBusy(false); }
  }

  function applyAnalysis(o) {
    const rows = (o.dong || []).map(d => {
      const g = (x, k) => num(x && (x[k] !== undefined ? x[k] : x[k === 'vandung' ? 'vanDung' : k]));
      return {
        noiDung: clean([d.chuDe, d.noiDung].filter(Boolean).join(' – ')), yeuCau: clean(d.yeuCau),
        p1: [g(d.p1, 'biet'), g(d.p1, 'hieu'), g(d.p1, 'vandung')], p2: [g(d.p2, 'biet'), g(d.p2, 'hieu'), g(d.p2, 'vandung')]
      };
    }).filter(r => r.p1.some(x => x) || r.p2.some(x => x));
    if (!rows.length) throw new Error('AI không tìm thấy dòng ma trận hợp lệ. Thầy kiểm tra file hoặc nhập ma trận thủ công.');
    E.bp.rows = rows;
    if (o.monHoc) $('ex-mon').value = clean(o.monHoc);
    if (o.lop) $('ex-lop').value = clean(String(o.lop)).replace(/^lớp\s*/i, '');
    if (o.tenDe && !$('ex-kythi').value) $('ex-kythi').value = clean(o.tenDe);
    if (num(o.thoiGian)) $('ex-time').value = num(o.thoiGian);
    const d1 = parseFloat(o.phan1Diem), d2 = parseFloat(o.phan2Diem);
    if (d1 > 0 && d2 > 0) { E.diemAuto = false; $('ex-d1').value = d1; $('ex-d2').value = d2; } else E.diemAuto = true;
    renderRows();
    $('ex-analyze-status').textContent = `✅ Đã nhận diện ${rows.length} dòng ma trận. Thầy kiểm tra, chỉnh sửa số liệu ở Bước 2.` + (o.ghiChu ? ' Ghi chú của AI: ' + clean(o.ghiChu) : '');
    QM.toast('Đã phân tích ma trận. Hãy kiểm tra lại bảng ở Bước 2.', 'success');
    $('ex-step2').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('ex-btn-analyze').onclick = analyze;
  $('ex-btn-manual').onclick = () => { if (!E.bp.rows.length) E.bp.rows.push({ noiDung: '', yeuCau: '', p1: [0, 0, 0], p2: [0, 0, 0] }); renderRows(); $('ex-step2').scrollIntoView({ behavior: 'smooth' }); };

  function setBusy(b, msg) {
    E.busy = b;
    ['ex-btn-analyze', 'ex-btn-gen'].forEach(id => { $(id).disabled = b; });
    $('ex-btn-cancel').classList.toggle('hidden', !(b && E.steps.total > 0));
    if (msg !== undefined) $('ex-analyze-status').textContent = msg;
  }

  /* ================= TẠO ĐỀ ================= */
  const getCodes = () => {
    let c = $('ex-codes').value.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    c = c.filter((x, i) => c.indexOf(x) === i).slice(0, MAX_EXAMS);
    return c;
  };
  function autoCodes() {
    if (E.codesEdited) return;
    const n = Math.min(MAX_EXAMS, Math.max(1, parseInt($('ex-count').value, 10) || 1));
    $('ex-codes').value = Array.from({ length: n }, (_, i) => 101 + i).join(', ');
  }
  $('ex-count').addEventListener('input', () => { autoCodes(); });
  $('ex-codes').addEventListener('input', () => { E.codesEdited = true; const c = getCodes(); if (c.length) $('ex-count').value = c.length; });

  // Tạo các "vị trí" cần soạn đúng theo ma trận
  function buildSlots(rows) {
    const p1 = [], ys = [];
    rows.forEach((r, ri) => { for (let lv = 0; lv < 3; lv++) { for (let k = 0; k < num(r.p1[lv]); k++) p1.push({ row: ri, lv }); for (let k = 0; k < num(r.p2[lv]); k++) ys.push({ row: ri, lv }); } });
    p1.forEach((s, i) => { s.n = i + 1; });
    while (ys.length % 4 && ys.length) ys.push({ ...ys[ys.length - 1], padded: true });
    const p2 = chunk(ys, 4).map((g, i) => ({ n: i + 1, ys: g.slice().sort((x, y) => x.lv - y.lv) }));
    return { p1, p2 };
  }
  const rowLabel = (rows, i) => { const r = rows[i] || {}; return `${clean(r.noiDung) || 'Nội dung ' + (i + 1)}${r.yeuCau ? ' | Yêu cầu cần đạt: ' + clean(r.yeuCau) : ''}`; };

  function commonRules(ctx) {
    return `QUY TẮC CHUNG:
- Soạn theo Chương trình giáo dục phổ thông 2018, kiến thức chính xác, đúng thuật ngữ, không bịa số liệu/tiêu chuẩn.
- Mức nhận thức: Biết = nhận biết, nêu, gọi tên, nhớ lại; Hiểu = giải thích, so sánh, phân biệt, suy luận trực tiếp; Vận dụng = áp dụng vào tình huống thực tiễn, tính toán, giải quyết vấn đề. Mỗi vị trí phải ĐÚNG mức đã ghi và bám đúng "Yêu cầu cần đạt".
- Đây là đề thứ ${ctx.k + 1}/${ctx.total} (mã đề ${ctx.code}) của một bộ đề cùng ma trận: nội dung câu hỏi phải KHÁC các đề khác (khác bối cảnh, số liệu, ví dụ, cách hỏi) nhưng tương đương về nội dung kiểm tra và độ khó.
- Không dùng LaTeX hay markdown. Công thức viết bằng văn bản/Unicode (ví dụ: U = I.R, x², √3, π, Δ).
${ctx.prev && ctx.prev.length ? '- KHÔNG lặp lại ý/câu sau đây (đã dùng ở đề khác hoặc đoạn trước):\n' + ctx.prev.slice(-60).map(s => '   • ' + s).join('\n') : ''}
${ctx.ref ? '- Tài liệu tham chiếu (ưu tiên bám sát, không mâu thuẫn):\n<TAI_LIEU>\n' + ctx.ref + '\n</TAI_LIEU>' : ''}
${ctx.note ? '- Yêu cầu bổ sung của giáo viên: ' + ctx.note : ''}`;
  }

  function p1Prompt(bp, slots, ctx) {
    return `Bạn là giáo viên ${ctx.meta.mon || ''} lớp ${ctx.meta.lop || ''} đang soạn đề kiểm tra.
NHIỆM VỤ: soạn PHẦN I - câu trắc nghiệm nhiều phương án lựa chọn (4 phương án A, B, C, D; chỉ 1 đáp án đúng) cho các vị trí sau:

${slots.map(s => `Câu ${s.n}: [Mức ${LV[s.lv]}] Nội dung: ${rowLabel(bp.rows, s.row)}`).join('\n')}

${commonRules(ctx)}
- Phương án nhiễu hợp lí, độ dài các phương án tương đương; KHÔNG dùng "cả A và B đúng", "tất cả đều đúng/sai".
- "giaiThich": hướng dẫn chấm chi tiết 2-4 câu: vì sao đáp án đúng, các phương án còn lại sai ở đâu.

CHỈ trả về JSON hợp lệ (phuongAn không có chữ A., B. ở đầu; "so" là số câu như trên):
{"cau":[{"so":1,"cauHoi":"...","phuongAn":["...","...","...","..."],"dapAn":"A","giaiThich":"..."}]}`;
  }
  function p2Prompt(bp, slots, ctx) {
    return `Bạn là giáo viên ${ctx.meta.mon || ''} lớp ${ctx.meta.lop || ''} đang soạn đề kiểm tra.
NHIỆM VỤ: soạn PHẦN II - câu trắc nghiệm đúng/sai theo GDPT 2018. Mỗi câu gồm một "dẫn" chung (đoạn thông tin, tình huống, số liệu, mô tả sơ đồ/bảng bằng văn bản) và 4 ý a), b), c), d); mỗi ý là một nhận định mà thí sinh phải chọn ĐÚNG hoặc SAI. Các vị trí cần soạn:

${slots.map(s => `Câu ${s.n}: ` + s.ys.map((y, j) => `ý ${YL[j]}) [Mức ${LV[y.lv]}] Nội dung: ${rowLabel(bp.rows, y.row)}`).join('\n   ')).join('\n')}

${commonRules(ctx)}
- Dẫn phải phù hợp với cả 4 ý của câu. Ý a→d xếp theo đúng thứ tự và mức độ như trên.
- Mỗi ý là mệnh đề khẳng định rõ ràng, kết luận được Đúng hoặc Sai dứt khoát (không mơ hồ). Mỗi câu nên có cả ý đúng và ý sai.
- "giaiThich" của từng ý: nêu căn cứ; nếu ý sai thì nêu mệnh đề đúng sửa lại.

CHỈ trả về JSON hợp lệ:
{"cau":[{"so":1,"dan":"...","y":[{"noiDung":"...","dung":true,"giaiThich":"..."},{"noiDung":"...","dung":false,"giaiThich":"..."},{"noiDung":"...","dung":true,"giaiThich":"..."},{"noiDung":"...","dung":false,"giaiThich":"..."}]}]}`;
  }

  function normP1(r) {
    if (!r || typeof r.cauHoi !== 'string' || !Array.isArray(r.phuongAn) || r.phuongAn.length < 4) return null;
    const o = r.phuongAn.slice(0, 4).map(x => clean(x).replace(/^\s*[A-Da-d][.):]\s+/, ''));
    if (o.some(x => !x) || new Set(o.map(x => x.toLowerCase())).size < 4) return null;
    let a = r.dapAn; if (typeof a === 'string') { const L = a.trim().toUpperCase().charAt(0); a = LETTERS.includes(L) ? LETTERS.indexOf(L) : parseInt(a, 10); }
    if (!Number.isInteger(a) || a < 0 || a > 3) return null;
    return { cauHoi: clean(r.cauHoi), phuongAn: o, dapAn: a, giaiThich: clean(r.giaiThich) };
  }
  function normP2(r) {
    if (!r || typeof r.dan !== 'string' || !Array.isArray(r.y) || r.y.length < 4) return null;
    const ys = r.y.slice(0, 4).map(y => {
      if (!y || typeof y.noiDung !== 'string') return null;
      let d = y.dung; if (typeof d === 'string') d = /^(đ|d|true|đúng|dung)/i.test(d.trim());
      if (typeof d !== 'boolean') return null;
      return { noiDung: clean(y.noiDung).replace(/^\s*[a-dA-D][.)]\s+/, ''), dung: d, giaiThich: clean(y.giaiThich) };
    });
    if (ys.some(y => !y)) return null;
    return { dan: clean(r.dan), y: ys };
  }

  // Gọi AI cho một nhóm vị trí; tự thử lại phần còn thiếu
  async function genChunk(kind, bp, slots, ctx) {
    const a = app(), got = {}, norm = kind === 1 ? normP1 : normP2;
    let todo = slots.slice();
    for (let attempt = 0; attempt < 3 && todo.length && !E.cancel; attempt++) {
      const prompt = (kind === 1 ? p1Prompt : p2Prompt)(bp, todo, ctx);
      const raw = a.parseJsonLoose(await a.callGemini(prompt, { retry: true, onWait: s => setProg(null, `Máy chủ AI đang bận, tự thử lại sau ${s} giây (tiến trình vẫn được giữ)...`) }));
      const list = Array.isArray(raw) ? raw : (raw.cau || raw.questions || []);
      list.forEach((r, idx) => {
        let s = todo.find(x => x.n === parseInt(r && r.so, 10)) || todo[idx];
        if (!s || got[s.n]) return;
        const v = norm(r); if (v) got[s.n] = { slot: s, ...v };
      });
      todo = todo.filter(s => !got[s.n]);
    }
    return { got, missing: todo };
  }

  function balanceAnswers(items) {
    const n = items.length, target = [];
    for (let i = 0; i < n; i++) target.push(i % 4);
    const t = QM.shuffle(target);
    items.forEach((q, i) => { const to = t[i]; if (q.dapAn !== to) { const o = q.phuongAn.slice(); [o[q.dapAn], o[to]] = [o[to], o[q.dapAn]]; q.phuongAn = o; q.dapAn = to; } });
  }

  async function genOneExam(bp, slots, code, k, total, prevExams, opt) {
    const prev = [];
    prevExams.forEach(ex => { ex.p1.forEach(q => prev.push(q.cauHoi.slice(0, 80))); ex.p2.forEach(c => prev.push(c.dan.slice(0, 80))); });
    const exam = { code, p1: [], p2: [], warnings: [] };
    const base = { k, total, code, meta: opt.meta, ref: opt.ref, note: opt.note };
    for (const g of chunk(slots.p1, 12)) {
      if (E.cancel) break;
      setProg(null, `Mã đề ${code}: đang soạn Phần I (câu ${g[0].n}–${g[g.length - 1].n})...`);
      const { got, missing } = await genChunk(1, bp, g, { ...base, prev: prev.concat(exam.p1.map(q => q.cauHoi.slice(0, 80))) });
      g.forEach(s => { const q = got[s.n]; if (q) exam.p1.push({ cauHoi: q.cauHoi, phuongAn: q.phuongAn, dapAn: q.dapAn, giaiThich: q.giaiThich, row: s.row, lv: s.lv }); });
      if (missing.length) exam.warnings.push(`Phần I: thiếu ${missing.length} câu (câu ${missing.map(m => m.n).join(', ')}) do AI chưa soạn được.`);
      step();
    }
    for (const g of chunk(slots.p2, 4)) {
      if (E.cancel) break;
      setProg(null, `Mã đề ${code}: đang soạn Phần II (câu ${g[0].n}–${g[g.length - 1].n})...`);
      const { got, missing } = await genChunk(2, bp, g, { ...base, prev: prev.concat(exam.p2.map(c => c.dan.slice(0, 80))) });
      g.forEach(s => { const c = got[s.n]; if (c) exam.p2.push({ dan: c.dan, y: c.y.map((y, j) => ({ ...y, row: s.ys[j].row, lv: s.ys[j].lv })) }); });
      if (missing.length) exam.warnings.push(`Phần II: thiếu ${missing.length} câu do AI chưa soạn được.`);
      step();
    }
    balanceAnswers(exam.p1);
    return exam;
  }

  function permuteExam(base, code) {
    const p1 = QM.shuffle(base.p1).map(q => { const ok = q.phuongAn[q.dapAn], o = QM.shuffle(q.phuongAn); return { ...q, phuongAn: o, dapAn: o.indexOf(ok) }; });
    const p2 = QM.shuffle(base.p2).map(c => ({ ...c, y: QM.shuffle(c.y) }));
    return { code, p1, p2, warnings: base.warnings.slice() };
  }

  function setProg(pct, text) {
    if (pct !== null && pct !== undefined) $('ex-bar').style.width = pct + '%';
    if (text) $('ex-prog-text').textContent = text;
  }
  function step() { E.steps.done++; setProg(Math.min(100, Math.round(E.steps.done / E.steps.total * 100))); }

  function collectBlueprint() {
    const rows = E.bp.rows.map(r => ({ noiDung: clean(r.noiDung), yeuCau: clean(r.yeuCau), p1: r.p1.map(num), p2: r.p2.map(num) })).filter(r => r.p1.some(x => x) || r.p2.some(x => x));
    return { rows };
  }

  async function generateAll() {
    if (E.busy) return;
    const a = app(); if (!a || !a.S.geminiKey) return QM.toast('Cần nhập Gemini API key ở tab Cài đặt trước.', 'error');
    const bp = collectBlueprint(), t = totals();
    if (!bp.rows.length || (t.n1 + t.y2) === 0) return QM.toast('Ma trận đang trống. Hãy tải file ma trận hoặc nhập số câu ở Bước 2.', 'error');
    const codes = getCodes(); if (!codes.length) return QM.toast('Hãy nhập ít nhất một mã đề.', 'error');
    const d1 = parseFloat($('ex-d1').value), d2 = parseFloat($('ex-d2').value);
    if (!(d1 >= 0) || !(d2 >= 0)) return QM.toast('Điểm Phần I / Phần II không hợp lệ.', 'error');
    const mode = document.querySelector('input[name="ex-mode"]:checked').value;
    const meta = metaGet(); metaSave();
    let ref = '';
    const refId = $('ex-ref').value;
    if (refId) {
      try { const b = a.allBooks().find(x => x.id === refId), p = await a.getParsed(b); ref = SGK.buildScope(p.parsed, p.parsed.lessons.map(l => l.id), p.supplement).text.slice(0, 60000); } catch (e) { }
    }
    const slots = buildSlots(bp.rows);
    const perExam = chunk(slots.p1, 12).length + chunk(slots.p2, 4).length;
    E.steps = { done: 0, total: perExam * (mode === 'permute' ? 1 : codes.length) }; E.cancel = false;
    $('ex-progress').classList.remove('hidden'); setProg(0, 'Bắt đầu...');
    setBusy(true);
    const exams = [], opt = { meta, ref, note: $('ex-note').value.trim() };
    try {
      for (let k = 0; k < codes.length; k++) {
        if (E.cancel) break;
        if (mode === 'permute' && k > 0) { exams.push(permuteExam(exams[0], codes[k])); continue; }
        exams.push(await genOneExam(bp, slots, codes[k], k, codes.length, exams, opt));
      }
      if (E.cancel) QM.toast('Đã dừng. Giữ lại các đề đã tạo xong.', 'info');
    } catch (e) { QM.toast('Dừng giữa chừng: ' + e.message + (exams.length ? ' (đã giữ lại ' + exams.length + ' đề tạo xong)' : ''), 'error'); }
    finally { setBusy(false); $('ex-progress').classList.add('hidden'); }
    const ok = exams.filter(x => x.p1.length || x.p2.length);
    if (!ok.length) return;
    E.exams = ok; E.result = { bp, meta, d1, d2, mode, created: Date.now() };
    persist(); renderResults(); QM.sound.cheer();
    QM.toast(`Đã tạo ${ok.length} mã đề. Thầy xem lại và tải về ở Bước 4.`, 'success');
    $('ex-step4').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('ex-btn-gen').onclick = generateAll;
  $('ex-btn-cancel').onclick = () => { E.cancel = true; $('ex-prog-text').textContent = 'Đang dừng sau bước hiện tại...'; };

  /* ================= LƯU / KHÔI PHỤC ================= */
  function persist() { try { localStorage.setItem('qm_exam_last', JSON.stringify({ exams: E.exams, result: E.result })); } catch (e) { } }
  function checkRestore() {
    if (E.exams.length) { $('ex-restore').classList.add('hidden'); return; }
    try {
      const s = JSON.parse(localStorage.getItem('qm_exam_last') || 'null');
      if (s && s.exams && s.exams.length) { $('ex-restore').classList.remove('hidden'); $('ex-restore-info').textContent = `${s.exams.length} mã đề (${s.exams.map(e => e.code).join(', ')}) tạo lúc ${new Date(s.result.created).toLocaleString('vi-VN')}`; }
    } catch (e) { }
  }
  $('ex-restore-btn').onclick = () => {
    try {
      const s = JSON.parse(localStorage.getItem('qm_exam_last'));
      E.exams = s.exams; E.result = s.result; E.bp.rows = s.result.bp.rows.map(r => ({ ...r }));
      const m = s.result.meta || {}; $('ex-truong').value = m.truong || ''; $('ex-to').value = m.to || ''; $('ex-kythi').value = m.kyThi || ''; $('ex-namhoc').value = m.namHoc || ''; $('ex-mon').value = m.mon || ''; $('ex-lop').value = m.lop || ''; $('ex-time').value = m.thoiGian || 45;
      E.diemAuto = false; $('ex-d1').value = s.result.d1; $('ex-d2').value = s.result.d2;
      renderRows(); renderResults(); $('ex-restore').classList.add('hidden');
    } catch (e) { QM.toast('Không khôi phục được.', 'error'); }
  };

  /* ================= KẾT QUẢ ================= */
  function counts(ex, bp) {
    const n = bp.rows.length, c = bp.rows.map(() => ({ p1: [0, 0, 0], p2: [0, 0, 0] }));
    ex.p1.forEach(q => { if (c[q.row]) c[q.row].p1[q.lv]++; });
    ex.p2.forEach(cau => cau.y.forEach(y => { if (c[y.row] && !y.padded) c[y.row].p2[y.lv]++; }));
    return c;
  }
  function renderResults() {
    const card = $('ex-result-card');
    if (!E.exams.length) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const R = E.result;
    $('ex-results').innerHTML = E.exams.map((ex, i) => {
      const nT = ex.p2.reduce((s, c) => s + c.y.filter(y => y.dung).length, 0), nAll = ex.p2.length * 4;
      return `<div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div><div class="font-bold text-white text-base">Mã đề ${esc(ex.code)}</div>
            <div class="text-xs text-slate-400">Phần I: ${ex.p1.length} câu • Phần II: ${ex.p2.length} câu (${nT}/${nAll} ý đúng)</div></div>
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-ok" data-ex="de" data-i="${i}">⬇️ Đề (Word)</button>
            <button class="btn btn-p" data-ex="key" data-i="${i}">⬇️ Đáp án + HD chấm (Word)</button>
            <button class="btn btn-g" data-ex="live" data-i="${i}" title="Đưa các câu Phần I sang phòng thi trực tuyến">🚀 Phần I → phòng thi</button>
          </div></div>
        ${ex.warnings.length ? `<div class="text-xs text-amber-300 bg-amber-950/40 border border-amber-700/40 rounded-lg p-2">⚠️ ${ex.warnings.map(esc).join(' ')}</div>` : ''}
        <details><summary class="cursor-pointer text-xs font-semibold text-slate-300 select-none">👁 Xem trước nội dung đề và đáp án</summary><div class="mt-3 space-y-3 text-sm">${previewHtml(ex)}</div></details>
      </div>`;
    }).join('');
    // đối chiếu ma trận
    const ex0 = E.exams[0], bp = R.bp, cs = counts(ex0, bp), tt = [0, 0, 0, 0, 0, 0], ts = [0, 0, 0, 0, 0, 0];
    const rowsHtml = bp.rows.map((r, i) => {
      const a = cs[i], vals = [...a.p1, ...a.p2], spec = [...r.p1, ...r.p2];
      vals.forEach((v, j) => { tt[j] += v; ts[j] += spec[j]; });
      return `<tr><td class="text-xs">${esc(r.noiDung)}</td>${vals.map((v, j) => `<td class="text-center ${v === spec[j] ? 'text-emerald-300' : 'text-amber-300 font-bold'}">${v}/${spec[j]}</td>`).join('')}</tr>`;
    }).join('');
    $('ex-compare').innerHTML = `<table class="w-full"><thead><tr><th>Nội dung</th><th>P.I Biết</th><th>P.I Hiểu</th><th>P.I VD</th><th>P.II Biết</th><th>P.II Hiểu</th><th>P.II VD</th></tr></thead><tbody>${rowsHtml}<tr class="font-bold"><td>Tổng</td>${tt.map((v, j) => `<td class="text-center">${v}/${ts[j]}</td>`).join('')}</tr></tbody></table><p class="text-[11px] text-slate-500 mt-1">Số liệu dạng “thực tế đề / theo ma trận” (Phần II tính theo số ý), đối chiếu với mã đề ${esc(ex0.code)}.</p>`;
  }
  function previewHtml(ex) {
    const p1 = ex.p1.map((q, i) => `<div><div class="font-semibold text-slate-100">Câu ${i + 1}. <span class="text-[10px] px-1 rounded bg-purple-950 text-purple-300 border border-purple-800">${LV[q.lv]}</span> ${esc(q.cauHoi)}</div>
      <div class="grid sm:grid-cols-2 gap-x-4 text-xs pl-3">${q.phuongAn.map((o, j) => `<div class="${j === q.dapAn ? 'text-emerald-300 font-bold' : 'text-slate-300'}">${LETTERS[j]}. ${esc(o)}${j === q.dapAn ? ' ✓' : ''}</div>`).join('')}</div>
      <div class="text-[11px] text-slate-400 italic pl-3">💡 ${esc(q.giaiThich)}</div></div>`).join('');
    const p2 = ex.p2.map((c, i) => `<div><div class="font-semibold text-slate-100">Câu ${i + 1}. ${esc(c.dan)}</div>
      ${c.y.map((y, j) => `<div class="text-xs pl-3"><span class="${y.dung ? 'text-emerald-300' : 'text-rose-300'} font-bold">${YL[j]}) [${y.dung ? 'Đúng' : 'Sai'}]</span> <span class="text-[10px] text-purple-300">${LV[y.lv]}</span> ${esc(y.noiDung)}<div class="text-[11px] text-slate-400 italic pl-3">💡 ${esc(y.giaiThich)}</div></div>`).join('')}</div>`).join('');
    return (p1 ? '<div class="font-bold text-purple-300">PHẦN I</div>' + p1 : '') + (p2 ? '<div class="font-bold text-purple-300 pt-2">PHẦN II</div>' + p2 : '');
  }

  /* ================= XUẤT WORD ================= */
  const FONT = 'Times New Roman', SZ = 26;
  function D() { if (!window.docx) throw new Error('Thiếu thư viện tạo Word (vendor/docx.iife.js).'); return window.docx; }
  const noB = () => { const n = { style: D().BorderStyle.NONE, size: 0, color: 'FFFFFF' }; return { top: n, bottom: n, left: n, right: n }; };
  const lineB = (c) => { const n = { style: D().BorderStyle.SINGLE, size: 4, color: c || '000000' }; return { top: n, bottom: n, left: n, right: n }; };
  const tr = (text, o) => new (D().TextRun)({ text, font: FONT, size: SZ, ...(o || {}) });
  function P(text, o) { o = o || {}; return new (D().Paragraph)({ spacing: { after: o.after === undefined ? 80 : o.after, line: 300 }, alignment: o.align, indent: o.indent, keepNext: o.keepNext, children: Array.isArray(text) ? text : [tr(text, o.run)] }); }
  const paras = (text, o) => String(text).split(/\n+/).filter(s => s.trim()).map((s, i) => P(s.trim(), i ? { ...o, indent: o && o.indent } : o));
  function cellX(children, w, o) { o = o || {}; return new (D().TableCell)({ width: { size: w, type: D().WidthType.DXA }, borders: o.noBorder ? noB() : lineB(), shading: o.fill ? { type: D().ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, margins: { top: 50, bottom: 50, left: 90, right: 90 }, verticalAlign: D().VerticalAlign.CENTER, children }); }
  const W = 9638;

  function header(R, ex, title) {
    const m = R.meta, d = D();
    const L = [];
    L.push(P((m.to ? '' : '') + (m.truong || 'TRƯỜNG ......................').toUpperCase(), { run: { bold: true }, align: d.AlignmentType.CENTER, after: 20 }));
    if (m.to) L.push(P(m.to, { align: d.AlignmentType.CENTER, after: 20 }));
    L.push(P('—————', { align: d.AlignmentType.CENTER, after: 0 }));
    const Rr = [];
    Rr.push(P((m.kyThi || title).toUpperCase(), { run: { bold: true }, align: d.AlignmentType.CENTER, after: 20 }));
    if (m.namHoc) Rr.push(P('Năm học: ' + m.namHoc, { align: d.AlignmentType.CENTER, after: 20 }));
    Rr.push(P(`Môn: ${m.mon || '.......'} – Lớp ${m.lop || '...'}`, { run: { bold: true }, align: d.AlignmentType.CENTER, after: 20 }));
    Rr.push(P(`Thời gian làm bài: ${m.thoiGian} phút`, { align: d.AlignmentType.CENTER, after: 20, run: { italics: true } }));
    return new d.Table({ width: { size: W, type: d.WidthType.DXA }, columnWidths: [4300, 5338], rows: [new d.TableRow({ children: [cellX(L, 4300, { noBorder: true }), cellX(Rr, 5338, { noBorder: true })] })] });
  }

  function optionParas(q) {
    const d = D(), o = q.phuongAn, mx = Math.max(...o.map(x => x.length));
    if (mx <= 12) return [new d.Paragraph({ spacing: { after: 60 }, indent: { left: 340 }, tabStops: [0, 1, 2, 3].slice(1).map(i => ({ type: d.TabStopType.LEFT, position: 340 + i * 2330 })), children: [tr(`A. ${o[0]}`), ...[1, 2, 3].flatMap(i => [new d.TextRun({ children: [new d.Tab()], font: FONT, size: SZ }), tr(`${LETTERS[i]}. ${o[i]}`)])] })];
    if (mx <= 32) return [0, 2].map(i => new d.Paragraph({ spacing: { after: 40 }, indent: { left: 340 }, tabStops: [{ type: d.TabStopType.LEFT, position: 340 + 4400 }], children: [tr(`${LETTERS[i]}. ${o[i]}`), new d.TextRun({ children: [new d.Tab()], font: FONT, size: SZ }), tr(`${LETTERS[i + 1]}. ${o[i + 1]}`)] }));
    return o.map((x, i) => new d.Paragraph({ spacing: { after: 40 }, indent: { left: 340, hanging: 0 }, children: [tr(`${LETTERS[i]}. ${x}`)] }));
  }

  async function examBlob(ex) {
    const d = D(), R = E.result, t = { n1: ex.p1.length, n2: ex.p2.length };
    const pt1 = t.n1 ? R.d1 / t.n1 : 0, pt2 = t.n2 ? R.d2 / t.n2 : 0;
    const body = [header(R, ex, 'ĐỀ KIỂM TRA'), P('', { after: 60 })];
    body.push(P([tr('Mã đề: ', { bold: true }), tr(String(ex.code), { bold: true, size: 30 })], { align: d.AlignmentType.RIGHT, after: 60 }));
    body.push(P('Họ và tên: ................................................................  Lớp: ..............  SBD: ............', { after: 140 }));
    if (t.n1) {
      body.push(P([tr('PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. ', { bold: true }), tr(`(${fmt(R.d1)} điểm)`, { italics: true })], { keepNext: true, after: 40 }));
      body.push(P(`Thí sinh trả lời từ câu 1 đến câu ${t.n1}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.`, { run: { italics: true }, keepNext: true, after: 100 }));
      ex.p1.forEach((q, i) => {
        const ps = paras(q.cauHoi);
        body.push(new d.Paragraph({ spacing: { after: 40, line: 300 }, keepNext: true, children: [tr(`Câu ${i + 1}. `, { bold: true }), tr(ps.length ? String(q.cauHoi).split(/\n+/)[0].trim() : '')] }));
        String(q.cauHoi).split(/\n+/).slice(1).filter(s => s.trim()).forEach(s => body.push(P(s.trim(), { keepNext: true, after: 40 })));
        optionParas(q).forEach((p, k, a) => body.push(p));
        body.push(P('', { after: 40 }));
      });
    }
    if (t.n2) {
      body.push(P([tr('PHẦN II. Câu trắc nghiệm đúng sai. ', { bold: true }), tr(`(${fmt(R.d2)} điểm)`, { italics: true })], { keepNext: true, after: 40 }));
      body.push(P(`Thí sinh trả lời từ câu 1 đến câu ${t.n2}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`, { run: { italics: true }, keepNext: true, after: 100 }));
      ex.p2.forEach((c, i) => {
        const lines = String(c.dan).split(/\n+/).filter(s => s.trim());
        body.push(new d.Paragraph({ spacing: { after: 40, line: 300 }, keepNext: true, children: [tr(`Câu ${i + 1}. `, { bold: true }), tr(lines[0] || '')] }));
        lines.slice(1).forEach(s => body.push(P(s.trim(), { keepNext: true, after: 40 })));
        c.y.forEach((y, j) => body.push(new d.Paragraph({ spacing: { after: 40, line: 300 }, indent: { left: 340 }, keepNext: j < 3, children: [tr(`${YL[j]}) ${y.noiDung}`)] })));
        body.push(P('', { after: 40 }));
      });
    }
    body.push(P('------------ HẾT ------------', { align: d.AlignmentType.CENTER, run: { bold: true }, after: 40 }));
    body.push(P('Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.', { align: d.AlignmentType.CENTER, run: { italics: true, size: 22 } }));
    const doc = new d.Document({
      creator: 'AI QuizMaster', title: `Đề kiểm tra mã ${ex.code}`, styles: { default: { document: { run: { font: FONT, size: SZ } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ text: `Mã đề ${ex.code} – Trang `, font: FONT, size: 22 }), new d.TextRun({ children: [d.PageNumber.CURRENT], font: FONT, size: 22 }), new d.TextRun({ text: '/', font: FONT, size: 22 }), new d.TextRun({ children: [d.PageNumber.TOTAL_PAGES], font: FONT, size: 22 })] })] }) },
        children: body
      }]
    });
    return d.Packer.toBlob(doc);
  }

  async function keyBlob(ex) {
    const d = D(), R = E.result, t = { n1: ex.p1.length, n2: ex.p2.length };
    const pt1 = t.n1 ? R.d1 / t.n1 : 0, pt2 = t.n2 ? R.d2 / t.n2 : 0;
    const B = [header(R, ex, 'KIỂM TRA'), P('', { after: 60 })];
    B.push(P(`ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM – MÃ ĐỀ ${ex.code}`, { run: { bold: true, size: 30 }, align: d.AlignmentType.CENTER, after: 120 }));
    const H = s => P(s, { run: { bold: true }, keepNext: true, after: 80 });
    B.push(H('A. HƯỚNG DẪN CHUNG VÀ THANG ĐIỂM'));
    B.push(P(`– Tổng điểm toàn bài: ${fmt(R.d1 + R.d2)} điểm.`));
    if (t.n1) B.push(P(`– Phần I (${t.n1} câu trắc nghiệm nhiều phương án lựa chọn): mỗi câu trả lời đúng được ${fmt(pt1)} điểm; tổng ${fmt(R.d1)} điểm.`));
    if (t.n2) {
      B.push(P(`– Phần II (${t.n2} câu trắc nghiệm đúng sai, mỗi câu 4 ý): điểm tối đa mỗi câu là ${fmt(pt2)} điểm; tổng ${fmt(R.d2)} điểm. Điểm của mỗi câu được tính theo số ý trả lời đúng:`));
      B.push(new d.Table({ width: { size: 7200, type: d.WidthType.DXA }, columnWidths: [3600, 3600], rows: [
        new d.TableRow({ children: [cellX([P('Số ý trả lời đúng', { run: { bold: true }, after: 0 })], 3600, { fill: 'E5E7EB' }), cellX([P('Điểm của câu', { run: { bold: true }, after: 0 })], 3600, { fill: 'E5E7EB' })] }),
        ...[[1, .1], [2, .25], [3, .5], [4, 1]].map(([k, f]) => new d.TableRow({ children: [cellX([P(`${k} ý`, { after: 0 })], 3600), cellX([P(`${fmt(pt2 * f)} điểm`, { after: 0 })], 3600)] }))
      ] }));
      B.push(P('', { after: 40 }));
    }
    B.push(P('– Điểm toàn bài là tổng điểm các câu, làm tròn đến hai chữ số thập phân. Thí sinh làm cách khác đúng vẫn cho điểm tối đa (nếu có).'));
    B.push(H('B. ĐÁP ÁN'));
    if (t.n1) {
      B.push(P('Phần I', { run: { bold: true, italics: true }, keepNext: true, after: 60 }));
      chunk(ex.p1.map((q, i) => ({ n: i + 1, a: LETTERS[q.dapAn] })), 10).forEach(g => {
        const cw = [1238, ...Array(10).fill(840)];
        const mk = (label, key, fill) => new d.TableRow({ cantSplit: true, children: [cellX([P(label, { run: { bold: true }, align: d.AlignmentType.CENTER, after: 0 })], cw[0], { fill }), ...Array.from({ length: 10 }, (_, i) => cellX([P(g[i] ? String(g[i][key]) : '', { align: d.AlignmentType.CENTER, after: 0, run: key === 'a' ? { bold: true } : undefined })], cw[i + 1], { fill: fill }))] });
        B.push(new d.Table({ width: { size: W, type: d.WidthType.DXA }, columnWidths: cw, rows: [mk('Câu', 'n', 'F3F4F6'), mk('Đáp án', 'a')] })); B.push(P('', { after: 40 }));
      });
    }
    if (t.n2) {
      B.push(P('Phần II (Đ: đúng; S: sai)', { run: { bold: true, italics: true }, keepNext: true, after: 60 }));
      const cw = [1638, 2000, 2000, 2000, 2000];
      B.push(new d.Table({ width: { size: W, type: d.WidthType.DXA }, columnWidths: cw, rows: [
        new d.TableRow({ tableHeader: true, children: ['Câu', 'Ý a)', 'Ý b)', 'Ý c)', 'Ý d)'].map((h, i) => cellX([P(h, { run: { bold: true }, align: d.AlignmentType.CENTER, after: 0 })], cw[i], { fill: 'F3F4F6' })) }),
        ...ex.p2.map((c, i) => new d.TableRow({ cantSplit: true, children: [cellX([P(String(i + 1), { align: d.AlignmentType.CENTER, after: 0, run: { bold: true } })], cw[0]), ...c.y.map((y, j) => cellX([P(y.dung ? 'Đ' : 'S', { align: d.AlignmentType.CENTER, after: 0, run: { bold: true } })], cw[j + 1]))] }))
      ] })); B.push(P('', { after: 60 }));
    }
    B.push(H('C. HƯỚNG DẪN CHẤM VÀ LỜI GIẢI CHI TIẾT'));
    const rows = R.bp.rows;
    if (t.n1) {
      B.push(P('Phần I', { run: { bold: true, italics: true }, keepNext: true, after: 60 }));
      ex.p1.forEach((q, i) => {
        B.push(new d.Paragraph({ spacing: { after: 30, line: 290 }, keepNext: true, children: [tr(`Câu ${i + 1}. `, { bold: true }), tr(`[${LV[q.lv]}] `, { italics: true, size: 22 }), tr(String(q.cauHoi).replace(/\n+/g, ' '))] }));
        B.push(new d.Paragraph({ spacing: { after: 30, line: 290 }, indent: { left: 340 }, keepNext: true, children: [tr(`Đáp án: ${LETTERS[q.dapAn]}. `, { bold: true }), tr(q.phuongAn[q.dapAn])] }));
        B.push(P(`Hướng dẫn: ${q.giaiThich}`, { indent: { left: 340 }, after: 90, run: { size: 24 } }));
      });
    }
    if (t.n2) {
      B.push(P('Phần II', { run: { bold: true, italics: true }, keepNext: true, after: 60 }));
      ex.p2.forEach((c, i) => {
        B.push(new d.Paragraph({ spacing: { after: 30, line: 290 }, keepNext: true, children: [tr(`Câu ${i + 1}. `, { bold: true }), tr(String(c.dan).replace(/\n+/g, ' '))] }));
        c.y.forEach((y, j) => {
          B.push(new d.Paragraph({ spacing: { after: 20, line: 290 }, indent: { left: 340 }, keepNext: true, children: [tr(`${YL[j]}) `, { bold: true }), tr(y.noiDung + ' '), tr(`→ ${y.dung ? 'ĐÚNG' : 'SAI'}`, { bold: true }), tr(` [${LV[y.lv]}]`, { italics: true, size: 22 })] }));
          B.push(P(`Giải thích: ${y.giaiThich}`, { indent: { left: 680 }, after: 50, run: { size: 24 } }));
        });
        B.push(P('', { after: 40 }));
      });
    }
    // Đối chiếu ma trận
    const cs = counts(ex, R.bp);
    B.push(H('D. ĐỐI CHIẾU VỚI MA TRẬN'));
    const cw = [3000, 1106, 1106, 1106, 1106, 1106, 1108], tt = [0, 0, 0, 0, 0, 0], ts = [0, 0, 0, 0, 0, 0];
    const mkRow = (name, vals, spec, bold) => new d.TableRow({ cantSplit: true, children: [cellX([P(name, { after: 0, run: { size: 22, bold } })], cw[0]), ...vals.map((v, j) => cellX([P(`${v}/${spec[j]}`, { align: d.AlignmentType.CENTER, after: 0, run: { size: 22, bold: bold || v !== spec[j] } })], cw[j + 1]))] });
    const body = rows.map((r, i) => { const vals = [...cs[i].p1, ...cs[i].p2], spec = [...r.p1, ...r.p2]; vals.forEach((v, j) => { tt[j] += v; ts[j] += spec[j]; }); return mkRow(r.noiDung || 'Nội dung ' + (i + 1), vals, spec); });
    B.push(new d.Table({ width: { size: W, type: d.WidthType.DXA }, columnWidths: cw, rows: [
      new d.TableRow({ tableHeader: true, children: ['Nội dung', 'P.I Biết', 'P.I Hiểu', 'P.I VD', 'P.II Biết', 'P.II Hiểu', 'P.II VD'].map((h, i) => cellX([P(h, { run: { bold: true, size: 20 }, align: d.AlignmentType.CENTER, after: 0 })], cw[i], { fill: 'F3F4F6' })) }),
      ...body, mkRow('Tổng', tt, ts, true)
    ] }));
    B.push(P('Số liệu dạng “thực tế đề / theo ma trận”; Phần II tính theo số ý.', { run: { italics: true, size: 22 }, after: 40 }));
    const doc = new d.Document({
      creator: 'AI QuizMaster', title: `Đáp án mã đề ${ex.code}`, styles: { default: { document: { run: { font: FONT, size: SZ } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ text: `Đáp án mã đề ${ex.code} – Trang `, font: FONT, size: 22 }), new d.TextRun({ children: [d.PageNumber.CURRENT], font: FONT, size: 22 })] })] }) },
        children: B
      }]
    });
    return d.Packer.toBlob(doc);
  }

  function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const fname = (kind, ex) => `${kind}_${(E.result.meta.mon || 'KT').replace(/[^\p{L}\p{N}]+/gu, '')}_MaDe_${String(ex.code).replace(/[^\w-]+/g, '')}.docx`;

  $('ex-results').addEventListener('click', async e => {
    const b = e.target.closest('[data-ex]'); if (!b) return;
    const ex = E.exams[parseInt(b.dataset.i, 10)]; if (!ex) return;
    try {
      if (b.dataset.ex === 'de') save(await examBlob(ex), fname('De', ex));
      else if (b.dataset.ex === 'key') save(await keyBlob(ex), fname('DapAn', ex));
      else if (b.dataset.ex === 'live') {
        const qs = ex.p1.map(q => ({ question: q.cauHoi, options: q.phuongAn.slice(), answer: q.dapAn, explanation: q.giaiThich }));
        if (!qs.length) return QM.toast('Mã đề này không có Phần I.', 'error');
        const a = app(); a.setQuiz({ title: `${E.result.meta.kyThi || 'Đề kiểm tra'} - Mã ${ex.code} (Phần I)`, subject: E.result.meta.mon || '', grade: E.result.meta.lop ? 'Lớp ' + E.result.meta.lop : '', scopeLabel: 'Đề theo ma trận', questions: qs });
        a.setTopic(`${E.result.meta.kyThi || 'Đề kiểm tra'} - Mã ${ex.code}`); a.setView('create');
        QM.toast('Đã đưa Phần I sang tab Tạo đề. Thầy bấm “Mở phòng thi” để cho học sinh thi trực tuyến.', 'success');
      }
    } catch (err) { QM.toast(err.message, 'error'); }
  });
  $('ex-btn-zip').onclick = async () => {
    if (!E.exams.length) return;
    if (!window.JSZip) return QM.toast('Thiếu thư viện nén (vendor/jszip.min.js).', 'error');
    $('ex-btn-zip').disabled = true; $('ex-btn-zip').textContent = 'Đang nén...';
    try {
      const z = new JSZip();
      for (const ex of E.exams) { z.file(fname('De', ex), await examBlob(ex)); z.file(fname('DapAn', ex), await keyBlob(ex)); }
      save(await z.generateAsync({ type: 'blob' }), `Bo_de_${(E.result.meta.mon || 'KT').replace(/[^\p{L}\p{N}]+/gu, '')}_${E.exams.length}_ma_de.zip`);
    } catch (e) { QM.toast(e.message, 'error'); }
    finally { $('ex-btn-zip').disabled = false; $('ex-btn-zip').textContent = '📦 Tải tất cả (ZIP)'; }
  };

  /* ================= KHỞI TẠO ================= */
  function init() {
    if (E.inited) return; E.inited = true;
    try { const m = JSON.parse(localStorage.getItem('qm_exam_meta') || '{}'); $('ex-truong').value = m.truong || ''; $('ex-to').value = m.to || ''; $('ex-namhoc').value = m.namHoc || ''; } catch (e) { }
    if (!$('ex-namhoc').value) { const y = new Date().getFullYear(), mo = new Date().getMonth(); $('ex-namhoc').value = mo >= 7 ? `${y} – ${y + 1}` : `${y - 1} – ${y}`; }
    autoCodes(); renderRows();
  }
  function fillRef() {
    const a = app(); if (!a) return;
    const cur = $('ex-ref').value;
    $('ex-ref').innerHTML = '<option value="">(Không dùng - AI tự dựa vào yêu cầu cần đạt)</option>' + a.allBooks().map(b => `<option value="${esc(b.id)}">${esc(b.subject)} ${esc(b.grade)} - ${esc(b.title)}</option>`).join('');
    $('ex-ref').value = cur;
  }
  window.QMExam = { onShow() { init(); fillRef(); checkRestore(); $('ex-key-warn').classList.toggle('hidden', !!(app() && app().S.geminiKey)); }, _E: E, _t: { buildSlots, htmlToText, normP1, normP2, balanceAnswers, permuteExam, examBlob, keyBlob, applyAnalysis, generateAll, analyze } };
})();
