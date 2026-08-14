/**
 * registry.ts — Shim `window.VocabApp` + tải script động.
 *
 * Các file dữ liệu legacy (chunk từ điển, bài học) tự đăng ký qua
 * `window.VocabApp.bankRegister/bankInit/lessonsRegister/lessonsInit`.
 * App React định nghĩa SHIM này (chỉ 4 hàm đăng ký) để vẫn dùng được 25MB
 * chunk + bài học mà KHÔNG phải nạp toàn bộ — đúng 1 file khi cần.
 */
import type { ExtraSense, RootSense } from '@english/shared';

export type BankRow = [
  word: string,
  pos: string,
  definition: string,
  example: string,
  syn: string[],
  ant: string[],
];

export interface LessonMeta {
  id: string;
  title: string;
  file: string;
  tag: string;
  count: number;
}

export interface LessonData {
  tag: string;
  words: ExtraSeedRow[];
}

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

interface Registry {
  bankManifest: string[];
  bankChunks: Map<string, BankRow[]>;
  lessonManifest: LessonMeta[];
  lessons: Map<string, LessonData>;
}

const reg: Registry = {
  bankManifest: [],
  bankChunks: new Map(),
  lessonManifest: [],
  lessons: new Map(),
};

declare global {
  interface Window {
    VocabApp?: Record<string, unknown>;
  }
}

/** Tạo shim 1 lần (idempotent) — phải chạy TRƯỚC khi nạp chunk/lesson file */
export function initShim(): Registry {
  const w = window as Window & { VocabApp?: Record<string, unknown> };
  if (!w.VocabApp) w.VocabApp = {};
  Object.assign(w.VocabApp, {
    bankInit: (names: string[]) => {
      reg.bankManifest = Array.isArray(names) ? names : [];
    },
    bankRegister: (name: string, rows: BankRow[]) => {
      reg.bankChunks.set(name, rows || []);
    },
    lessonsInit: (list: LessonMeta[]) => {
      reg.lessonManifest = Array.isArray(list) ? list : [];
    },
    lessonsRegister: (file: string, data: LessonData) => {
      reg.lessons.set(file, data || { tag: '', words: [] });
    },
  });
  return reg;
}

export { reg };

/** Đường dẫn gốc tới dữ liệu legacy (Vite public/ → /legacy/js/…) */
export const LEGACY_JS_BASE = import.meta.env.BASE_URL + 'legacy/js/';

/** Chèn <script> động (hoạt động trên cả file:// lẫn http) */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Không tải được ' + src));
    try {
      (document.head || document.body).appendChild(s);
    } catch (err) {
      // môi trường test không bật JS loading (happy-dom) — coi như lỗi tải
      reject(err instanceof Error ? err : new Error('Không tải được ' + src));
    }
  });
}

/** Chạy 1 thao tác tải — tránh tải trùng (dedupe theo key) */
export function once<T>(cache: Map<string, Promise<T>>, key: string, loader: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  const p = loader().finally(() => cache.delete(key));
  cache.set(key, p);
  return p;
}
