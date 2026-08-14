/**
 * bank.ts — Tra từ điển ngoại tuyến (port từ legacy bank-loader.js).
 * Tải ĐÚNG 1 chunk chứa từ cần tra (không nạp 25MB); hỏng/thiếu → trả [] an toàn.
 */
import { initShim, loadScript, once, reg, LEGACY_JS_BASE, type BankRow } from './registry';

const pending = new Map<string, Promise<void>>();

/** FNV-1a 32-bit — PHẢI khớp tools/build-chunks.js (đừng đổi một phía) */
export function bankHash(word: string): number {
  let h = 0x811c9dc5;
  const w = String(word || '').toLowerCase();
  for (let i = 0; i < w.length; i++) {
    h ^= w.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Tên chunk chứa từ */
export function bankChunkName(word: string): string | null {
  const n = (reg.bankManifest || []).length;
  if (!n) return null;
  return 'chunk-' + String(bankHash(word) % n).padStart(3, '0') + '.js';
}

async function ensureManifest(): Promise<void> {
  if (reg.bankManifest.length) return;
  await once(pending, 'manifest', () =>
    loadScript(LEGACY_JS_BASE + 'bank/manifest.js').catch(() => {}),
  );
}

/** Tra từ — trả mọi entry khớp (mọi nghĩa/loại từ). Chunk thiếu → [] */
export async function bankLookup(word: string): Promise<BankRow[]> {
  initShim();
  const w = String(word || '').toLowerCase().trim();
  if (!w) return [];
  await ensureManifest();
  const name = bankChunkName(w);
  if (!name) return [];
  if (!reg.bankChunks.has(name)) {
    await once(pending, name, () => loadScript(LEGACY_JS_BASE + 'bank/' + name).catch(() => {}));
  }
  const rows = reg.bankChunks.get(name) || [];
  return rows.filter((r) => r[0] === w);
}

/** Giao diện tra từ — trả {senses, synonyms, antonyms} giống API online */
export async function bankLookupWord(word: string): Promise<{
  senses: { pronunciation: string; partOfSpeech: string; meaning: { en: string; vi?: string }; examples: string[] }[];
  synonyms: string[];
  antonyms: string[];
} | null> {
  const rows = await bankLookup(word);
  if (!rows.length) return null;
  const senses = rows.map((r) => ({
    pronunciation: r[7] || '',
    partOfSpeech: r[1] || '',
    meaning: { en: r[2] || '', ...(r[6] ? { vi: r[6] } : {}) },
    examples: r[3] ? [r[3]] : [],
  }));
  const syn = new Set<string>();
  const ant = new Set<string>();
  rows.forEach((r) => {
    (r[4] || []).forEach((s) => syn.add(s));
    (r[5] || []).forEach((a) => ant.add(a));
  });
  return { senses, synonyms: [...syn].slice(0, 8), antonyms: [...ant].slice(0, 8) };
}
