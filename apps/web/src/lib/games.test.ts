/**
 * games.test.ts — Test logic 4 game (flashcard / dịch nghĩa / đồng nghĩa / trái nghĩa).
 * Chỉ test phần THUẦN (lib/games.ts), không cần DOM/IDB.
 */
import { describe, expect, it } from 'vitest';
import type { Course, WordEntry } from '@english/shared';
import {
  buildChoice,
  buildPool,
  checkTranslate,
  recordAnswer,
  requeueIfWrong,
  stableSense,
  startChoiceSession,
  startSimpleSession,
} from './games';

const EN_COURSE: Course = {
  id: 'en',
  name: 'Tiếng Anh',
  icon: '🇬🇧',
  tagline: '',
  color: '#10b981',
  source: { code: 'en', label: 'Tiếng Anh', tts: 'en-US' },
  target: { code: 'vi', label: 'Tiếng Việt', tts: 'vi-VN' },
  storagePrefix: 'el',
  seed: 'en',
  usesPinyin: false,
  dictLookup: true,
  pronunciationLabel: 'Phiên âm',
  pronunciationPh: '/.../',
  wordFieldLabel: 'Từ tiếng Anh',
  wordFieldPh: 'Gõ từ tiếng Anh…',
};

const ZH_COURSE: Course = {
  ...EN_COURSE,
  id: 'zh',
  name: 'Tiếng Trung',
  icon: '🇨🇳',
  seed: 'zh',
  usesPinyin: true,
  source: { code: 'zh', label: 'Tiếng Trung', tts: 'zh-CN' },
};

function entry(
  word: string,
  opts: Partial<WordEntry> & { senses?: WordEntry['senses'] } = {},
): WordEntry {
  return {
    id: 'id_' + word.toLowerCase(),
    word,
    tags: [],
    dateAdded: '2025-01-01T00:00:00.000Z',
    learningStatus: 'new',
    correctStreak: 0,
    synonyms: [],
    antonyms: [],
    wordRoot: '',
    senses: [
      {
        pronunciation: '',
        partOfSpeech: 'noun',
        meaning: { en: word, vi: 'nghĩa ' + word },
        examples: [],
      },
    ],
    ...opts,
  };
}

/* ================= buildPool ================= */

describe('buildPool', () => {
  it('lọc từ không có senses hoặc thiếu nghĩa đích', () => {
    const ok = entry('cat');
    const noSense = entry('x', { senses: [] });
    const noVi = entry('y', {
      senses: [{ pronunciation: '', partOfSpeech: 'noun', meaning: { en: 'y' }, examples: [] }],
    });
    const pool = buildPool([ok, noSense, noVi], EN_COURSE);
    expect(pool.map((e) => e.word)).toEqual(['cat']);
  });

  it('lọc theo lessonId khi có phạm vi bài', () => {
    const a = entry('a', { lessonId: 'lesson-001' });
    const b = entry('b', { lessonId: 'lesson-002' });
    const pool = buildPool([a, b], EN_COURSE, { lessonId: 'lesson-001' });
    expect(pool).toHaveLength(1);
    expect(pool[0].id).toBe(a.id);
  });

  it('lọc theo onlyIds (ôn lại từ sai)', () => {
    const a = entry('a');
    const b = entry('b');
    const pool = buildPool([a, b], EN_COURSE, { onlyIds: [b.id] });
    expect(pool.map((e) => e.id)).toEqual([b.id]);
  });
});

/* ================= startSimpleSession ================= */

describe('startSimpleSession', () => {
  it('cắt hàng đợi theo qty', () => {
    const s = startSimpleSession('flashcard', [entry('a'), entry('b'), entry('c')], 2);
    expect(s.queue.length).toBe(2);
    expect(s.idx).toBe(0);
    expect(s.total).toBe(0);
  });

  it('qty=0 → giữ hết', () => {
    const s = startSimpleSession('translate-vi', [entry('a'), entry('b')], 0);
    expect(s.queue.length).toBe(2);
  });
});

/* ================= startChoiceSession ================= */

describe('startChoiceSession', () => {
  it('chỉ giữ từ có đáp án không rỗng; giữ pool làm nguồn nhiễu', () => {
    const withSyn = entry('big', { synonyms: ['large'] });
    const emptySyn = entry('small', { synonyms: [''] });
    const noSyn = entry('fast', { synonyms: [] });
    const s = startChoiceSession('synonym', [withSyn, emptySyn, noSyn], 0);
    expect(s.queue.map((e) => e.word)).toEqual(['big']);
    expect(s.pool).toHaveLength(3); // pool giữ NGUYÊN (cho nhiễu)
    expect(s.key).toBe('synonyms');
  });
});

/* ================= recordAnswer / requeue ================= */

describe('recordAnswer & requeue', () => {
  it('đúng → correct++, streak tăng, không requeue', () => {
    const s = startSimpleSession('flashcard', [entry('a'), entry('b')], 0);
    const a = s.queue[0];
    const r = recordAnswer(s, a, true);
    expect(s.correct).toBe(1);
    expect(s.total).toBe(1);
    expect(s.streakNow).toBe(1);
    expect(s.missed).toEqual([]);
    expect(s.queue).toHaveLength(2);
    expect(r.finished).toBe(false);
  });

  it('sai → requeue về cuối, missed đánh dấu, streak reset', () => {
    const s = startSimpleSession('flashcard', [entry('a'), entry('b')], 0);
    const a = s.queue[0];
    const r = recordAnswer(s, a, false);
    expect(s.correct).toBe(0);
    expect(s.streakNow).toBe(0);
    expect(s.missed).toEqual([a.id]);
    expect(s.queue).toHaveLength(3); // 1 từ được hỏi lại
    expect(s.queue[s.queue.length - 1].id).toBe(a.id);
    expect(r.finished).toBe(false);
  });

  it('requeue tối đa 1 lần/từ', () => {
    const s = startSimpleSession('flashcard', [entry('a')], 0);
    const a = s.queue[0];
    requeueIfWrong(s, a);
    requeueIfWrong(s, a);
    expect(s.repeated[a.id]).toBe(1);
    expect(s.queue).toHaveLength(2);
  });

  it('finished = đã duyệt hết hàng đợi (kể cả từ bị hỏi lại)', () => {
    const s = startSimpleSession('flashcard', [entry('a'), entry('b')], 0);
    const [a, b] = s.queue;
    recordAnswer(s, a, false); // a sai → requeue → queue [a,b,a]
    expect(s.queue.length).toBe(3);
    expect(s.idx).toBe(1);
    recordAnswer(s, b, true);
    expect(s.idx).toBe(2);
    const r = recordAnswer(s, a, true); // a lần 2 đúng → xong
    expect(s.correct).toBe(2);
    expect(r.finished).toBe(true);
    expect(s.idx).toBe(3);
  });

  it('đúng lại sau khi sai → gỡ missed', () => {
    const s = startSimpleSession('flashcard', [entry('a')], 0);
    const a = s.queue[0];
    recordAnswer(s, a, false);
    expect(s.missed).toEqual([a.id]);
    recordAnswer(s, a, true);
    expect(s.missed).toEqual([]);
  });
});

/* ================= buildChoice ================= */

describe('buildChoice', () => {
  const big = entry('big', {
    synonyms: ['large'],
    senses: [
      {
        pronunciation: '',
        partOfSpeech: 'adjective',
        meaning: { en: 'big', vi: 'to lớn' },
        examples: [],
      },
    ],
  });
  const large = entry('large', {
    senses: [
      {
        pronunciation: '',
        partOfSpeech: 'adjective',
        meaning: { en: 'large', vi: 'rộng' },
        examples: [],
      },
    ],
  });
  const small = entry('small', {
    senses: [
      {
        pronunciation: '',
        partOfSpeech: 'adjective',
        meaning: { en: 'small', vi: 'nhỏ' },
        examples: [],
      },
    ],
  });
  const fast = entry('fast', {
    senses: [
      {
        pronunciation: '',
        partOfSpeech: 'adjective',
        meaning: { en: 'fast', vi: 'nhanh' },
        examples: [],
      },
    ],
  });
  const run = entry('run', {
    senses: [
      { pronunciation: '', partOfSpeech: 'verb', meaning: { en: 'run', vi: 'chạy' }, examples: [] },
    ],
  });

  it('4 đáp án duy nhất, có đáp án đúng', () => {
    const s = startChoiceSession('synonym', [big, large, small, fast, run], 0);
    const c = buildChoice(s, [big, large, small, fast, run]);
    expect(c.correctWord).toBe('large');
    expect(c.options).toHaveLength(4);
    expect(new Set(c.options).size).toBe(4);
    expect(c.options).toContain('large');
    expect(c.options).not.toContain('big'); // từ gốc không làm nhiễu
  });

  it('ưu tiên nhiễu cùng loại từ, fallback toàn bộ', () => {
    const s = startChoiceSession('synonym', [big, large, small, fast], 0);
    const c = buildChoice(s, [big, large, small, fast, run]);
    // chỉ còn 2 adj ngoài big/large → <3 → fallback lấy cả run (verb)
    expect(c.options).toHaveLength(4);
  });

  it('distractorSource giữ phạm vi bài học (không lấy từ ngoài bài)', () => {
    const outside = entry('zzz', {
      senses: [
        {
          pronunciation: '',
          partOfSpeech: 'adjective',
          meaning: { en: 'zzz', vi: 'ngoài bài' },
          examples: [],
        },
      ],
    });
    const tiny = entry('tiny', {
      senses: [
        {
          pronunciation: '',
          partOfSpeech: 'adjective',
          meaning: { en: 'tiny', vi: 'tí hon' },
          examples: [],
        },
      ],
    });
    const huge = entry('huge', {
      senses: [
        {
          pronunciation: '',
          partOfSpeech: 'adjective',
          meaning: { en: 'huge', vi: 'khổng lồ' },
          examples: [],
        },
      ],
    });
    const quick = entry('quick', {
      senses: [
        {
          pronunciation: '',
          partOfSpeech: 'adjective',
          meaning: { en: 'quick', vi: 'nhanh nhẹn' },
          examples: [],
        },
      ],
    });
    const s = startChoiceSession('synonym', [big, large, small, fast, tiny, huge, quick], 0);
    const lessonWords = [big, large, small, fast, tiny, huge, quick];
    const c = buildChoice(s, [big, large, small, fast, tiny, huge, quick, outside], lessonWords);
    expect(c.options).not.toContain('zzz');
    expect(c.options).toHaveLength(4);
  });

  it('distractorSource nhỏ (<3 từ khác) → fallback toàn bộ kho', () => {
    const outside = entry('zzz', {
      senses: [
        {
          pronunciation: '',
          partOfSpeech: 'adjective',
          meaning: { en: 'zzz', vi: 'ngoài bài' },
          examples: [],
        },
      ],
    });
    const s = startChoiceSession('synonym', [big, large], 0); // chỉ big đủ điều kiện (syn "large")
    const c = buildChoice(s, [big, large, small, fast, outside], [big, large]);
    expect(c.options).toContain('zzz'); // scope quá nhỏ → lấy nhiễu từ toàn kho
    expect(c.options).toHaveLength(4);
  });
});

/* ================= checkTranslate ================= */

describe('checkTranslate', () => {
  const run = entry('run', {
    senses: [
      {
        pronunciation: '/rʌn/',
        partOfSpeech: 'verb',
        meaning: { en: 'run', vi: 'chạy' },
        examples: [],
      },
      {
        pronunciation: '',
        partOfSpeech: 'noun',
        meaning: { en: 'a run', vi: 'lần chạy' },
        examples: [],
      },
    ],
  });

  it('translate-vi: khớp nghĩa tiếng Việt (Anh–Việt), bỏ dấu VN, sense cố định', () => {
    // Khóa sense 0 ("chạy") — chỉ nghĩa này được chấp nhận
    const s = startSimpleSession('translate-vi', [run], 0, 'vi');
    s.senseIdx = { [run.id]: 0 };
    expect(checkTranslate(EN_COURSE, s, run, 'chạy')).toBe(true);
    expect(checkTranslate(EN_COURSE, s, run, 'lần chạy')).toBe(false); // sense khác → sai
    expect(checkTranslate(EN_COURSE, s, run, 'bay')).toBe(false);

    // Khóa sense 1 ("lần chạy") — ngược lại
    s.senseIdx = { [run.id]: 1 };
    expect(checkTranslate(EN_COURSE, s, run, 'lần chạy')).toBe(true);
    expect(checkTranslate(EN_COURSE, s, run, 'chạy')).toBe(false);

    // Không còn chiều ngược: gõ từ nguồn không phải đáp án
    s.senseIdx = { [run.id]: 0 };
    expect(checkTranslate(EN_COURSE, s, run, 'run')).toBe(false);
  });

  it('translate-en: HIỆN định nghĩa tiếng Anh → người chơi GÕ TỪ VỰNG', () => {
    const kettle = entry('kettle', {
      senses: [
        {
          pronunciation: '/ˈkɛ.təl/',
          partOfSpeech: 'noun',
          meaning: {
            en: 'A metal pot for stewing or boiling; usually has a lid',
            vi: 'ấm đun nước',
          },
          examples: [],
        },
      ],
    });
    const s = startSimpleSession('translate-en', [kettle], 0, 'en');
    // Đáp án phải là TỪ VỰNG (không phân biệt hoa thường)
    expect(checkTranslate(EN_COURSE, s, kettle, 'kettle')).toBe(true);
    expect(checkTranslate(EN_COURSE, s, kettle, '  KETTLE  ')).toBe(true);
    expect(checkTranslate(EN_COURSE, s, kettle, 'kettles')).toBe(false);
    // Gõ chính định nghĩa → sai (không phải từ vựng)
    expect(checkTranslate(EN_COURSE, s, kettle, 'A metal pot for stewing or boiling')).toBe(false);
    // Nghĩa tiếng Việt cũng không phải đáp án
    expect(checkTranslate(EN_COURSE, s, kettle, 'ấm đun nước')).toBe(false);
  });

  it('zh: translate-vi dùng nghĩa tiếng Việt (không cần pinyin)', () => {
    const ni = entry('你', {
      senses: [
        {
          pronunciation: 'nǐ',
          partOfSpeech: 'pronoun',
          meaning: { zh: '你', vi: 'bạn' },
          examples: [],
        },
      ],
    });
    const s = startSimpleSession('translate-vi', [ni], 0, 'vi');
    expect(checkTranslate(ZH_COURSE, s, ni, 'bạn')).toBe(true);
    expect(checkTranslate(ZH_COURSE, s, ni, 'ni')).toBe(false); // pinyin không phải đáp án
  });

  it('startSimpleSession chọn sense CÓ nghĩa đích khi có targetCode', () => {
    const multi = entry('bank', {
      senses: [
        { pronunciation: '', partOfSpeech: 'noun', meaning: { en: 'bank' }, examples: [] }, // không có vi
        {
          pronunciation: '',
          partOfSpeech: 'noun',
          meaning: { en: 'bank', vi: 'ngân hàng' },
          examples: [],
        },
      ],
    });
    const s = startSimpleSession('translate-vi', [multi], 0, 'vi');
    const sense = stableSense(multi, s);
    expect(sense?.meaning?.vi).toBe('ngân hàng'); // luôn chọn sense có vi
    // ổn định: gọi lại nhiều lần cùng 1 kết quả
    expect(stableSense(multi, s)).toBe(sense);
    expect(stableSense(multi, s)).toBe(sense);

    // translate-en: chọn sense có meaning.en (senseIdx dùng cho định nghĩa hiển thị)
    const s2 = startSimpleSession('translate-en', [multi], 0, 'en');
    expect(stableSense(multi, s2)?.meaning?.en).toBe('bank');
  });

  it('đáp án rỗng → sai cho cả 2 game', () => {
    const a = startSimpleSession('translate-vi', [run], 0, 'vi');
    a.senseIdx = { [run.id]: 0 };
    expect(checkTranslate(EN_COURSE, a, run, '   ')).toBe(false);
    expect(checkTranslate(EN_COURSE, a, run, '')).toBe(false);
    const b = startSimpleSession('translate-en', [run], 0, 'en');
    b.senseIdx = { [run.id]: 0 };
    expect(checkTranslate(EN_COURSE, b, run, '')).toBe(false);
  });

  it('translate-vi: chấp nhận 1 phần trong danh sách nghĩa tách phẩy (vd "làm, thực hiện")', () => {
    const doV = entry('do', {
      senses: [
        {
          pronunciation: '',
          partOfSpeech: 'verb',
          meaning: { en: 'do', vi: 'làm, thực hiện' },
          examples: [],
        },
      ],
    });
    const s = startSimpleSession('translate-vi', [doV], 0, 'vi');
    expect(checkTranslate(EN_COURSE, s, doV, 'thực hiện')).toBe(true);
    expect(checkTranslate(EN_COURSE, s, doV, 'làm')).toBe(true);
    expect(checkTranslate(EN_COURSE, s, doV, 'làm xong')).toBe(false);
  });

  it('translate-vi: bỏ dấu tiếng Việt khi so khớp', () => {
    const ban = entry('table', {
      senses: [
        {
          pronunciation: '',
          partOfSpeech: 'noun',
          meaning: { en: 'table', vi: 'cái bàn' },
          examples: [],
        },
      ],
    });
    const s = startSimpleSession('translate-vi', [ban], 0, 'vi');
    expect(checkTranslate(EN_COURSE, s, ban, 'cái bàn')).toBe(true);
    expect(checkTranslate(EN_COURSE, s, ban, 'bàn')).toBe(false);
  });
});
