import type { WordEntry } from '@english/shared';

/**
 * App React — GĐ 0/1 (khung trống).
 * Mục tiêu: sẵn sàng để port từng màn hình từ app legacy
 * (xem docs/WEB-REACT.md + docs/PRODUCTION-PLAN.md).
 *
 * GĐ 1: dữ liệu mẫu dưới đây có kiểu WordEntry lấy từ packages/shared —
 * chứng minh luồng import type dùng chung hoạt động (web ↔ api cùng model).
 */
const SAMPLE_ENTRY: WordEntry = {
  id: 'sample',
  word: 'hello',
  tags: ['đời sống'],
  dateAdded: '2025-01-01T00:00:00.000Z',
  learningStatus: 'new',
  correctStreak: 0,
  synonyms: ['hi'],
  antonyms: [],
  wordRoot: '',
  senses: [
    {
      pronunciation: '/həˈloʊ/',
      partOfSpeech: 'interjection',
      meaning: { en: 'Greeting.', vi: 'Xin chào.' },
      examples: ['Hello world!'],
    },
  ],
};

export default function App() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '48px auto',
        padding: '0 16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>🇬🇧 English Learning — React</h1>
      <p style={{ color: '#555' }}>
        Đây là ứng dụng React mới (giai đoạn 1). App đang dùng hằng ngày vẫn nằm tại{' '}
        <a href="/legacy/index.html">/legacy/index.html</a> và hoạt động đầy đủ.
      </p>
      <ul>
        <li>GĐ 0: khung Vite + React + TS ✅</li>
        <li>GĐ 1: data model TS (packages/shared) + ESLint/Prettier + CI ✅</li>
        <li>GĐ 2: localStorage → IndexedDB</li>
        <li>GĐ 3: port từng màn hình sang React</li>
        <li>GĐ 5: đồng bộ FastAPI (apps/api)</li>
      </ul>
      <p style={{ color: '#888', fontSize: 12 }}>
        Mẫu type-check: <code>{SAMPLE_ENTRY.word}</code> ({SAMPLE_ENTRY.senses[0].meaning.vi})
      </p>
    </main>
  );
}
