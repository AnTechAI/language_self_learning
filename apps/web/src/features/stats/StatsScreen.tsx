/**
 * StatsScreen — tab "Thống kê" (Design en theo lexicon-ui.jsx).
 * 4 thẻ số + biểu đồ 7 ngày (CSS bars) + thanh tiến độ từng bài.
 */
import { useMemo } from 'react';
import { lessonLearnedCount } from '../../data/lessons';
import { todayStr } from '../../lib/format';
import { computeStreak, learnedToday, type DailyMap } from '../../lib/learning';
import { useCourseStore } from '../../store/useCourseStore';
import { useLessons } from '../home/useLessons';

export function StatsScreen() {
  const store = useCourseStore();
  const course = store.course;
  const entries = store.entries;
  const daily = store.daily;
  const lessons = useLessons();

  const today = todayStr();
  const streak = computeStreak(daily, today);
  const learnedTodayCount = learnedToday(daily, today).length;

  const mastered = useMemo(
    () => entries.filter((e) => e.learningStatus === 'mastered').length,
    [entries],
  );
  const completedLessons = useMemo(
    () => lessons.filter((l) => lessonLearnedCount(l.id, entries) >= l.count).length,
    [lessons, entries],
  );

  const week = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = todayStr(d);
      const label =
        i === 0 ? 'Nay' : d.toLocaleDateString('vi-VN', { weekday: 'narrow' }).replace('.', '');
      days.push({ date: key, label, count: (daily[key] || []).length });
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    return days.map((d) => ({ ...d, h: Math.round((d.count / max) * 100) }));
  }, [daily]);

  const lessonRows = useMemo(
    () =>
      lessons.map((l) => {
        const learned = lessonLearnedCount(l.id, entries);
        return { lesson: l, learned, pct: l.count ? Math.round((learned / l.count) * 100) : 0 };
      }),
    [lessons, entries],
  );

  if (!course) return null;

  return (
    <div className="lex-page">
      <div className="lex-page-head">
        <h2 className="lex-title">Thống kê</h2>
        <span className="lex-today">
          🏆 Chuỗi ngày: <b>{streak}</b> ngày
        </span>
      </div>

      <div className="lex-stat-grid">
        <StatCard label="Từ đã học" value={entries.length} hint="Tổng trong kho từ vựng" />
        <StatCard
          label="Đã thuộc"
          value={mastered}
          hint={`${entries.length ? Math.round((mastered / entries.length) * 100) : 0}% kho`}
        />
        <StatCard label="Hôm nay" value={learnedTodayCount} hint="Từ học hôm nay" />
        <StatCard label="Bài xong" value={completedLessons} hint={`/${lessons.length} bài học`} />
      </div>

      <section className="lex-section">
        <h3 className="lex-section-title">7 ngày gần nhất</h3>
        <div className="lex-week">
          {week.map((d) => (
            <div className="lw-col" key={d.date}>
              <span className="lw-val">{d.count || ''}</span>
              <div className="lw-track">
                <div
                  className="lw-fill"
                  style={{ height: `${d.h}%`, opacity: d.count ? 1 : 0.25 }}
                />
              </div>
              <span className="lw-day">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lex-section">
        <h3 className="lex-section-title">Kho từ vựng · tiến độ từng bài</h3>
        <div className="lex-lesson-bars">
          {lessonRows.map((r) => (
            <div className="lb-row" key={r.lesson.id}>
              <span className="lb-name">{r.lesson.title}</span>
              <div className="ll-bar">
                <div className="ll-fill" style={{ width: `${r.pct}%` }} />
              </div>
              <span className="lb-num">
                {r.learned}/{r.lesson.count}
              </span>
            </div>
          ))}
          {lessonRows.length === 0 ? <p className="lex-empty">Chưa có bài học nào.</p> : null}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="lex-stat-card">
      <div className="lsc-label">{label}</div>
      <div className="lsc-value">{value}</div>
      <div className="lsc-hint">{hint}</div>
    </div>
  );
}

export type { DailyMap };
