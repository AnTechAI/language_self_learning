/**
 * StatsScreen — "Thống kê": tổng quan kho từ, chuỗi ngày, lịch sử gần nhất.
 */
import { useMemo } from 'react';
import { Card, EmptyState, ProgressBar, Stat } from '../../components/ui';
import { todayStr } from '../../lib/format';
import { computeStreak, learnedToday, type DailyMap } from '../../lib/learning';
import { useCourseStore } from '../../store/useCourseStore';

export function StatsScreen() {
  const store = useCourseStore();
  const course = store.course;
  const entries = store.entries;
  const daily = store.daily;
  const history = store.history;

  const today = todayStr();
  const learned = learnedToday(daily, today);
  const streak = computeStreak(daily, today);

  const counts = useMemo(
    () => ({
      new: entries.filter((e) => e.learningStatus === 'new').length,
      learning: entries.filter((e) => e.learningStatus === 'learning').length,
      mastered: entries.filter((e) => e.learningStatus === 'mastered').length,
    }),
    [entries],
  );
  const pct = entries.length ? Math.round((counts.mastered / entries.length) * 100) : 0;

  const recent = useMemo(
    () => [...history].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 10),
    [history],
  );
  const correctRate = history.length
    ? Math.round((history.filter((h) => h.correct).length / history.length) * 100)
    : 0;

  if (!course) return null;
  const gameName: Record<string, string> = {
    flashcard: '🃏 Flashcard',
    'translate-en': '📖 Dịch nghĩa Anh–Anh',
    'translate-vi': '✍️ Dịch nghĩa → ' + course.target.label,
    synonym: '🔁 Đồng nghĩa',
    antonym: '↔️ Trái nghĩa',
    tone: '🎵 Thanh điệu',
    srs: '⭐ Ôn tập hôm nay',
  };

  const zh = course.seed === 'zh';
  // Tiến độ theo cấp HSK (khóa zh): từ đã trong kho / tổng từ điển mỗi cấp (số gần đúng từ bài+bookmark)
  const byLevel = [1, 2, 3, 4, 5, 6].map((lv) => {
    const have = entries.filter((e) => e.level === lv).length;
    const done = entries.filter((e) => e.level === lv && e.learningStatus === 'mastered').length;
    return { lv, have, done };
  });

  return (
    <>
      <div className="hero">
        <h2>📊 Thống kê</h2>
        <p>Theo dõi tiến độ học {course.name.toLowerCase()} của bạn.</p>
        <div className="stats">
          {!zh ? (
            <Stat>
              🔥 <b>{streak}</b> ngày liên tiếp
            </Stat>
          ) : null}
          <Stat>
            📖 Hôm nay <b>{learned.length}</b> từ
          </Stat>
          <Stat>
            🎯 Đúng <b>{correctRate}%</b>
          </Stat>
        </div>
      </div>

      {zh ? (
        <Card>
          <h3 style={{ margin: '0 0 4px' }}>Tiến độ theo cấp HSK</h3>
          <small className="help">Từ đã bổ sung vào kho / đã thuộc — theo cấp độ của bài học</small>
          <div
            className="stats"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
              gap: 8,
              marginTop: 10,
            }}
          >
            {byLevel.map(({ lv, have, done }) => (
              <Stat key={lv}>
                <b>HSK {lv}</b>
                <br />
                <span style={{ fontSize: 13 }}>
                  {done}/{have} đã thuộc
                </span>
              </Stat>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <h3 style={{ margin: '0 0 4px' }}>Hoạt động 7 ngày</h3>
        <small className="help">Số từ đã học mỗi ngày</small>
        <WeekBars daily={daily} />
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 10px' }}>Kho từ vựng</h3>
        <div className="stats">
          <Stat>📚 {entries.length} từ</Stat>
          <Stat>🟡 {counts.new} mới</Stat>
          <Stat>🟢 {counts.learning} đang học</Stat>
          <Stat>🔵 {counts.mastered} đã thuộc</Stat>
        </div>
        <ProgressBar pct={pct} />
        <small className="help" style={{ display: 'block', marginTop: 6 }}>
          {pct}% kho từ đã thuộc — 3 lần trả lời đúng liên tiếp để chuyển sang "Đã thuộc".
        </small>
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 10px' }}>Lịch sử gần nhất</h3>
        {recent.length === 0 ? (
          <EmptyState big="📭">Chưa có hoạt động nào — hãy chơi một trò ôn tập nhé!</EmptyState>
        ) : (
          <ul className="word-list">
            {recent.map((h, i) => {
              const w = entries.find((e) => e.id === h.wordId);
              return (
                <li key={i} className="word-item" onClick={() => w && store.openDetail(w.id)}>
                  <span style={{ fontSize: 16 }}>{h.correct ? '✅' : '❌'}</span>
                  <div style={{ flex: 1 }}>
                    <div className="w">{w ? w.word : h.wordId}</div>
                    <div className="meta">
                      {gameName[h.game] || h.game} ·{' '}
                      {new Date(h.ts).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

/** Biểu đồ hoạt động 7 ngày gần nhất (số từ học mỗi ngày) */
function WeekBars({ daily }: { daily: DailyMap }) {
  const days = useMemo(() => {
    const out: { label: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = todayStr(d);
      const label =
        i === 0 ? 'Nay' : d.toLocaleDateString('vi-VN', { weekday: 'narrow' }).replace('.', '');
      out.push({ label, n: (daily[key] || []).length });
    }
    return out;
  }, [daily]);

  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <div className="mini-bars">
      {days.map((d, i) => (
        <div
          key={i}
          className={'bar-col' + (i === 6 ? ' today' : '')}
          title={`${d.label}: ${d.n} từ`}
        >
          <div
            className={'bar' + (d.n ? '' : ' zero')}
            style={{ height: `${(d.n / max) * 100}%` }}
          />
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
