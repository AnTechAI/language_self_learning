/**
 * seed.ts — Logic seed (port từ legacy seed-data.js) + dữ liệu sinh ra.
 * - SEED_EN / SEED_ZH: file seed.generated.ts (chạy tools/export-seed.js để tạo lại)
 * - toEntry: dòng nén → entry chuẩn
 * - mergeSeeds / applySeedUpgrade: giữ kho từ đồng bộ với seed
 */
import type { ExtraSense, RootSense, WordEntry } from '@english/shared';
import { uid } from '../lib/format';
import { SEED_EN, SEED_ZH } from './seed.generated';

export { SEED_EN, SEED_ZH };
export const SEED_VERSION = 2;

/** Dòng nén seed (docs/DATA-MODEL.md §2) → entry chuẩn (senses dùng meaning map) */
export function toEntry(row: ExtraSeedRow): WordEntry {
  const [word, ipa, pos, defEN, defVI, example, tag, syn, ant, root, ...extras] = row;
  const meaning = { en: defEN, vi: defVI };
  const senses: WordEntry['senses'] = [
    {
      pronunciation: ipa,
      partOfSpeech: pos,
      meaning,
      examples: [example],
    },
    ...(extras || []).map((x) => ({
      pronunciation: (x && x.i) || ipa || '',
      partOfSpeech: (x && x.p) || '',
      meaning: { en: (x && x.e) || '', vi: (x && x.v) || '' },
      examples: (x && x.x) ? [x.x] : [],
      synonyms: (x && x.s) || [],
      antonyms: (x && x.a) || [],
    })),
  ];
  return {
    id: uid(),
    word,
    tags: [tag],
    dateAdded: new Date().toISOString(),
    learningStatus: 'new',
    correctStreak: 0,
    synonyms: syn || [],
    antonyms: ant || [],
    wordRoot: root || '',
    senses,
  };
}

/** Dòng nén đầy đủ (docs/DATA-MODEL.md §2) */
export type ExtraSeedRow = [
  word: string,
  ipa: string,
  pos: string,
  defEN: string,
  defVI: string,
  example: string,
  tag: string,
  syn: string[],
  ant: string[],
  root: string | RootSense,
  ...extras: ExtraSense[],
];

/** Seed của 1 khóa */
export function seedFor(seed: 'en' | 'zh'): WordEntry[] {
  return seed === 'zh' ? SEED_ZH : SEED_EN;
}

/**
 * Gộp các từ seed còn thiếu vào kho (không ghi đè, không trùng theo word).
 * @returns số từ đã thêm
 */
export function mergeSeeds(entries: WordEntry[], seed: 'en' | 'zh'): number {
  const existing = new Set(entries.map((e) => e.word.toLowerCase()));
  let added = 0;
  seedFor(seed).forEach((e) => {
    if (existing.has(e.word.toLowerCase())) return;
    entries.push(e);
    existing.add(e.word.toLowerCase());
    added++;
  });
  return added;
}

/**
 * Nâng cấp entry có sẵn: THÊM sense có loại từ mới từ seed (giữ nguyên dữ liệu
 * người dùng). @returns số entry được nâng cấp
 */
export function applySeedUpgrade(entries: WordEntry[], seed: 'en' | 'zh'): number {
  const byWord = new Map(entries.map((e) => [e.word.toLowerCase(), e]));
  let updated = 0;
  seedFor(seed).forEach((fresh) => {
    const e = byWord.get(fresh.word.toLowerCase());
    if (!e || !Array.isArray(e.senses)) return;
    const havePos = new Set(e.senses.map((s) => s.partOfSpeech).filter(Boolean));
    let changed = false;
    fresh.senses.forEach((fs) => {
      if (havePos.has(fs.partOfSpeech)) return;
      e.senses.push(fs);
      havePos.add(fs.partOfSpeech);
      changed = true;
    });
    if ((!e.synonyms || !e.synonyms.length) && fresh.synonyms.length) e.synonyms = fresh.synonyms;
    if ((!e.antonyms || !e.antonyms.length) && fresh.antonyms.length) e.antonyms = fresh.antonyms;
    if (!e.wordRoot && fresh.wordRoot) e.wordRoot = fresh.wordRoot;
    if (changed) updated++;
  });
  return updated;
}
