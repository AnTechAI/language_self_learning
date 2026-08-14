import { useEffect, useState } from 'react';
import type { WordEntry } from '@english/shared';
import { migrateIfNeeded, type MigrationSummary } from './db';

/**
 * App React — GĐ 1/2 (khung trống + lớp dữ liệu IndexedDB).
 * GĐ 2: khi mở app, tự động migrate dữ liệu localStorage (app legacy) →
 * IndexedDB — idempotent, chạy 1 lần (xem docs/INDEXEDDB.md).
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
  const [migration, setMigration] = useState<MigrationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    migrateIfNeeded()
      .then((s) => {
        if (alive) setMigration(s);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

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
        Đây là ứng dụng React mới (giai đoạn 2). App đang dùng hằng ngày vẫn nằm tại{' '}
        <a href="/legacy/index.html">/legacy/index.html</a> và hoạt động đầy đủ.
      </p>

      <h2>📦 Lớp dữ liệu IndexedDB (GĐ 2)</h2>
      {error ? (
        <p style={{ color: 'crimson' }}>Lỗi migrate: {error}</p>
      ) : !migration ? (
        <p style={{ color: '#888' }}>Đang kiểm tra dữ liệu…</p>
      ) : (
        <ul>
          <li>
            Đã migrate: <strong>{migration.alreadyDone ? 'lần đầu' : 'sẵn sàng'}</strong>
          </li>
          {migration.courses.length === 0 ? (
            <li>Không có dữ liệu localStorage trên origin này (dữ liệu thật nằm ở file://).</li>
          ) : (
            migration.courses.map((c) => (
              <li key={c.courseId}>
                Khóa {c.courseId}: {c.entries} từ · {c.daily} ngày · {c.history} lịch sử
              </li>
            ))
          )}
          {migration.settings && <li>Cài đặt: đã chuyển ✓</li>}
          {migration.legacyFolded > 0 && (
            <li>Gộp dữ liệu cũ (vocab_*): {migration.legacyFolded} từ</li>
          )}
        </ul>
      )}

      <h2>🗺️ Lộ trình</h2>
      <ul>
        <li>GĐ 0: khung Vite + React + TS ✅</li>
        <li>GĐ 1: data model TS (packages/shared) + ESLint/Prettier + CI ✅</li>
        <li>GĐ 2: localStorage → IndexedDB + migration tự động ✅</li>
        <li>GĐ 3: port từng màn hình sang React</li>
        <li>GĐ 5: đồng bộ FastAPI (apps/api)</li>
      </ul>
      <p style={{ color: '#888', fontSize: 12 }}>
        Mẫu type-check: <code>{SAMPLE_ENTRY.word}</code> ({SAMPLE_ENTRY.senses[0].meaning.vi})
      </p>
    </main>
  );
}
