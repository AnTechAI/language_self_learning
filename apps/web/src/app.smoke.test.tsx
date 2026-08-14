/**
 * app.smoke.test.tsx — Smoke test render toàn bộ App React (happy-dom).
 * Mục tiêu: bắt lỗi runtime (selector sai, hook lỗi…) khi port màn hình.
 * Giả lập IndexedDB bằng fake-indexeddb (giống db.test.ts).
 */
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import App from './App';
import { createRepo } from './db';
import { useCourseStore } from './store/useCourseStore';

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;

/** Reset trạng thái global giữa các test (zustand + dữ liệu IDB) */
async function resetAll() {
  useCourseStore.setState({
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
    session: null,
    toast: null,
    lessonManifestReady: false,
  });
  // Xóa dữ liệu qua repo riêng (không deleteDatabase — connection cũ của store
  // vẫn mở sẽ làm deleteDatabase bị block trong fake-indexeddb)
  const repo = createRepo();
  await repo.settings.put({});
  for (const id of ['en', 'zh'] as const) {
    await repo.entries.replaceAll(id, []);
    await repo.daily.replaceAll(id, {});
    await repo.history.replaceAll(id, []);
  }
}

/** Chờ điều kiện (boot/enterCourse là async — poll thay vì sleep cố định) */
async function waitFor(fn: () => boolean, timeout = 4000, step = 20): Promise<void> {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > timeout) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, step));
  }
}

beforeEach(async () => {
  await resetAll();
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await resetAll();
});

describe('App smoke', () => {
  it('render màn hình chọn khóa (chưa có course) và có 2 khóa', async () => {
    await act(async () => {
      root.render(<App />);
    });
    await waitFor(() => !!container.querySelector('button.course-card'));
    expect(container.textContent).toContain('Tiếng Anh');
    expect(container.textContent).toContain('Tiếng Trung');
  });

  it('chọn khóa Tiếng Anh → vào app, hiện Hôm nay', async () => {
    await act(async () => {
      root.render(<App />);
    });
    await waitFor(() => !!container.querySelector('button.course-card'));
    const cards = [...container.querySelectorAll('button.course-card')];
    expect(cards.length).toBe(2);
    await act(async () => {
      (cards[0] as HTMLButtonElement).click();
    });
    await waitFor(() => useCourseStore.getState().course?.id === 'en');
    await waitFor(() => useCourseStore.getState().entries.length === 524, 8000);
    await waitFor(() => container.textContent?.includes('Ôn tập nhanh'));
    expect(container.querySelector('.app-nav')).toBeTruthy();
    expect(useCourseStore.getState().entries.length).toBe(524);
  });

  it('điều hướng tab: Từ vựng → Ôn tập → Thống kê', async () => {
    await act(async () => {
      root.render(<App />);
    });
    await waitFor(() => !!container.querySelector('button.course-card'));
    const cards = [...container.querySelectorAll('button.course-card')];
    await act(async () => {
      (cards[0] as HTMLButtonElement).click();
    });
    await waitFor(() => useCourseStore.getState().course?.id === 'en');

    const clickNav = async (label: string) => {
      const btn = [...container.querySelectorAll('button.nav-btn')].find((b) =>
        b.textContent?.includes(label),
      );
      expect(btn, `nav "${label}"`).toBeTruthy();
      await act(async () => {
        (btn as HTMLButtonElement).click();
      });
    };

    await clickNav('Từ vựng');
    await waitFor(() => container.textContent?.includes('Tất cả từ'));

    await clickNav('Ôn tập');
    await waitFor(() => container.textContent?.includes('Flashcard'));

    await clickNav('Thống kê');
    await waitFor(() => container.textContent?.includes('Kho từ vựng'));
  });
});
