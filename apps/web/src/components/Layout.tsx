/**
 * Layout.tsx — Khung app: header (brand + streak) + main + bottom nav.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AccountModal } from '../features/account/AccountModal';
import { computeStreak } from '../lib/learning';
import { todayStr } from '../lib/format';
import { useCourseStore, type Tab } from '../store/useCourseStore';

const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'home', ico: '🏠', label: 'Hôm nay' },
  { id: 'vocab', ico: '📚', label: 'Từ vựng' },
  { id: 'games', ico: '🎮', label: 'Ôn tập' },
  { id: 'stats', ico: '📊', label: 'Thống kê' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const course = useCourseStore((s) => s.course);
  const tab = useCourseStore((s) => s.tab);
  const setTab = useCourseStore((s) => s.setTab);
  const exitCourse = useCourseStore((s) => s.exitCourse);
  const daily = useCourseStore((s) => s.daily);
  const streak = computeStreak(daily, todayStr());
  const [showAccount, setShowAccount] = useState(false);

  return (
    <div className="app">
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
        <button
          className="chip"
          style={{ fontWeight: 700 }}
          onClick={() => setShowAccount(true)}
          title="Tài khoản & đồng bộ"
        >
          ⚙️
        </button>
        {streak > 0 ? (
          <span className="stat" title="Số ngày học liên tiếp">
            🔥 <b>{streak}</b>
          </span>
        ) : null}
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
      {showAccount ? <AccountModal onClose={() => setShowAccount(false)} /> : null}
      {course ? (
        <nav className="app-nav">
          {TABS.map((t) => (
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
    </div>
  );
}
