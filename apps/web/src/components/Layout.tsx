/**
 * Layout.tsx — Khung app: header (brand + theme + streak + account) + main + bottom nav.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AccountModal } from '../features/account/AccountModal';
import { computeStreak } from '../lib/learning';
import { todayStr } from '../lib/format';
import { useCourseStore, type Tab } from '../store/useCourseStore';

const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'home', ico: '📖', label: 'Bài học' },
  { id: 'vocab', ico: '🗂️', label: 'Từ vựng' },
  { id: 'games', ico: '🧠', label: 'Ôn tập' },
  { id: 'stats', ico: '📈', label: 'Thống kê' },
];

/** Tab riêng của khóa TIẾNG TRUNG (ngữ pháp theo cấp) */
const ZH_TABS: (typeof TABS)[number][] = [
  ...TABS.slice(0, 3),
  { id: 'grammar', ico: '📘', label: 'Ngữ pháp' },
  TABS[3],
];

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function AppShell({ children }: { children: ReactNode }) {
  const course = useCourseStore((s) => s.course);
  const tab = useCourseStore((s) => s.tab);
  const setTab = useCourseStore((s) => s.setTab);
  const exitCourse = useCourseStore((s) => s.exitCourse);
  const daily = useCourseStore((s) => s.daily);
  const streak = computeStreak(daily, todayStr());
  const [showAccount, setShowAccount] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme);

  // Đồng bộ trạng thái theme với DOM + localStorage
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('el_theme', theme);
    } catch {
      /* bỏ qua */
    }
  }, [theme]);

  return (
    <div className="app">
      {course ? (
        <nav className="app-nav" aria-label="Điều hướng chính">
          <button
            className="nav-brand"
            onClick={() => void exitCourse()}
            title="Về màn hình chọn khóa"
          >
            <span>
              {course?.icon || '🎓'} Lexicon
              <small>English</small>
            </span>
          </button>
          {(course?.seed === 'zh' ? ZH_TABS : TABS).map((t) => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="ico">{t.ico}</span>
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}
      <div className="rail-main">
        <header className="app-header">
          <button
            className="brand"
            style={{ border: 0, background: 'transparent' }}
            onClick={() => void exitCourse()}
            title="Về màn hình chọn khóa"
          >
            {course?.icon || '🎓'} <span>English Learning</span>
          </button>
          <div className="spacer" />
          {streak > 0 && course?.seed !== 'zh' ? (
            <span className="stat" title="Số ngày học liên tiếp">
              🔥 <b>{streak}</b>
            </span>
          ) : null}
          <button
            className="chip icon-chip"
            style={{ fontWeight: 700 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
            aria-label="Đổi giao diện sáng/tối"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="chip icon-chip"
            style={{ fontWeight: 700 }}
            onClick={() => setShowAccount(true)}
            title="Tài khoản & đồng bộ"
            aria-label="Tài khoản & đồng bộ"
          >
            ⚙️
          </button>
          {course ? (
            <button
              className="chip"
              style={{ fontWeight: 700 }}
              onClick={() => void exitCourse()}
              title="Đổi khóa học"
            >
              {course.icon} {course.name} ⇄
            </button>
          ) : null}
        </header>
        <main className="app-main">{children}</main>
      </div>
      {showAccount ? <AccountModal onClose={() => setShowAccount(false)} /> : null}
    </div>
  );
}
