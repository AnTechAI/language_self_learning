/**
 * storage.js — Lớp lưu trữ (localStorage), scoped theo KHÓA HỌC.
 *
 * Mỗi khóa học (en, zh…) có DATABASE RIÊNG:
 *   course_{id}_entries  — kho từ vựng
 *   course_{id}_daily    — nhật ký số từ học mỗi ngày (quota + streak)
 *   course_{id}_history  — lịch sử chơi game
 * Cài đặt toàn cục (khóa đang mở) ở vocab_settings_v1.
 *
 * Kèm migrate dữ liệu CŨ (từ app phiên bản trước) vào khóa "en" — copy, không xóa:
 *   - vocab_entries_v1 / vocab_entries_v2 → course_en_entries
 *   - vocab_daily_v2 → course_en_daily, vocab_history_v2 → course_en_history
 *   - schema cũ definitionEN/definitionVI → meaning map {en, vi, …}
 */
(function () {
  const VA = window.VocabApp;

  function read(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  /* ---------- Khóa lưu trữ theo khóa học ---------- */
  VA.courseKeys = function (courseId) {
    const id = courseId || (VA.course && VA.course.current) || 'en';
    const prefix = (VA.courseById(id) || {}).storagePrefix || ('course_' + id);
    return { entries: prefix + '_entries', daily: prefix + '_daily', history: prefix + '_history' };
  };
  VA.currentKeys = function () {
    return VA.courseKeys(VA.course && VA.course.current);
  };

  /* ---------- Entries ---------- */
  VA.loadEntries = function () { return read(VA.currentKeys().entries, []); };
  VA.saveEntries = function (list) { write(VA.currentKeys().entries, list); };
  VA.loadEntriesFor = function (cid) { return read(VA.courseKeys(cid).entries, []); };
  VA.saveEntriesFor = function (cid, list) { write(VA.courseKeys(cid).entries, list); };

  /* ---------- Daily (số từ đã học từng ngày) ---------- */
  VA.loadDaily = function () { return read(VA.currentKeys().daily, {}); };
  VA.saveDaily = function (obj) { write(VA.currentKeys().daily, obj); };
  VA.loadDailyFor = function (cid) { return read(VA.courseKeys(cid).daily, {}); };
  VA.saveDailyFor = function (cid, obj) { write(VA.courseKeys(cid).daily, obj); };

  /* ---------- History (lịch sử chơi game) ---------- */
  VA.loadHistory = function () { return read(VA.currentKeys().history, []); };
  VA.saveHistory = function (list) { write(VA.currentKeys().history, list.slice(-800)); };
  VA.loadHistoryFor = function (cid) { return read(VA.courseKeys(cid).history, []); };

  /* ---------- Settings (toàn cục) ---------- */
  VA.loadSettings = function () {
    try { return JSON.parse(localStorage.getItem(VA.config.settingsKey)) || {}; } catch (e) { return {}; }
  };
  VA.saveSettings = function (obj) {
    localStorage.setItem(VA.config.settingsKey, JSON.stringify(obj));
  };

  /**
   * Chuẩn hóa shape 1 entry về dạng mới:
   *   sense.meaning = { en:'…', vi:'…' }  (thay cho definitionEN/definitionVI)
   * Giữ nguyên mọi dữ liệu khác, không làm mất gì.
   */
  VA.normalizeEntryShape = function (e) {
    if (!e || typeof e !== 'object') return null;
    if (!e.senses || !e.senses.length) {
      e.senses = [{ pronunciation: '', partOfSpeech: '', meaning: { en: '', vi: '' }, examples: [] }];
    }
    e.senses = e.senses.map((s) => {
      if (s.meaning && typeof s.meaning === 'object') {
        return { pronunciation: s.pronunciation || '', partOfSpeech: s.partOfSpeech || '', meaning: s.meaning || {}, examples: s.examples || [] };
      }
      // Schema cũ: definitionEN / definitionVI
      const meaning = {};
      if (s.definitionEN !== undefined) meaning.en = s.definitionEN;
      if (s.definitionVI !== undefined) meaning.vi = s.definitionVI;
      return { pronunciation: s.pronunciation || '', partOfSpeech: s.partOfSpeech || '', meaning, examples: s.examples || [] };
    });
    e.synonyms = e.synonyms || [];
    e.antonyms = e.antonyms || [];
    e.tags = e.tags || [];
    e.wordRoot = e.wordRoot || '';
    e.correctStreak = e.correctStreak || 0;
    return e;
  };

  /**
   * Migrate dữ liệu CŨ vào khóa học (chạy 1 lần khi lần đầu mở khóa):
   *  - Khóa en: nếu course_en_* chưa tồn tại, COPY dữ liệu cũ (v1/v2, daily, history) sang.
   *  - Khóa khác (zh…): database mới trống → bắt đầu từ seed.
   * Trả về entries đã nạp (có thể rỗng).
   */
  VA.importLegacy = function (courseId) {
    const cid = courseId || 'en';
    const ks = VA.courseKeys(cid);
    let entries = read(ks.entries, null);
    if (entries !== null) return entries; // khóa đã có dữ liệu → không đụng vào

    entries = [];
    if (cid === 'en') {
      // Dữ liệu app cũ (schema cũ v2) → copy sang khóa en
      try {
        const old = localStorage.getItem('vocab_entries_v2');
        if (old) {
          const p = JSON.parse(old);
          if (Array.isArray(p) && p.length) entries = p;
        }
      } catch (e) { /* ignore */ }
      // Còn cũ hơn nữa: v1
      if (!entries.length) {
        try {
          const old = localStorage.getItem('vocab_entries_v1');
          if (old) {
            const p = JSON.parse(old);
            if (Array.isArray(p) && p.length) entries = p;
          }
        } catch (e) { /* ignore */ }
      }
      // daily + history cũ
      try { if (!localStorage.getItem(ks.daily) && localStorage.getItem('vocab_daily_v2')) localStorage.setItem(ks.daily, localStorage.getItem('vocab_daily_v2')); } catch (e) {}
      try { if (!localStorage.getItem(ks.history) && localStorage.getItem('vocab_history_v2')) localStorage.setItem(ks.history, localStorage.getItem('vocab_history_v2')); } catch (e) {}
      if (entries.length) write(ks.entries, entries);
    }
    return entries;
  };

  /**
   * Chuẩn hóa shape mọi entry (đảm bảo meaning map).
   * @returns { entries, changed }
   */
  VA.migrate = function (entries) {
    let changed = false;
    entries = entries.map((e) => {
      const before = JSON.stringify(e);
      const fixed = VA.normalizeEntryShape(e);
      if (JSON.stringify(fixed) !== before) changed = true;
      return fixed;
    }).filter(Boolean);
    return { entries, changed };
  };
})();
