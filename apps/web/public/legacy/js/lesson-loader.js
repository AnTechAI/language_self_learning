/**
 * lesson-loader.js — BÀI HỌC (LESSON) truy xuất theo nhu cầu.
 *
 * tools/build-lessons.js chia english-dictionary.jsonl thành các bài học
 * (mỗi bài 20 từ) trong js/lessons/. App KHÔNG nạp toàn bộ — chỉ khi người
 * dùng chọn 1 bài mới chèn <script> của đúng file bài đó (chạy tốt trên file://).
 *
 * API:
 *   VA.lessonsInit(manifest)          — manifest.js gọi (danh sách bài)
 *   VA.lessonsRegister(file, data)    — file bài học gọi (nộp từ của bài)
 *   VA.ensureLessonsManifest()        — (async) tải manifest nếu chưa có
 *   VA.lessonById(id)                 — thông tin bài (không cần tải dữ liệu)
 *   VA.loadLesson(id)                 — (async) trả {id,title,tag,file,words: rows}
 *   VA.ensureLessonInCourse(lessonId) — (async) gộp từ của bài vào kho KHÓA ĐANG MỞ
 *   VA.lessonWordsInCourse(lessonId)  — số từ của bài đã có trong kho
 *   VA.lessonLearnedCount(lessonId)   — số từ của bài đã học (learning/mastered)
 *
 * Bài học chỉ áp dụng cho khóa TIẾNG ANH (nguồn english-dictionary.jsonl).
 */
(function () {
  const VA = window.VocabApp;

  const lessons = {
    manifest: null,        // [{id,title,file,tag,count}] — từ manifest.js
    loaded: new Map(),     // file -> {tag, words}
    pending: new Map(),    // file -> [resolve, reject]
    manifestPending: null, // promise tải manifest
  };
  VA.lessons = lessons;

  /** manifest.js gọi */
  VA.lessonsInit = function (list) {
    lessons.manifest = Array.isArray(list) ? list : [];
    const p = lessons.manifestPending;
    if (p) { lessons.manifestPending = null; p[0](); }
  };

  /** file bài học gọi: nộp từ của bài */
  VA.lessonsRegister = function (file, data) {
    lessons.loaded.set(file, data || { tag: '', words: [] });
    const p = lessons.pending.get(file);
    if (p) { lessons.pending.delete(file); p[0](); }
  };

  /** Tải manifest.js (chèn <script> động) — nếu chưa từng tải */
  VA.ensureLessonsManifest = function () {
    if (lessons.manifest) return Promise.resolve();
    if (lessons.manifestPending) return new Promise((res, rej) => lessons.manifestPending.push(res, rej));
    return new Promise((resolve, reject) => {
      lessons.manifestPending = [resolve, reject];
      const head = document.head || document.getElementsByTagName('head')[0] || document.body;
      const s = document.createElement('script');
      s.src = 'js/lessons/manifest.js';
      s.onerror = () => { lessons.manifestPending = null; reject(new Error('Không tải được js/lessons/manifest.js — hãy chạy node tools/build-lessons.js')); };
      head.appendChild(s);
    });
  };

  /** Thông tin bài từ manifest (đồng bộ) */
  VA.lessonById = function (id) {
    return (lessons.manifest || []).find((l) => l.id === id) || null;
  };

  function loadLessonFile(file) {
    if (lessons.loaded.has(file)) return Promise.resolve();
    const existing = lessons.pending.get(file);
    if (existing) return new Promise((resolve, reject) => { existing.push(resolve, reject); });
    return new Promise((resolve, reject) => {
      lessons.pending.set(file, [resolve, reject]);
      const head = document.head || document.getElementsByTagName('head')[0] || document.body;
      const s = document.createElement('script');
      s.src = 'js/lessons/' + file;
      s.onerror = () => { lessons.pending.delete(file); reject(new Error('Không tải được js/lessons/' + file)); };
      head.appendChild(s);
    });
  }

  /** Tải đầy đủ 1 bài: manifest + file bài (trả thông tin + từ dạng dòng nén) */
  VA.loadLesson = async function (id) {
    try { await VA.ensureLessonsManifest(); } catch (e) { return null; }
    const meta = VA.lessonById(id);
    if (!meta) return null;
    try { await loadLessonFile(meta.file); } catch (e) { return null; }
    const data = lessons.loaded.get(meta.file) || { tag: '', words: [] };
    return { id: meta.id, title: meta.title, tag: meta.tag, file: meta.file, count: meta.count, words: data.words || [] };
  };

  /** Số từ của bài đã có trong kho hiện tại */
  VA.lessonWordsInCourse = function (lessonId) {
    const meta = VA.lessonById(lessonId);
    if (!meta) return 0;
    const set = new Set(VA.state.entries.map((e) => e.word.toLowerCase()));
    let n = 0;
    const data = lessons.loaded.get(meta.file);
    (data && data.words || []).forEach((r) => { if (set.has(String(r[0] || '').toLowerCase())) n++; });
    return n;
  };

  /** Số từ của bài đã HỌC (learning/mastered) trong kho */
  VA.lessonLearnedCount = function (lessonId) {
    return VA.state.entries.filter((e) => e.lessonId === lessonId && e.learningStatus !== 'new').length;
  };

  /**
   * GỘP TỪ của bài vào kho khóa đang mở (tự động "fetch dữ liệu bài học vào app").
   * Không ghi đè: bỏ qua từ đã có; idempotent. Gắn tags=[chủ đề], lessonId để
   * game/stats lọc chính xác theo bài.
   * @returns {Promise<number>} số từ mới thêm vào
   */
  VA.ensureLessonInCourse = async function (lessonId) {
    const lesson = await VA.loadLesson(lessonId);
    if (!lesson || !lesson.words || !lesson.words.length) return 0;
    const existing = new Set(VA.state.entries.map((e) => e.word.toLowerCase()));
    let added = 0;
    lesson.words.forEach((row) => {
      const w = String(row[0] || '').toLowerCase();
      if (!w || existing.has(w)) return;
      const e = VA.toEntry(row);
      e.tags = [lesson.tag];      // chủ đề bài học
      e.lessonId = lesson.id;     // thuộc bài học (bộ lọc chính xác cho game)
      VA.state.entries.push(e);
      existing.add(w);
      added++;
    });
    if (added) VA.saveEntries(VA.state.entries);
    return added;
  };
})();
