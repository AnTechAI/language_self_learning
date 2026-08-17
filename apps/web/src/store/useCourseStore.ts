/**
 * useCourseStore.ts — Trạng thái toàn cục app React (zustand).
 * Dữ liệu: IDB (repo — GĐ 2) · Logic: lib/* (port từ legacy) · Render: React.
 * Ngữ nghĩa giống legacy (enterCourse/exitCourse, game session) để dễ đối chiếu.
 */
import { create } from 'zustand';
import type { Course, Settings, WordEntry } from '@english/shared';
import { createRepo, migrateIfNeeded } from '../db';
import { courseById } from '../data/courses';
import { applySeedUpgrade, mergeSeeds, SEED_VERSION } from '../data/seed';
import { ensureLessonInCourse, ensureLessonsManifest, lessonById } from '../data/lessons';
import { zhWordToEntry, type ZhWord } from '../data/zhDict';
import { dueIn, sm2 } from '../lib/zh';
import {
  applyMarkLearned,
  applyResult,
  pushHistory,
  type DailyMap,
  type HistoryRec,
} from '../lib/learning';
import {
  buildChoice,
  buildPool,
  checkTranslate,
  markMissed,
  recordAnswer,
  requeueIfWrong,
  stableSense,
  startChoiceSession,
  startSimpleSession,
  translateTargetCode,
  unmarkMissed,
  type GameSession,
  type GameType,
} from '../lib/games';
import { normalize, todayStr, uid } from '../lib/format';
import {
  ApiClient,
  buildPushBody,
  emptyUpdatedAtMap,
  historyKey,
  loadAccount,
  mergePull,
  newDeviceId,
  saveAccount,
  syncNowIso,
  type UpdatedAtMap,
} from '../lib/sync';
import type { Account } from '@english/shared';

export type Tab = 'home' | 'vocab' | 'games' | 'stats' | 'grammar';

/** Phiên học bài: tua từng từ của bài, cuối bài mở màn hoàn tất */
export interface StudySession {
  lessonId: string;
  words: WordEntry[];
  idx: number;
  done: boolean;
}

const repo = createRepo();
let toastTimer = 0;
let pushTimer = 0;
const api = new ApiClient();
const UPDATED_AT_KEY = 'sync/updatedAt';
const SYNC_CURSOR_KEY = 'sync/cursor';

interface CourseStore {
  /* ---- dữ liệu ---- */
  booted: boolean;
  course: Course | null;
  entries: WordEntry[];
  daily: DailyMap;
  history: HistoryRec[];
  settings: Settings;

  /* ---- UI ---- */
  tab: Tab;
  detailId: string | null;
  vocabLessonId: string | null;
  gameLessonId: string | null;
  lessonFocus: string | null;
  gameScreen: 'menu' | GameType;
  session: GameSession | null;
  /** Chế độ con trong tab Ôn tập (khóa zh): hub / luyện viết / thanh điệu / SRS */
  zhView: 'hub' | 'writing' | 'tone' | 'srs';
  setZhView(v: 'hub' | 'writing' | 'tone' | 'srs'): void;
  /** Từ chỉ định cho Luyện viết (mở từ chi tiết → viết đúng chữ đó) */
  zhWriteTarget: { word: string; pinyin: string } | null;
  setZhWriteTarget(w: { word: string; pinyin: string } | null): void;
  toast: string | null;
  lessonManifestReady: boolean;

  /* ---- Học bài (GĐ 4 — guided walkthrough từng từ) ---- */
  study: StudySession | null;
  startLessonStudy(lessonId: string): Promise<void>;
  nextStudyWord(): void;
  closeStudy(): void;

  /* ---- tài khoản & đồng bộ (GĐ 5) ---- */
  account: Account | null;
  syncStatus: 'off' | 'idle' | 'syncing' | 'synced' | 'error';
  syncError: string | null;
  lastSyncAt: string | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  syncNow(): Promise<void>;

  /* ---- hành động ---- */
  boot(): Promise<void>;
  enterCourse(id: string): Promise<void>;
  exitCourse(): Promise<void>;
  setTab(tab: Tab): void;
  openDetail(id: string): void;
  closeDetail(): void;
  setVocabLesson(id: string | null): void;
  setGameLesson(id: string | null): void;
  setLessonFocus(id: string | null): void;
  showToast(msg: string): void;

  /* ---- ghi dữ liệu ---- */
  saveEntries(): Promise<void>;
  saveDaily(): Promise<void>;
  saveHistory(): Promise<void>;
  saveSettings(): Promise<void>;
  markLearned(entryId: string): Promise<void>;
  registerResult(entryId: string, wasCorrect: boolean): Promise<void>;
  recordHistory(game: string, wordId: string, correct: boolean): Promise<void>;

  /* ---- bài học ---- */
  refreshLessonsManifest(): Promise<void>;
  pickLesson(id: string): Promise<number>;
  /** Bookmark từ điển zh → kho (idempotent theo word) */
  bookmarkZhWord(w: ZhWord): Promise<void>;
  /** Đánh giá SRS (0=Again 1=Hard 2=Good 3=Easy) */
  applySrs(id: string, grade: 0 | 1 | 2 | 3): Promise<void>;

  /* ---- game ---- */
  startGame(type: GameType, onlyIds?: string[]): void;
  startFlashcardWith(ids: string[]): void;
  exitGame(): void;
  flipFlashcard(): void;
  answerFlashcard(known: boolean): void;
  passFlashcard(): void;
  nextChoice(): void;
  answerChoice(word: string): void;
  answerTranslate(userAnswer: string): void;
  advanceTranslate(): void;
  hintTranslate(): void;
  setGameQty(n: number): void;
  replayGame(): void;
}

export const useCourseStore = create<CourseStore>()((set, get) => {
  /** Biến đổi session (clone để React re-render) */
  const touch = (fn: () => void) => {
    fn();
    set((s) => ({ session: s.session ? { ...s.session } : null }));
  };

  /* ================= đồng bộ (GĐ 5) ================= */

  const touchUpdatedAt = async (mutate: (m: UpdatedAtMap) => void): Promise<void> => {
    const cur =
      ((await repo.meta.get(UPDATED_AT_KEY)) as UpdatedAtMap | undefined) ?? emptyUpdatedAtMap();
    mutate(cur);
    await repo.meta.set(UPDATED_AT_KEY, cur);
  };

  const markDirty = (): void => {
    if (!get().account) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => {
      void pushLocal();
    }, 2000);
  };

  /** Push toàn bộ dữ liệu khóa học đang mở lên server (LWW theo updatedAt). */
  const pushLocal = async (): Promise<void> => {
    const { account, course } = get();
    if (!account || !course) return;
    try {
      const map =
        ((await repo.meta.get(UPDATED_AT_KEY)) as UpdatedAtMap | undefined) ?? emptyUpdatedAtMap();
      const now = syncNowIso();
      const body = buildPushBody(
        account.deviceId,
        '',
        course.id,
        get().entries,
        get().daily,
        get().history,
        map,
        now,
      );
      const key = (a: string, b: string) => `${a}\u0000${b}`;
      for (const e of body.entries) map.entries[key(e.courseId, e.word)] = now;
      for (const d of body.daily) map.daily[key(d.courseId, d.date)] = now;
      for (const h of body.history)
        map.history[
          historyKey(h.courseId, { ts: h.ts, game: h.game, wordId: h.word, correct: h.correct })
        ] = now;
      const res = await api.push(body);
      await repo.meta.set(UPDATED_AT_KEY, map);
      if (res.serverCursor) await repo.meta.set(SYNC_CURSOR_KEY, res.serverCursor);
      set({ syncStatus: 'synced', lastSyncAt: new Date().toISOString() });
    } catch (e) {
      set({ syncStatus: 'error', syncError: e instanceof Error ? e.message : 'Đồng bộ lỗi' });
    }
  };

  return {
    booted: false,
    course: null,
    entries: [],
    daily: {},
    history: [],
    settings: {},
    tab: 'home',
    detailId: null,
    vocabLessonId: null,
    gameLessonId: null,
    lessonFocus: null,
    gameScreen: 'menu',
    zhView: 'hub',
    zhWriteTarget: null,
    session: null,
    toast: null,
    lessonManifestReady: false,
    study: null,
    account: null,
    syncStatus: 'off',
    syncError: null,
    lastSyncAt: null,

    /* ================= boot / course ================= */

    boot: async () => {
      await migrateIfNeeded().catch(() => {}); // GĐ 2: localStorage → IDB (1 lần)
      const settings = await repo.settings.get();
      const account = loadAccount();
      if (account) api.token = account.token;
      set({ settings, booted: true, account, syncStatus: account ? 'idle' : 'off' });
      if (settings.courseId && courseById(settings.courseId)) {
        await get().enterCourse(settings.courseId);
      }
    },

    enterCourse: async (id) => {
      const course = courseById(id);
      if (!course) return;
      const settings = { ...get().settings, courseId: id };
      await repo.settings.put(settings);
      set({ course, settings });

      const entries = await repo.entries.list(id);
      const added = mergeSeeds(entries, course.seed);
      let upgraded = 0;
      if (course.seed === 'en' && (settings.seedVersion || 0) < SEED_VERSION) {
        upgraded = applySeedUpgrade(entries, 'en');
        settings.seedVersion = SEED_VERSION;
        await repo.settings.put(settings);
        set({ settings });
      }
      if (added > 0 || upgraded > 0) await repo.entries.replaceAll(id, entries);

      const dailyRecs = await repo.daily.list(id);
      const daily: DailyMap = {};
      dailyRecs.forEach((r) => (daily[r.day] = r.entryIds));
      const history = (await repo.history.list(id)).map((r) => ({
        ts: r.ts,
        game: r.game,
        wordId: r.wordId,
        correct: r.correct,
      }));

      set({
        entries,
        daily,
        history,
        tab: 'home',
        detailId: null,
        vocabLessonId: null,
        gameLessonId: null,
        lessonFocus: null,
        gameScreen: 'menu',
        zhView: 'hub',
        session: null,
        lessonManifestReady: false,
      });
      document.body.dataset.course = id;
      document.body.classList.remove('picker');
    },

    exitCourse: async () => {
      const settings = { ...get().settings };
      delete settings.courseId;
      await repo.settings.put(settings);
      set({
        course: null,
        entries: [],
        daily: {},
        history: [],
        settings,
        tab: 'home',
        detailId: null,
        gameScreen: 'menu',
        zhView: 'hub',
        session: null,
      });
      delete document.body.dataset.course;
      document.body.classList.add('picker');
    },

    /* ================= UI ================= */

    setTab: (tab) => set({ tab, detailId: null, gameScreen: 'menu', session: null, zhView: 'hub' }),
    setZhView: (zhView) => set({ zhView, tab: 'games', gameScreen: 'menu', session: null }),
    setZhWriteTarget: (zhWriteTarget) => set({ zhWriteTarget }),
    openDetail: (id) => set({ detailId: id, tab: 'vocab' }),
    closeDetail: () => set({ detailId: null }),
    setVocabLesson: (id) => set({ vocabLessonId: id }),
    setGameLesson: async (id) => {
      set({ gameLessonId: id });
      if (id) await get().pickLesson(id);
    },
    setLessonFocus: (id) => set({ lessonFocus: id }),

    showToast: (msg) => {
      set({ toast: msg });
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => set({ toast: null }), 2200);
    },

    /* ================= persist ================= */

    saveEntries: async () => {
      const { course, entries } = get();
      if (course) {
        await repo.entries.replaceAll(course.id, entries);
        await touchUpdatedAt((m) => {
          const now = syncNowIso();
          for (const e of entries) m.entries[`${course.id}\u0000${e.id}`] = now;
        });
        markDirty();
      }
    },
    saveDaily: async () => {
      const { course, daily } = get();
      if (course) {
        await repo.daily.replaceAll(course.id, daily);
        await touchUpdatedAt((m) => {
          const now = syncNowIso();
          for (const day of Object.keys(daily)) m.daily[`${course.id}\u0000${day}`] = now;
        });
        markDirty();
      }
    },
    saveHistory: async () => {
      const { course, history } = get();
      if (course) {
        await repo.history.replaceAll(
          course.id,
          history.map((h) => ({ id: uid(), ...h })),
        );
        await touchUpdatedAt((m) => {
          const now = syncNowIso();
          for (const h of history) m.history[historyKey(course.id, h)] = now;
        });
        markDirty();
      }
    },

    saveSettings: async () => {
      await repo.settings.put(get().settings);
    },

    markLearned: async (entryId) => {
      const { entries, daily } = applyMarkLearned(get().entries, get().daily, entryId);
      set({ entries, daily });
      await get().saveEntries();
      await get().saveDaily();
    },

    registerResult: async (entryId, wasCorrect) => {
      const { entries, daily, toasts } = applyResult(
        get().entries,
        get().daily,
        entryId,
        wasCorrect,
      );
      set({ entries, daily });
      toasts.forEach((t) => get().showToast('🎉 Đã thuộc: "' + t.word + '"!'));
      await get().saveEntries();
      await get().saveDaily();
    },

    recordHistory: async (game, wordId, correct) => {
      const history = pushHistory(get().history, {
        ts: new Date().toISOString(),
        game,
        wordId,
        correct,
      });
      set({ history });
      await get().saveHistory();
    },

    /* ================= lessons ================= */

    refreshLessonsManifest: async () => {
      const course = get().course;
      const manifest = await ensureLessonsManifest(course ? course.seed : undefined).catch(
        () => [],
      );
      set({ lessonManifestReady: manifest.length > 0 });
    },

    pickLesson: async (id) => {
      const added = await ensureLessonInCourse(id, get().entries, async (entries) => {
        set({ entries: [...entries] });
        await get().saveEntries();
      });
      const meta = lessonById(id);
      if (added > 0)
        get().showToast('✓ Đã thêm ' + added + ' từ của bài "' + (meta ? meta.title : '') + '"');
      else if (meta) get().showToast('📘 Bài "' + meta.title + '" đã có sẵn trong kho');
      return added;
    },

    /** Bookmark từ trong TỪ ĐIỂN zh → gộp vào kho (idempotent theo word) */
    bookmarkZhWord: async (w) => {
      const course = get().course;
      if (!course || course.seed !== 'zh') return;
      const existing = new Set(get().entries.map((e) => e.word));
      if (existing.has(w.simplified)) {
        get().showToast('⭐ "' + w.simplified + '" đã có trong kho');
        return;
      }
      const e = zhWordToEntry(w);
      const entries = [...get().entries, e];
      set({ entries });
      await get().saveEntries();
      get().showToast('✓ Đã thêm "' + w.simplified + '" vào kho');
    },

    /** Đánh giá ôn tập SRS (grade 0–3) — cập nhật lịch ôn (khóa zh) */
    applySrs: async (id, grade) => {
      const entries = get().entries.map((e) => {
        if (e.id !== id) return e;
        const next = sm2(grade, e.srs);
        const due = grade === 0 ? dueIn(0) : dueIn(Math.max(1, next.interval));
        return { ...e, srs: { ...next, due }, lastReviewDay: todayStr() };
      });
      set({ entries });
      await get().saveEntries();
    },

    /* ================= Học bài (guided walkthrough) ================= */

    startLessonStudy: async (lessonId) => {
      await get().pickLesson(lessonId); // gộp từ bài vào kho (idempotent)
      const words = get().entries.filter((e) => e.lessonId === lessonId);
      if (!words.length) {
        get().showToast('Bài học không có từ nào');
        return;
      }
      set({ study: { lessonId, words, idx: 0, done: false } });
    },

    nextStudyWord: () => {
      const s = get().study;
      if (!s) return;
      if (s.idx < s.words.length - 1) set({ study: { ...s, idx: s.idx + 1 } });
      else set({ study: { ...s, done: true } });
    },

    closeStudy: () => set({ study: null }),

    /* ================= games ================= */

    startGame: (type, onlyIds) => {
      const { entries, course, settings, gameLessonId } = get();
      if (!course) return;
      const qty = Number(settings.gameQty) || 0;
      const pool = buildPool(entries, course, { lessonId: gameLessonId, onlyIds });

      if (type === 'synonym' || type === 'antonym') {
        const session = startChoiceSession(type, pool, qty);
        if (!session.queue.length) {
          get().showToast(
            'Không có từ nào có dữ liệu ' + (type === 'synonym' ? 'đồng nghĩa' : 'trái nghĩa'),
          );
          return;
        }
        set({ gameScreen: type, session });
        get().nextChoice();
        return;
      }

      if (!pool.length) {
        get().showToast('Chưa có từ nào để ôn');
        return;
      }
      // translate-en chỉ giữ từ có định nghĩa tiếng Anh (meaning.en) trên sense hiển thị
      let usable = pool;
      if (type === 'translate-en') {
        usable = pool.filter((e) =>
          (e.senses || []).some((s) => s.meaning?.en && String(s.meaning.en).trim()),
        );
        if (!usable.length) {
          get().showToast('Chưa có từ nào có định nghĩa tiếng Anh để chơi');
          return;
        }
      }
      const targetCode = type === 'translate-en' ? 'en' : course.target.code;
      const session = startSimpleSession(type, usable, qty, targetCode);
      set({ gameScreen: type, session });
    },

    startFlashcardWith: (ids) => {
      const { entries, course } = get();
      if (!course) return;
      const pool = buildPool(entries, course, { onlyIds: ids });
      if (!pool.length) {
        get().showToast('Không có từ nào để ôn');
        return;
      }
      const session = startSimpleSession('flashcard', pool, 0, course.target.code);
      set({ tab: 'games', gameScreen: 'flashcard', session });
    },

    exitGame: () => set({ gameScreen: 'menu', session: null }),

    flipFlashcard: () => {
      touch(() => {
        const s = get().session;
        if (!s) return;
        if (!s.revealed && !s.seenOnce) s.seenOnce = true;
        s.revealed = !s.revealed;
      });
    },

    answerFlashcard: (known) => {
      const s = get().session;
      if (!s) return;
      const entry = s.queue[s.idx];
      if (!entry) return;
      void get().registerResult(entry.id, known);
      void get().recordHistory('flashcard', entry.id, known);
      touch(() => {
        recordAnswer(s, entry, known);
        s.revealed = false;
        s.seenOnce = false;
      });
    },

    passFlashcard: () => {
      touch(() => {
        const s = get().session;
        if (!s) return;
        s.idx++;
        s.revealed = false;
        s.seenOnce = false;
      });
    },

    nextChoice: () => {
      touch(() => {
        const s = get().session;
        if (!s) return;
        if (s.idx >= s.queue.length) return;
        // Nguồn nhiễu = pool của phiên (giữ phạm vi bài học); thiếu thì dùng toàn bộ kho
        buildChoice(s, get().entries, s.pool || undefined);
      });
    },

    answerChoice: (word) => {
      const s = get().session;
      if (!s || !s.current) return;
      const { entry, correctWord } = s.current;
      const isCorrect = normalize(word) === normalize(correctWord);
      void get().registerResult(entry.id, isCorrect);
      void get().recordHistory(s.type, entry.id, isCorrect);
      touch(() => {
        recordAnswer(s, entry, isCorrect);
        s.lastAnswer = { chosen: word, correctWord, isCorrect };
      });
    },

    answerTranslate: (userAnswer) => {
      const s = get().session;
      const { course } = get();
      if (!s || !course) return;
      const entry = s.queue[s.idx];
      if (!entry || s.answered) return;
      const isCorrect = checkTranslate(course, s, entry, userAnswer);
      void get().registerResult(entry.id, isCorrect);
      void get().recordHistory(s.type, entry.id, isCorrect);
      const sense = stableSense(entry, s);
      const code = translateTargetCode(course, s.type);
      // translate-en: đáp án là TỪ VỰNG; translate-vi: nghĩa tiếng Việt
      const correctWord =
        s.type === 'translate-en'
          ? entry.word
          : (sense?.meaning?.[code] as string | undefined) || '';
      touch(() => {
        s.answered = true;
        s.lastAnswer = { chosen: userAnswer, correctWord, word: entry.word, isCorrect };
        // KHÔNG tăng idx tại đây — giữ nguyên câu đang hỏi để màn feedback
        // hiển thị đúng câu vừa trả lời (prompt + masked + chips); "next" mới tăng.
        s.total = (s.total || 0) + 1;
        s.streakNow = isCorrect ? (s.streakNow || 0) + 1 : 0;
        if (isCorrect) {
          s.correct = (s.correct || 0) + 1;
          unmarkMissed(s, entry.id);
        } else {
          markMissed(s, entry.id);
          requeueIfWrong(s, entry);
        }
      });
    },

    hintTranslate: () => {
      touch(() => {
        const s = get().session;
        if (!s) return;
        s.hints = (s.hints || 0) + 1;
      });
    },

    advanceTranslate: () => {
      touch(() => {
        const s = get().session;
        if (!s || s.idx >= s.queue.length) return;
        s.answered = false;
        s.lastAnswer = undefined;
        s.hints = 0;
        if (s.idx >= s.queue.length - 1)
          s.idx = s.queue.length; // hết bài → Summary
        else s.idx++;
      });
    },

    setGameQty: (n) => {
      const settings = { ...get().settings, gameQty: n };
      set({ settings });
      void get().saveSettings();
    },

    replayGame: () => {
      const s = get().session;
      if (s) get().startGame(s.type);
    },

    /* ================= tài khoản & đồng bộ (GĐ 5) ================= */

    login: async (email, password) => {
      set({ syncStatus: 'syncing', syncError: null });
      try {
        const res = await api.login(email.trim(), password);
        const account: Account = { email: res.email, token: res.token, deviceId: newDeviceId() };
        api.token = account.token;
        saveAccount(account);
        set({ account, syncStatus: 'idle' });
        await get().syncNow();
      } catch (e) {
        set({ syncStatus: 'error', syncError: e instanceof Error ? e.message : 'Đăng nhập lỗi' });
        throw e;
      }
    },

    register: async (email, password) => {
      set({ syncStatus: 'syncing', syncError: null });
      try {
        const res = await api.register(email.trim(), password);
        const account: Account = { email: res.email, token: res.token, deviceId: newDeviceId() };
        api.token = account.token;
        saveAccount(account);
        set({ account, syncStatus: 'idle' });
        await get().syncNow();
      } catch (e) {
        set({ syncStatus: 'error', syncError: e instanceof Error ? e.message : 'Đăng ký lỗi' });
        throw e;
      }
    },

    logout: async () => {
      const acc = get().account;
      if (acc) {
        try {
          await api.logout();
        } catch {
          /* mất mạng — vẫn đăng xuất cục bộ */
        }
      }
      api.token = null;
      saveAccount(null);
      clearTimeout(pushTimer);
      set({ account: null, syncStatus: 'off', syncError: null, lastSyncAt: null });
    },

    syncNow: async () => {
      const { account, course } = get();
      if (!account) return;
      set({ syncStatus: 'syncing', syncError: null });
      try {
        const cursor = ((await repo.meta.get(SYNC_CURSOR_KEY)) as string | undefined) ?? '';
        const pull = await api.pull(cursor);
        const localMap =
          ((await repo.meta.get(UPDATED_AT_KEY)) as UpdatedAtMap | undefined) ??
          emptyUpdatedAtMap();
        if (course) {
          const merged = mergePull(
            course.id,
            get().entries,
            get().daily,
            get().history,
            localMap,
            pull,
          );
          await repo.entries.replaceAll(course.id, merged.entries);
          await repo.daily.replaceAll(course.id, merged.daily);
          await repo.history.replaceAll(
            course.id,
            merged.history.map((h) => ({ id: uid(), ...h })),
          );
          await repo.meta.set(UPDATED_AT_KEY, merged.map);
          if (pull.serverCursor) await repo.meta.set(SYNC_CURSOR_KEY, pull.serverCursor);
          set({ entries: merged.entries, daily: merged.daily, history: merged.history });
        }
        // Push tiếp dữ liệu local mới hơn server (sau khi đã merge pull)
        // — pushLocal tự set syncStatus (synced / error)
        if (course) {
          await pushLocal();
        } else {
          set({ syncStatus: 'synced', lastSyncAt: new Date().toISOString() });
        }
      } catch (e) {
        set({ syncStatus: 'error', syncError: e instanceof Error ? e.message : 'Đồng bộ lỗi' });
      }
    },
  };
});
