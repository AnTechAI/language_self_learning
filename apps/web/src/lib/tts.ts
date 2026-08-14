/**
 * tts.ts — Phát âm bằng Web Speech API (port từ legacy tts.js).
 * Ánh xạ mã ngôn ngữ app → mã giọng BCP-47; chọn giọng khớp nếu có.
 */
const VOICE_MAP: Record<string, string> = {
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

export function speak(text: string, lang: string): boolean {
  if (!text) return false;
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = VOICE_MAP[lang] || lang || 'en-US';
  u.rate = 0.85;
  const voices = window.speechSynthesis.getVoices();
  const target = u.lang.toLowerCase();
  const v = voices.find((vv) => vv.lang.replace('_', '-').toLowerCase().startsWith(target));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
  return true;
}
