/* Phân tích file SGK (.md) thành Chương -> Bài và trích đúng phạm vi kiến thức. */
(function (root) {
  const SGK = {};

  const partRe = /^\s*#{1,3}\s*(?:\*\*)?\s*(PHẦN|Phần|PART|Part)\s+.+?(?:\*\*)?\s*$/;
  const chapterRe = /^\s{0,1}(?:[-*+]\s+|#{1,4}\s*)?(?:\*\*)?\s*(CHƯƠNG|Chương|CHAPTER|Chapter|CHỦ ĐỀ|Chủ đề)\s+([IVXLCDM]+|\d+)\s*[:.\-–—]?\s*(.*?)\s*(?:\*\*)?\s*$/;
  const lessonRe = /^\s{0,1}(?:[-*+]\s+|#{1,6}\s*)?(?:\*\*)?\s*(Bài|BÀI|Bai|Lesson|Unit|Tiết)\s+(\d+)\s*[:.\-–—]?\s*(.*?)\s*(?:\*\*)?\s*$/;

  const clean = s => (s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  function dedent(lines) {
    let min = Infinity;
    lines.forEach(l => { if (l.trim()) { const m = l.match(/^ */)[0].length; if (m < min) min = m; } });
    if (!isFinite(min)) min = 0;
    return lines.map(l => l.slice(Math.min(min, l.match(/^ */)[0].length)));
  }

  SGK.parseBook = function (md) {
    const lines = String(md || '').replace(/\r/g, '').split('\n');
    const book = { title: '', chapters: [], lessons: [] };
    const t = lines.find(l => /^#\s+/.test(l));
    if (t) book.title = clean(t.replace(/^#\s+/, ''));

    let curPart = '', curChapter = null, curLesson = null, bodyBuf = [];
    const ensureChapter = () => {
      if (!curChapter) {
        curChapter = { id: 'c0', num: '', title: 'Nội dung chung', part: curPart, lessonIds: [] };
        book.chapters.push(curChapter);
      }
    };
    const flush = () => {
      if (curLesson) {
        curLesson.body = dedent(bodyBuf).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        bodyBuf = [];
      }
    };

    for (const line of lines) {
      if (/^\s*(---+|===+)\s*$/.test(line)) continue;
      if (partRe.test(line) && !lessonRe.test(line)) { flush(); curLesson = null; curPart = clean(line.replace(/^\s*#+/, '')); continue; }
      let m = line.match(chapterRe);
      if (m && !(/^\s{2,}/.test(line))) {
        flush(); curLesson = null;
        curChapter = { id: 'c' + (book.chapters.length + 1), num: m[2], title: clean(m[3]) || ('Chương ' + m[2]), part: curPart, lessonIds: [] };
        book.chapters.push(curChapter);
        continue;
      }
      m = line.match(lessonRe);
      if (m) {
        flush(); ensureChapter();
        let id = 'b' + m[2];
        if (book.lessons.some(l => l.id === id)) id += '_' + (book.lessons.length + 1);
        curLesson = { id, num: parseInt(m[2], 10), title: clean(m[3]) || ('Bài ' + m[2]), chapterId: curChapter.id, body: '' };
        book.lessons.push(curLesson);
        curChapter.lessonIds.push(id);
        continue;
      }
      if (curLesson) bodyBuf.push(line);
    }
    flush();

    // Dự phòng: file không có "Bài N" -> tách theo tiêu đề markdown
    if (book.lessons.length === 0) {
      book.chapters = [{ id: 'c0', num: '', title: 'Nội dung chung', part: '', lessonIds: [] }];
      let cur = null, buf = [], n = 0;
      const push = () => { if (cur) { cur.body = dedent(buf).join('\n').trim(); } buf = []; };
      for (const line of lines) {
        const h = line.match(/^#{2,4}\s+(.*)$/);
        if (h) {
          push(); n++;
          cur = { id: 'b' + n, num: n, title: clean(h[1]), chapterId: 'c0', body: '' };
          book.lessons.push(cur); book.chapters[0].lessonIds.push(cur.id);
        } else if (cur) buf.push(line);
      }
      push();
      book.fallback = true;
    }
    book.chapters = book.chapters.filter(c => c.lessonIds.length > 0);
    return book;
  };

  SGK.lessonLabel = l => 'Bài ' + l.num + '. ' + l.title;
  SGK.chapterLabel = c => (c.num ? 'Chương ' + c.num + '. ' : '') + c.title;

  // Trả về đúng nội dung của các bài đã chọn (không lẫn bài khác)
  SGK.buildScope = function (book, lessonIds, supplement) {
    const set = new Set(lessonIds);
    const lessons = book.lessons.filter(l => set.has(l.id));
    const thin = [];
    const parts = lessons.map(l => {
      const ch = book.chapters.find(c => c.id === l.chapterId);
      let txt = '### ' + SGK.lessonLabel(l) + (ch && ch.num ? '  (' + SGK.chapterLabel(ch) + ')' : '') + '\n' + (l.body || '');
      const sup = supplement && supplement[String(l.num)];
      if (sup) txt += '\nTóm tắt bổ sung: ' + sup;
      if ((l.body || '').length + (sup ? sup.length : 0) < 300) thin.push(l);
      return txt;
    });
    const text = parts.join('\n\n');
    return { lessons, text, chars: text.length, thin };
  };

  // Chia chỉ tiêu số câu cho các bài (bài ít hơn số câu -> mỗi bài >= 1 câu)
  SGK.allocate = function (lessons, count) {
    const k = lessons.length, out = {};
    if (!k) return out;
    if (k <= count) {
      const base = Math.floor(count / k), extra = count % k;
      lessons.forEach((l, i) => { out[l.num] = base + (i < extra ? 1 : 0); });
    } else {
      for (let i = 0; i < count; i++) {
        const l = lessons[Math.floor((i * k) / count)];
        out[l.num] = (out[l.num] || 0) + 1;
      }
    }
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SGK;
  else root.SGK = SGK;
})(typeof window !== 'undefined' ? window : this);
