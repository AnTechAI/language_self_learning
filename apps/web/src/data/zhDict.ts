/**
 * data/zhDict.ts — Dữ liệu từ điển TIẾNG TRUNG (HSK 3.0) tải theo nhu cầu.
 *
 * Ba file JSON tĩnh sinh bởi data/scripts (build-hsk30.js, fetch-hsk30-grammar.js):
 *   legacy/js/zh-dict/hsk.json        — toàn bộ từ HSK 1–6 (schema chinese_design.md §3)
 *   legacy/js/zh-dict/zh-strokes.json — nét chữ (Hanzi Writer data — Luyện viết)
 *   legacy/js/zh-dict/zh-grammar.json — điểm ngữ pháp theo cấp (422 điểm)
 *
 * Tải lần đầu khi mở màn hình tương ứng; cache 1 lần trong phiên.
 * (File tĩnh — không cần IndexedDB; PWA cache runtime cache-first.)
 */
import { LEGACY_JS_BASE } from './registry';
import type { WordEntry } from '@english/shared';
import { uid } from '../lib/format';

export interface ZhSense {
  pos: string;
  en: string;
  vi: string;
}
export interface ZhExample {
  zh: string;
  pinyin: string;
  vi: string;
}
export interface ZhWord {
  id: string;
  simplified: string;
  traditional: string;
  pinyin: string;
  pinyin_numeric: string;
  hsk_level: number;
  pos: string;
  meaning_en: string;
  meaning_vi: string;
  radical: string;
  classifier: string;
  frequency_rank: number;
  /** số nét mỗi chữ (0 = chưa có dữ liệu nét) */
  strokes: { c: string; n: number }[];
  senses: ZhSense[];
  example_sentences: ZhExample[];
}
export interface ZhStrokesData {
  [char: string]: { s: string[]; m: number[][][] };
}
export interface ZhGrammarPoint {
  id: string;
  level: number;
  code: string;
  title: string;
  note: string;
  examples: string[];
}

const cache: { hsk?: ZhWord[]; strokes?: ZhStrokesData; grammar?: ZhGrammarPoint[] } = {};

/** Từ điển zh → entry chuẩn (gộp vào kho — bookmark) */
export function zhWordToEntry(w: ZhWord): WordEntry {
  const senses = (w.senses && w.senses.length ? w.senses : [{ pos: w.pos, en: w.meaning_en, vi: w.meaning_vi }]).map(
    (s) => ({
      pronunciation: w.pinyin,
      partOfSpeech: s.pos || w.pos,
      meaning: { zh: w.simplified, en: s.en, vi: s.vi },
      examples: (w.example_sentences || []).map((x) => x.zh),
    }),
  );
  return {
    id: uid(),
    word: w.simplified,
    tags: ['HSK ' + w.hsk_level],
    dateAdded: new Date().toISOString(),
    learningStatus: 'new',
    correctStreak: 0,
    synonyms: [],
    antonyms: [],
    level: w.hsk_level,
    senses,
  };
}

async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(LEGACY_JS_BASE + 'zh-dict/' + name);
  if (!res.ok) throw new Error('Không tải được ' + name);
  return (await res.json()) as T;
}

/** Toàn bộ từ điển HSK 3.0 (1–6) — cache 1 lần */
export async function loadZhDict(): Promise<ZhWord[]> {
  if (!cache.hsk) cache.hsk = await fetchJson<ZhWord[]>('hsk.json');
  return cache.hsk;
}

/** Dữ liệu nét chữ cho Luyện viết (Hanzi Writer) */
export async function loadZhStrokes(): Promise<ZhStrokesData> {
  if (!cache.strokes) cache.strokes = await fetchJson<ZhStrokesData>('zh-strokes.json');
  return cache.strokes;
}

/** Điểm ngữ pháp HSK theo cấp */
export async function loadZhGrammar(): Promise<ZhGrammarPoint[]> {
  if (!cache.grammar) cache.grammar = await fetchJson<ZhGrammarPoint[]>('zh-grammar.json');
  return cache.grammar;
}