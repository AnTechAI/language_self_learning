/**
 * tts.js — Phát âm bằng Web Speech API.
 * Hỗ trợ mọi ngôn ngữ: en, vi, zh, ja… (ánh xạ mã ngôn ngữ → mã giọng).
 */
(function () {
  const VA = window.VocabApp;

  /** Ánh xạ mã ngôn ngữ của app → mã giọng TTS chuẩn BCP-47 */
  const VOICE_MAP = {
    en: 'en-US',
    'en-US': 'en-US',
    'en-GB': 'en-GB',
    vi: 'vi-VN',
    'vi-VN': 'vi-VN',
    zh: 'zh-CN',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    ja: 'ja-JP',
  };

  VA.speak = function (text, lang) {
    if (!text) return;
    if (!('speechSynthesis' in window)) {
      VA.toast('Trình duyệt không hỗ trợ phát âm');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE_MAP[lang] || lang || 'en-US';
    u.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const target = u.lang.toLowerCase();
    const v = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(target));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };
})();
