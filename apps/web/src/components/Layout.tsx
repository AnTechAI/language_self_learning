/**
 * Layout.tsx — Khung app (Design v4 "Từ điển biên tập"): rail trái (desktop) /
 * nav dưới (mobile) + masthead topbar + main. Tham chiếu chinese-app-ui.jsx.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AccountModal } from '../features/account/AccountModal';
import { computeStreak } from '../lib/learning';
import { todayStr } from '../lib/format';
import { useCourseStore, type Tab } from '../store/useCourseStore';

const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'home', ico: '🏠', label: 'Hôm nay' },
  { id: 'vocab', ico: '📖', label: 'Từ vựng' },
  { id: 'games', ico: '🧠', label: 'Ôn tập' },
  { id: 'stats', ico: '📈', label: 'Thống kê' },
];

/** Tab riêng của khóa TIẾNG TRUNG (ngữ pháp theo cấp) */
const ZH_TABS: (typeof TABS)[number][] = [
  ...TABS.slice(0, 3),
  { id: 'grammar', ico: '📜', label: 'Ngữ pháp' },
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

  const isZh = course?.seed === 'zh';
  const tabs = course?.seed === 'zh' ? ZH_TABS : TABS;
  const eyebrow = isZh ? 'Zero → HSK 6' : 'Personal Vocabulary';
  const brandName = isZh ? '从零开始 · Tiếng Trung' : 'English Learning';
  const mark = isZh ? '汉' : 'EN';

  return (
    <div className="app">
      {course ? (
        <nav className="app-nav" aria-label="Điều hướng chính">
          <div className="rail-mark" aria-hidden="true">
            {mark}
          </div>
          {tabs.map((t) => (
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
            className="brand-block"
            style={{ border: 0, background: 'transparent' }}
            onClick={() => void exitCourse()}
            title="Về màn hình chọn khóa"
          >
            <span className="eyebrow">{eyebrow}</span>
            <span className="brand">
              {course?.icon} {brandName}
            </span>
          </button>
          <div className="spacer" />
          {streak > 0 && !isZh ? (
            <span className="stat" title="Số ngày học liên tiếp">
              🔥 <b>{streak}</b>
            </span>
          ) : null}
          <button
            className="icon-chip"
            style={{ fontWeight: 700 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
            aria-label="Đổi giao diện sáng/tối"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="icon-chip"
            style={{ fontWeight: 700 }}
            onClick={() => setShowAccount(true)}
            title="Tài khoản & đồng bộ"
            aria-label="Tài khoản & đồng bộ"
          >
            ⚙️
          </button>
          {course ? (
            <button
              className="chip course-chip"
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
