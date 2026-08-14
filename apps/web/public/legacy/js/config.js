/**
 * config.js — Cấu hình toàn cục.
 * Nơi khai báo: khóa lưu trữ, quota học mỗi ngày, DANH SÁCH KHÓA HỌC.
 *
 * ★ MÔ HÌNH KHÓA HỌC:
 *   Bạn (người Việt) học nhiều NGÔN NGỮ NGUỒN (Anh, Trung…), bản dịch đích luôn là tiếng Việt.
 *   Mỗi khóa học có:
 *     - Database riêng trong localStorage (course_{id}_entries / _daily / _history)
 *     - Bộ từ riêng trong seed-data.js (en → SEED_WORDS, zh → ZH_WORDS)
 *     - Giao diện riêng (màu sắc chủ đạo, nhãn, cách hiển thị phát âm)
 *   Muốn thêm khóa mới (vd tiếng Nhật): thêm 1 object vào courses + bộ từ vào seed-data.js.
 */
(function () {
  const CONFIG = {
    // Khóa cài đặt toàn cục (khóa học đang mở, …)
    settingsKey: 'vocab_settings_v1',

    // Số từ mới cần học mỗi ngày (mục tiêu, áp dụng riêng cho từng khóa học)
    dailyQuota: 8,

    /**
     * ★ DANH SÁCH KHÓA HỌC.
     * - source.code / target.code là key của sense.meaning và mã giọng TTS
     * - storagePrefix: tiền tố khóa localStorage riêng (database tách biệt)
     * - seed: tên bộ từ tương ứng trong seed-data.js
     */
    courses: [
      {
        id: 'en',
        name: 'Tiếng Anh',
        icon: '🇬🇧',
        tagline: 'IPA + ví dụ, kho từ phong phú nhất',
        color: '#16a34a',
        source: { code: 'en', label: 'Anh', tts: 'en-US' },
        target: { code: 'vi', label: 'Việt', tts: 'vi-VN' },
        storagePrefix: 'course_en',
        seed: 'en',
        usesPinyin: false,
        dictLookup: true, // từ điển API là từ điển tiếng Anh
        pronunciationLabel: 'Phiên âm (IPA)',
        pronunciationPh: '/əˈpruːv/',
        wordFieldLabel: 'Từ tiếng Anh',
        wordFieldPh: 'vd: approve',
      },
      {
        id: 'zh',
        name: 'Tiếng Trung',
        icon: '🇨🇳',
        tagline: 'Chữ Hán + phiên âm pinyin',
        color: '#dc2626',
        source: { code: 'zh', label: 'Trung', tts: 'zh-CN' },
        target: { code: 'vi', label: 'Việt', tts: 'vi-VN' },
        storagePrefix: 'course_zh',
        seed: 'zh',
        usesPinyin: true, // trò Dịch nghĩa (Việt→Trung) chấp nhận đáp án gõ pinyin
        dictLookup: false,
        pronunciationLabel: 'Phiên âm (pinyin)',
        pronunciationPh: 'nǐ hǎo',
        wordFieldLabel: 'Chữ Hán',
        wordFieldPh: 'vd: 你好',
      },
    ],

    // null → mở màn hình CHỌN KHÓA HỌC mỗi lần vào app
    defaultCourseId: null,
  };

  window.VocabApp = window.VocabApp || {};
  window.VocabApp.config = CONFIG;
})();
