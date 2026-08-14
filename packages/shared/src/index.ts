/**
 * packages/shared — Kiểu dữ liệu (types) DÙNG CHUNG cho app React + API FastAPI.
 *
 * Lợi ích:
 *   - Một nguồn duy nhất cho data model → web và api không lệch nhau.
 *   - Khi port app legacy sang React, từng màn hình dùng đúng kiểu này
 *     (legacy hiện là JS không kiểu — mô hình đích ghi ở docs/DATA-MODEL.md).
 */

/** Nghĩa theo ngôn ngữ: key = mã ngôn ngữ ('en' | 'vi' | 'zh' …) */
export interface Meaning {
  en?: string;
  vi?: string;
  zh?: string;
  [code: string]: string | undefined;
}

/** Một NGHĨA của từ (entry có thể có nhiều nghĩa/loại từ — "senses") */
export interface Sense {
  pronunciation: string; // IPA (en) hoặc pinyin (zh)
  partOfSpeech: string; // noun | verb | adjective | …
  meaning: Meaning;
  examples: string[];
  synonyms?: string[];
  antonyms?: string[];
}

export type LearningStatus = 'new' | 'learning' | 'mastered';

/** Một TỪ trong kho từ vựng của khóa học */
/** Nghĩa gốc từ (root) — 1 số từ có gốc là object (ExtraSense-like) thay vì string */
export type RootSense = Partial<ExtraSense>;

export interface WordEntry {
  id: string;
  word: string;
  tags: string[];
  dateAdded: string; // ISO
  learningStatus: LearningStatus;
  correctStreak: number;
  synonyms: string[];
  antonyms: string[];
  wordRoot?: string | RootSense;
  senses: Sense[];
  /** Bài học sở hữu từ này (nếu có — hệ thống Lesson) */
  lessonId?: string;
  lastReviewDay?: string; // 'YYYY-MM-DD'
}

/** Một KHÓA HỌC (en / zh…) — định nghĩa tĩnh trong config */
export interface Course {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  color: string;
  source: { code: string; label: string; tts: string };
  target: { code: string; label: string; tts: string };
  storagePrefix: string;
  seed: 'en' | 'zh';
  usesPinyin: boolean;
  dictLookup: boolean;
  pronunciationLabel: string;
  pronunciationPh: string;
  wordFieldLabel: string;
  wordFieldPh: string;
}

/** Dòng nén 1 từ trong SEED_WORDS / bài học (docs/DATA-MODEL.md) */
export type SeedRow = [
  word: string,
  ipa: string,
  pos: string,
  defEN: string,
  defVI: string,
  example: string,
  tag: string,
  syn: string[],
  ant: string[],
  root: string,
  ...extras: ExtraSense[],
];

/** Nghĩa bổ sung trong dòng nén */
export interface ExtraSense {
  p?: string; // loại từ
  i?: string; // phiên âm
  e?: string; // nghĩa tiếng Anh
  v?: string; // nghĩa tiếng Việt
  x?: string; // ví dụ
  s?: string[]; // đồng nghĩa
  a?: string[]; // trái nghĩa
}

/** Thông tin 1 BÀI HỌC trong manifest (js/lessons/manifest.js) */
export interface LessonMeta {
  id: string; // 'lesson-001'
  title: string; // 'Bài 1 · đời sống'
  file: string; // 'lesson-001.js'
  tag: string; // chủ đề
  count: number; // số từ
}

/** Dữ liệu 1 file bài học (đăng ký qua VocabApp.lessonsRegister) */
export interface LessonData {
  tag: string;
  words: SeedRow[];
}

/** Entry từ điển ngoại tuyến (chunk) — docs/DATA-MODEL.md */
export type BankRow = [
  word: string,
  pos: string,
  definition: string,
  example: string,
  syn: string[],
  ant: string[],
];

/** Kết quả tra từ điển (nguồn: từ điển máy hoặc API online) */
export interface LookupResult {
  senses: Sense[];
  synonyms: string[];
  antonyms: string[];
}

/** Session game đang chạy */
export interface GameSession {
  type: 'flashcard' | 'translate' | 'synonym' | 'antonym';
  idx: number;
  correct: number;
  total: number;
  streakNow: number;
  repeated: Record<string, number>;
  missed: string[];
  queue: WordEntry[];
  key?: 'synonyms' | 'antonyms';
}

/** Bản ghi lịch sử game */
export interface HistoryRecord {
  ts: string;
  game: string;
  wordId: string;
  correct: boolean;
}

/** Cài đặt toàn cục (vocab_settings_v1) */
export interface Settings {
  courseId?: string;
  gameQty?: number;
  seedVersion?: number;
  [key: string]: unknown;
}

/** Dữ liệu đồng bộ gửi lên API (docs/API-SYNC.md) — delta từ client */
export interface SyncPayload {
  clientId: string;
  entries: WordEntry[];
  daily: Record<string, string[]>;
  history: HistoryRecord[];
  updatedAt: string; // ISO
  schemaVersion: number;
}
