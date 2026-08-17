/**
 * lessons.zh.test.ts — Bài học theo KHÓA (HSK tiếng Trung).
 * Kiểm tra shim zhLessonsInit → manifest riêng → load bài → merge từ Hán vào kho.
 * Không phụ thuộc file sinh (manifest-zh.js / lesson-zh-*.js bị git-ignore):
 * nạp dữ liệu mẫu qua chính shim như file thật vẫn làm.
 */
import { beforeEach, describe, expect, it } from 'vitest';
// @vitest-environment happy-dom
import { initShim, reg } from './registry';
import { ensureLessonsManifest, ensureLessonInCourse, lessonById, lessonWordsInCourse, loadLesson } from './lessons';

const VA = () => window as unknown as { VocabApp: Record<string, (...a: unknown[]) => unknown> };

beforeEach(() => {
  // reset shim/registry về trạng thái sạch
  reg.lessonManifest = [];
  reg.zhLessonManifest = [];
  reg.lessons.clear();
  (window as unknown as { VocabApp?: unknown }).VocabApp = undefined;
});

describe('bài học khóa tiếng Trung (HSK)', () => {
  it('tải manifest-zh (zhLessonsInit) — tách biệt với en', async () => {
    initShim();
    VA().VocabApp.zhLessonsInit([
      { id: 'lesson-zh-001', title: 'HSK 1 · Bài 1', file: 'lesson-zh-001.js', tag: 'HSK 1', count: 2 },
    ]);
    // khóa en không được phép trả về bài của zh
    expect((await ensureLessonsManifest('en')).length).toBe(0);
    const zh = await ensureLessonsManifest('zh');
    expect(zh.length).toBe(1);
    expect(zh[0].title).toBe('HSK 1 · Bài 1');
  });

  it('lessonById tìm được bài zh (lesson-zh-*)', async () => {
    initShim();
    VA().VocabApp.zhLessonsInit([
      { id: 'lesson-zh-001', title: 'HSK 1 · Bài 1', file: 'lesson-zh-001.js', tag: 'HSK 1', count: 2 },
    ]);
    await ensureLessonsManifest('zh');
    expect(lessonById('lesson-zh-001')?.id).toBe('lesson-zh-001');
    expect(lessonById('lesson-001')).toBeUndefined();
  });

  it('loadLesson id lesson-zh-* tải đúng manifest zh (không đòi script ngoài)', async () => {
    initShim();
    VA().VocabApp.zhLessonsInit([
      { id: 'lesson-zh-001', title: 'HSK 1 · Bài 1', file: 'lesson-zh-001.js', tag: 'HSK 1', count: 2 },
    ]);
    VA().VocabApp.lessonsRegister('lesson-zh-001.js', {
      tag: 'HSK 1',
      words: [
        ['不客气', 'bù kè qi', 'other', "You're welcome", 'không có gì.', '', '', [], [], ''],
        ['你好', 'nǐ hǎo', 'interjection', 'Hello', 'xin chào.', '', '', [], [], ''],
      ],
    });
    const lesson = await loadLesson('lesson-zh-001');
    expect(lesson?.words.length).toBe(2);
  });

  it('merge từ Hán vào kho: word/pinyin/nghĩa Việt + lessonId + tag HSK', async () => {
    initShim();
    VA().VocabApp.zhLessonsInit([
      { id: 'lesson-zh-001', title: 'HSK 1 · Bài 1', file: 'lesson-zh-001.js', tag: 'HSK 1', count: 2 },
    ]);
    VA().VocabApp.lessonsRegister('lesson-zh-001.js', {
      tag: 'HSK 1',
      words: [
        ['不客气', 'bù kè qi', 'other', "You're welcome", 'không có gì.', '', '', [], [], '',
          { p: 'other', i: 'bù kè qi', e: 'Rude', v: 'bất lịch sự.' }],
        ['你好', 'nǐ hǎo', 'interjection', 'Hello', 'xin chào.', '', '', [], [], ''],
      ],
    });
    const entries: never[] = [];
    const added = await ensureLessonInCourse('lesson-zh-001', entries, async () => {});
    expect(added).toBe(2);

    const e = (entries as unknown as { word: string; senses: { pronunciation: string; meaning: { vi: string } }[]; lessonId: string; tags: string[] }[]).find((x) => x.word === '不客气');
    expect(e).toBeDefined();
    expect(e?.senses[0].pronunciation).toBe('bù kè qi');
    expect(e?.senses[0].meaning.vi).toBe('không có gì.');
    expect(e?.senses[1].meaning.vi).toBe('bất lịch sự.');
    expect(e?.lessonId).toBe('lesson-zh-001');
    expect(e?.tags).toEqual(['HSK 1']);
    expect(lessonWordsInCourse('lesson-zh-001', entries as never[])).toBe(2);
  });

  it('merge idempotent — chạy lại không thêm trùng', async () => {
    initShim();
    VA().VocabApp.zhLessonsInit([
      { id: 'lesson-zh-001', title: 'HSK 1 · Bài 1', file: 'lesson-zh-001.js', tag: 'HSK 1', count: 1 },
    ]);
    VA().VocabApp.lessonsRegister('lesson-zh-001.js', {
      tag: 'HSK 1',
      words: [['你好', 'nǐ hǎo', 'interjection', 'Hello', 'xin chào.', '', '', [], [], '']],
    });
    const entries: never[] = [];
    await ensureLessonInCourse('lesson-zh-001', entries, async () => {});
    const second = await ensureLessonInCourse('lesson-zh-001', entries, async () => {});
    expect(second).toBe(0);
    expect(entries.length).toBe(1);
  });
});