/**
 * course.js — ★ Lớp khóa học (thay thế khái niệm "cặp ngôn ngữ" cũ).
 *
 * Mô hình: 1 người học tiếng Việt học nhiều NGÔN NGỮ (Anh, Trung…).
 *  - Mỗi khóa học = 1 ngôn ngữ nguồn (source) đang HỌC → bản dịch tiếng Việt (target).
 *  - Mỗi khóa có DATABASE riêng (course_en_*, course_zh_*), streak, lịch sử riêng.
 *  - Giao diện đổi màu sắc + nhãn theo khóa đang mở (body[data-course=…]).
 *  - Màn hình chọn khóa: VA.course.current === null → renderPicker().
 */
(function () {
  const VA = window.VocabApp;

  /** Khóa học hiện tại (null = đang ở màn hình CHỌN KHÓA HỌC) */
  VA.course = { current: null };

  /** Danh sách khóa học (từ config) */
  VA.courses = function () {
    return VA.config.courses || [];
  };

  /** Tìm khóa học theo id */
  VA.courseById = function (id) {
    return (VA.config.courses || []).find((c) => c.id === id) || null;
  };

  /** Khóa học đang mở (null nếu ở màn chọn khóa) */
  VA.getCourse = function () {
    return VA.courseById(VA.course.current);
  };

  /**
   * Nghĩa của 1 sense theo khóa học đang mở.
   * @returns { source, target } — source: nghĩa ngôn ngữ nguồn (nếu có), target: nghĩa tiếng Việt
   */
  VA.meaning = function (sense) {
    const m = (sense && sense.meaning) || {};
    const c = VA.getCourse();
    if (!c) return { source: '', target: '' };
    return { source: m[c.source.code] || '', target: m[c.target.code] || '' };
  };

  /** Entry có bản dịch tiếng Việt (đích) chưa — dùng để lọc khi học / chơi game */
  VA.hasTarget = function (entry) {
    const c = VA.getCourse();
    if (!c) return false;
    return (entry.senses || []).some((s) => (s.meaning || {})[c.target.code]);
  };

  /** Nhãn hướng dịch: "Việt → Anh" hay "Anh → Việt" tùy hướng */
  VA.directionLabel = function (toSource) {
    const c = VA.getCourse();
    if (!c) return '';
    return toSource
      ? c.target.label + ' → ' + c.source.label
      : c.source.label + ' → ' + c.target.label;
  };

  /**
   * Chuẩn hóa pinyin (bỏ dấu thanh, bỏ khoảng trắng) để so khớp đáp án.
   * "nǐ hǎo" → "nihao" (khóa tiếng Trung: chấp nhận cả gõ pinyin không dấu).
   */
  const TONE = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'u', 'ǘ': 'u', 'ǚ': 'u', 'ǜ': 'u', 'ü': 'u',
  };
  VA.normPinyin = function (str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, (ch) => TONE[ch] || ch)
      .replace(/[^a-z]/g, '');
  };
})();
