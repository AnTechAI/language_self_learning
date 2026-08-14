/**
 * utils.js — Hàm tiện ích dùng chung cho mọi component.
 */
(function () {
  const VA = (window.VocabApp = window.VocabApp || {});

  /** Truy vấn 1 phần tử */
  VA.$ = (s) => document.querySelector(s);

  /** Truy vấn mảng phần tử */
  VA.$$ = (s) => Array.from(document.querySelectorAll(s));

  /** Chống XSS khi render dữ liệu người dùng */
  VA.escapeHtml = function (str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  };

  /**
   * Chuẩn hóa chuỗi để so khớp đáp án:
   * bỏ dấu tiếng Việt, bỏ hoa-thường, bỏ dấu câu, dồn khoảng trắng.
   * An toàn cho cả tiếng Trung (không có dấu để bỏ).
   */
  VA.normalize = function (str) {
    return String(str || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,!?;:'"()\-–—]/g, '')
      .replace(/\s+/g, ' ');
  };

  /** Trộn ngẫu nhiên mảng (Fisher-Yates) — trả về mảng mới */
  VA.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /** Sinh id duy nhất cho từ vựng */
  VA.uid = function () {
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  };

  /** Chuỗi ngày hôm nay dạng YYYY-MM-DD (giờ địa phương) */
  VA.todayStr = function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  /** Định dạng Date → YYYY-MM-DD */
  VA.fmtDate = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  /** Thông báo toast nhỏ dưới màn hình */
  VA.toast = function (msg) {
    const t = document.getElementById('toastEl');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  /** Có phải kí tự "có thể tiết lộ khi gợi ý" (chữ cái mọi ngôn ngữ, không phải dấu câu/khoảng trắng) */
  VA.isRevealable = function (ch) {
    // bỏ qua khoảng trắng + dấu câu ASCII lẫn full-width (tiếng Trung: ，。！？、；：「」…)
    return !/[\s.,!?;:'"()\-–—，。！？、；：·…]/.test(ch);
  };

  /** Đếm số kí tự tiết lộ được trong chuỗi (hỗ trợ Latin + tiếng Trung) */
  VA.countRevealable = function (str) {
    return [...String(str || '')].filter(VA.isRevealable).length;
  };

  /** Che chuỗi, tiết lộ n kí tự đầu tiên (mọi ngôn ngữ) */
  VA.maskText = function (str, n) {
    let seen = 0;
    return [...String(str || '')]
      .map((ch) => {
        if (VA.isRevealable(ch)) {
          seen++;
          return seen <= n ? ch : '_';
        }
        return ch;
      })
      .join('');
  };

  /** Tách chuỗi ngăn cách dấu phẩy thành mảng (tags, synonyms…) */
  VA.splitList = function (str) {
    return String(str || '').split(',').map((s) => s.trim()).filter(Boolean);
  };
})();
