/**
 * sync.ts — Đồng bộ dữ liệu với server English Learning API (GĐ 5).
 *
 * 2 phần tách nhau:
 *   - ApiClient: gọi REST (register/login/logout/push/pull/dictionary) — thuần fetch.
 *   - buildPushBody / mergePull: biến đổi dữ liệu local ↔ payload (thuần, dễ test).
 *
 * Nguyên tắc local-first: app chạy offline hoàn toàn; sync chỉ chạy khi NGƯỜI DÙNG
 * đăng nhập + bấm đồng bộ (hoặc tự push chậm 2s sau mỗi thay đổi khi đã đăng nhập).
 * Không bao giờ gọi fetch khi chưa có token → test/smoke không đụng mạng.
 *
 * Merge theo updatedAt (muộn hơn thắng) — khóa: entries = (courseId, entry.id),
 * daily = (courseId, date), history = (courseId, ts+game+word) khớp server.
 */
import type {
  Account,
  HistoryRecord,
  SyncPullResult,
  SyncPushBody,
  WordEntry,
} from '@english/shared';

export const ACCOUNT_KEY = 'el_sync_account';
export const SYNC_SCHEMA_VERSION = 1;

/** API base URL — đổi bằng env VITE_API_URL (mặc định dev local) */
export const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL) ||
  'http://localhost:8000';

/* ---------------- lưu tài khoản (localStorage — token, không lưu mật khẩu) ---------------- */

export function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const acc = JSON.parse(raw) as Account;
    return acc && acc.token && acc.email ? acc : null;
  } catch {
    return null;
  }
}

export function saveAccount(acc: Account | null): void {
  try {
    if (acc) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* localStorage có thể không có (private mode) — bỏ qua, sync vẫn chạy trong phiên */
  }
}

export function newDeviceId(): string {
  try {
    const existing = localStorage.getItem('el_sync_device');
    if (existing) return existing;
    const id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('el_sync_device', id);
    return id;
  } catch {
    return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/* ---------------- API client ---------------- */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class ApiClient {
  constructor(
    public base: string = API_BASE,
    public token: string | null = null,
  ) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (init?.body) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, { ...init, headers });
    } catch {
      throw new ApiError(0, 'Không kết nối được máy chủ — kiểm tra mạng');
    }
    if (!res.ok) {
      let detail = `Lỗi ${res.status}`;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        /* không parse được JSON */
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as T;
  }

  async register(email: string, password: string): Promise<{ token: string; email: string }> {
    return this.req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string): Promise<{ token: string; email: string }> {
    return this.req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    if (!this.token) return;
    try {
      await this.req('/api/auth/logout', { method: 'POST' });
    } catch {
      /* logout cục bộ vẫn được */
    }
  }

  async me(): Promise<{ email: string }> {
    return this.req('/api/me');
  }

  async push(body: SyncPushBody): Promise<{ serverCursor: string }> {
    return this.req('/api/sync/push', { method: 'POST', body: JSON.stringify(body) });
  }

  async pull(since: string): Promise<SyncPullResult> {
    const q = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.req(`/api/sync/pull${q}`);
  }
}

/* ---------------- build payload từ state local ---------------- */

export interface UpdatedAtMap {
  entries: Record<string, string>; // khóa `${courseId}\u0000${entryId}`
  daily: Record<string, string>; // khóa `${courseId}\u0000${date}`
  history: Record<string, string>; // khóa `${courseId}\u0000${ts}\u0000${game}\u0000${word}`
}

export function emptyUpdatedAtMap(): UpdatedAtMap {
  return { entries: {}, daily: {}, history: {} };
}

/** Payload push — mọi dòng đều kèm updatedAt để server merge LWW (courseId = khóa học đang mở) */
export function buildPushBody(
  clientId: string,
  deviceName: string,
  courseId: string,
  entries: WordEntry[],
  daily: Record<string, string[]>,
  history: HistoryRecord[],
  map: UpdatedAtMap,
  now: string,
): SyncPushBody {
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  return {
    clientId,
    deviceName,
    updatedAt: now,
    entries: entries.map((e) => ({
      courseId,
      word: e.id,
      dataJson: JSON.stringify(e),
      updatedAt: map.entries[key(courseId, e.id)] || now,
    })),
    daily: Object.entries(daily).map(([date, ids]) => ({
      courseId,
      date,
      entryIds: ids,
      updatedAt: map.daily[key(courseId, date)] || now,
    })),
    history: history.map((h) => {
      const k = historyKey(courseId, h);
      return {
        courseId,
        ts: h.ts,
        game: h.game,
        word: h.wordId,
        correct: h.correct,
        updatedAt: map.history[k] || now,
      };
    }),
  };
}

/** Map dòng local → khóa ổn định (khớp server) để merge LWW */
export function localKey(courseId: string, entry: WordEntry): string {
  return `${courseId}\u0000${entry.id}`;
}
export function dailyKey(courseId: string, date: string): string {
  return `${courseId}\u0000${date}`;
}
export function historyKey(courseId: string, h: HistoryRecord): string {
  return `${courseId}\u0000${h.ts}\u0000${h.game}\u0000${h.wordId}`;
}

/**
 * Merge dữ liệu pull về vào state local (theo updatedAt, muộn hơn thắng).
 * Trả về: entries mới (đã gộp), daily mới, history mới, map updatedAt mới,
 * và danh sách entry cần xóa (deleted).
 */
export function mergePull(
  courseId: string,
  localEntries: WordEntry[],
  localDaily: Record<string, string[]>,
  localHistory: HistoryRecord[],
  localMap: UpdatedAtMap,
  pull: SyncPullResult,
): {
  entries: WordEntry[];
  daily: Record<string, string[]>;
  history: HistoryRecord[];
  map: UpdatedAtMap;
  removedIds: { courseId: string; id: string }[];
} {
  const map: UpdatedAtMap = {
    entries: { ...localMap.entries },
    daily: { ...localMap.daily },
    history: { ...localMap.history },
  };
  const byId = new Map(localEntries.map((e) => [e.id, e]));
  const removedIds: { courseId: string; id: string }[] = [];

  // entries: LWW theo updatedAt (chỉ của khóa học đang mở)
  for (const se of pull.entries) {
    if (se.courseId !== courseId) continue;
    const k = `${se.courseId}\u0000${se.word}`;
    const localAt = map.entries[k];
    if (localAt && localAt > se.updatedAt) continue; // local mới hơn — giữ
    if (se.deleted) {
      byId.delete(se.word);
      removedIds.push({ courseId: se.courseId, id: se.word });
    } else {
      try {
        const parsed = JSON.parse(se.dataJson) as WordEntry;
        byId.set(se.word, parsed);
      } catch {
        continue; // data hỏng — bỏ qua
      }
    }
    map.entries[k] = se.updatedAt;
  }

  // daily: LWW theo (courseId, date)
  const daily: Record<string, string[]> = { ...localDaily };
  for (const sd of pull.daily) {
    if (sd.courseId !== courseId) continue;
    const k = `${sd.courseId}\u0000${sd.date}`;
    const localAt = map.daily[k];
    if (localAt && localAt > sd.updatedAt) continue;
    daily[sd.date] = sd.entryIds;
    map.daily[k] = sd.updatedAt;
  }

  // history: thêm dòng chưa có (khóa ts+game+word) — không xóa bao giờ
  const seen = new Set(localHistory.map((h) => historyKey(courseId, h)));
  const history = [...localHistory];
  for (const sh of pull.history) {
    if (sh.courseId !== courseId) continue;
    const rec: HistoryRecord = { ts: sh.ts, game: sh.game, wordId: sh.word, correct: sh.correct };
    const k = historyKey(courseId, rec);
    if (!seen.has(k)) {
      seen.add(k);
      history.push(rec);
    }
    map.history[k] = sh.updatedAt;
  }

  return { entries: [...byId.values()], daily, history, map, removedIds };
}

/** updatedAt hiện tại dạng ISO micro giây — dùng làm cursor (so sánh chuỗi) */
export function syncNowIso(): string {
  const d = new Date();
  const iso = d.toISOString().replace('Z', '000+00:00'); // thêm micro giây
  return iso;
}
