/**
 * sync.test.ts — Test thuần logic đồng bộ (không mạng):
 *   buildPushBody · mergePull (LWW theo updatedAt, lọc course, soft-delete).
 */
import { describe, expect, it } from 'vitest';
import type { HistoryRecord, WordEntry } from '@english/shared';
import { buildPushBody, emptyUpdatedAtMap, historyKey, mergePull, type UpdatedAtMap } from './sync';

const T1 = '2026-01-01T10:00:00.000000+00:00';
const T2 = '2026-01-02T10:00:00.000000+00:00';
const T3 = '2026-01-03T10:00:00.000000+00:00';

function entry(id: string, extra: Partial<WordEntry> = {}): WordEntry {
  return {
    id,
    word: id,
    tags: ['tag'],
    dateAdded: T1,
    learningStatus: 'learning',
    correctStreak: 0,
    synonyms: [],
    antonyms: [],
    senses: [],
    ...extra,
  };
}

function pull(over: Record<string, unknown> = {}) {
  return {
    entries: [],
    daily: [],
    history: [],
    serverCursor: T3,
    ...over,
  };
}

describe('buildPushBody', () => {
  it('map mọi entry/daily/history theo courseId với khóa ổn định', () => {
    const map: UpdatedAtMap = emptyUpdatedAtMap();
    map.entries['en\u0000gratitude'] = T2;
    const body = buildPushBody(
      'dev-1',
      'test',
      'en',
      [entry('gratitude')],
      { '2026-01-01': ['a'] },
      [{ ts: T1, game: 'choice', wordId: 'case', correct: true }],
      map,
      T3,
    );
    expect(body.clientId).toBe('dev-1');
    expect(body.entries[0].courseId).toBe('en');
    expect(body.entries[0].word).toBe('gratitude');
    // updatedAt lấy từ map nếu có
    expect(body.entries[0].updatedAt).toBe(T2);
    expect(body.daily[0].courseId).toBe('en');
    expect(body.history[0].game).toBe('choice');
    // dataJson round-trip
    expect(JSON.parse(body.entries[0].dataJson).id).toBe('gratitude');
  });
});

describe('mergePull — LWW theo updatedAt', () => {
  it('server entry mới hơn → thay thế local', () => {
    const res = mergePull(
      'en',
      [entry('case', { correctStreak: 1 })],
      {},
      [],
      emptyUpdatedAtMap(),
      pull({
        entries: [
          {
            courseId: 'en',
            word: 'case',
            dataJson: JSON.stringify(entry('case', { correctStreak: 5 })),
            updatedAt: T2,
          },
        ],
      }),
    );
    expect(res.entries.find((e) => e.id === 'case')?.correctStreak).toBe(5);
  });

  it('local mới hơn → giữ local (muộn hơn thắng, không ghi đè mù)', () => {
    const localMap = emptyUpdatedAtMap();
    localMap.entries['en\u0000case'] = T3;
    const res = mergePull(
      'en',
      [entry('case', { correctStreak: 9 })],
      {},
      [],
      localMap,
      pull({
        entries: [
          {
            courseId: 'en',
            word: 'case',
            dataJson: JSON.stringify(entry('case', { correctStreak: 1 })),
            updatedAt: T2, // cũ hơn local T3
          },
        ],
      }),
    );
    expect(res.entries.find((e) => e.id === 'case')?.correctStreak).toBe(9);
  });

  it('soft-delete từ server → xóa khỏi local, báo removedIds', () => {
    const res = mergePull(
      'en',
      [entry('gone')],
      {},
      [],
      emptyUpdatedAtMap(),
      pull({
        entries: [{ courseId: 'en', word: 'gone', dataJson: '{}', updatedAt: T2, deleted: true }],
      }),
    );
    expect(res.entries.find((e) => e.id === 'gone')).toBeUndefined();
    expect(res.removedIds).toEqual([{ courseId: 'en', id: 'gone' }]);
  });

  it('bỏ qua dữ liệu course khác', () => {
    const res = mergePull(
      'en',
      [entry('case')],
      {},
      [],
      emptyUpdatedAtMap(),
      pull({
        entries: [{ courseId: 'zh', word: 'friend', dataJson: '{}', updatedAt: T2 }],
      }),
    );
    expect(res.entries.map((e) => e.id)).toEqual(['case']);
  });

  it('gộp daily LWW + lịch sử thêm mới (không trùng)', () => {
    const res = mergePull(
      'en',
      [],
      {},
      [{ ts: T1, game: 'choice', wordId: 'case', correct: true }],
      emptyUpdatedAtMap(),
      pull({
        daily: [{ courseId: 'en', date: '2026-01-01', entryIds: ['a'], updatedAt: T2 }],
        history: [
          // trùng bản local (cùng ts+game+word) → không thêm
          {
            id: 1,
            courseId: 'en',
            ts: T1,
            game: 'choice',
            word: 'case',
            correct: true,
            updatedAt: T2,
          },
          // mới → thêm
          {
            id: 2,
            courseId: 'en',
            ts: T2,
            game: 'translate',
            word: 'friend',
            correct: false,
            updatedAt: T2,
          },
        ],
      }),
    );
    expect(res.daily['2026-01-01']).toEqual(['a']);
    expect(res.history.length).toBe(2);
    expect(res.history.map((h) => h.wordId).sort()).toEqual(['case', 'friend']);
    const localH: HistoryRecord = { ts: T1, game: 'choice', wordId: 'case', correct: true };
    expect(historyKey('en', localH)).toContain('case');
  });
});
