/**
 * HomeScreen — "Hôm nay": hub điều hướng.
 *   - Hero: lời chào + vòng tiến độ + stat pills (bấm → chuyển trang).
 *   - Quick actions: 4 thẻ nhanh (học từ mới / ôn tập / kho từ / thống kê) — click → chuyển trang.
 *   - Bài học từ vựng: lưới card, "Học bài này" → trang học bài.
 */
import { useMemo } from 'react';
import { Button, Card, ProgressRing } from '../../components/ui';
import { DAILY_QUOTA } from '../../data/courses';
import { type LessonMeta } from '../../data/lessons';
import { useLessons } from './useLessons';
import { todayStr } from '../../lib/format';
import { computeStreak, learnedToday } from '../../lib/learning';
import { useCourseStore } from '../../store/useCourseStore';

export function HomeScreen() {
  const store = useCourseStore();
  const course = store.course;
  const entries = store.entries;
  const daily = store.daily;
  const lessons = useLessons();

  const today = todayStr();
  const learned = learnedToday(daily, today);
  const quota = DAILY_QUOTA;
  const pct = Math.min(100, Math.round((learned.length / quota) * 100));
  const streak = computeStreak(daily, today);

  const allNew = useMemo(
    () => entries.filter((e) => e.learningStatus === 'new' && !learned.includes(e.id)),
    [entries, learned],
  );
  const missingTarget = course
    ? allNew.filter((e) => !(e.senses || []).some((s) => s.meaning?.[course.target.code])).length
    : 0;

  if (!course) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dateLabel = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <div className="hero hero-ring">
        <ProgressRing pct={pct} size={86} stroke={10}>
          <b>
            {learned.length}/{quota}
          </b>
        </ProgressRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>
            {greeting} {course.icon} 👋
          </h2>
          <p className="hero-date">
            {dateLabel} — hãy học vài từ {course.name.toLowerCase()} nhé!
          </p>
          <div className="stats">
            <button
              className="stat stat-btn"
              onClick={() => store.setTab('stats')}
              title="Xem thống kê"
            >
              📖 Đã học hôm nay:{' '}
              <b>
                {learned.length}/{quota}
              </b>{' '}
              từ
            </button>
            {streak > 0 ? (
              <button
                className="stat stat-btn"
                onClick={() => store.setTab('stats')}
                title="Xem thống kê"
              >
                🔥 <b>{streak}</b> ngày liên tiếp
              </button>
            ) : null}
            <button
              className="stat stat-btn"
              onClick={() => store.setTab('vocab')}
              title="Mở kho từ vựng"
            >
              🗂️ Còn <b>{allNew.length}</b> từ mới
            </button>
          </div>
        </div>
      </div>

      <QuickActions />

      {lessons.length > 0 && <LessonPanel lessons={lessons} />}

      {missingTarget > 0 ? (
        <Card
          style={{
            background: 'var(--amber-soft)',
            borderColor: 'var(--amber-soft)',
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>
            💡 Có <b>{missingTarget}</b> từ chưa có bản dịch {course.target.label} — chỉ hiện từ đã
            có bản dịch đầy đủ.
          </div>
        </Card>
      ) : null}
    </>
  );
}

/** 4 thẻ điều hướng nhanh — click → chuyển trang (học bài / games / vocab / stats) */
function QuickActions() {
  const store = useCourseStore();
  const lessons = useLessons();
  const isZh = store.course?.seed === 'zh';

  const startNextLesson = () => {
    // Bài kế tiếp chưa học hết (theo thứ tự manifest)
    const next =
      lessons.find((l) => store.entries.filter((e) => e.lessonId === l.id).length < l.count) ||
      lessons[0];
    if (next) void store.startLessonStudy(next.id);
    else store.setTab('vocab');
  };

  return (
    <div className="quick-actions">
      <button className="quick-card" onClick={startNextLesson}>
        <span className="qc-ico">📖</span>
        <span className="qc-body">
          <b>Học từ mới</b>
          <small>Mở bài kế tiếp, tua từng từ</small>
        </span>
        <span className="chev">›</span>
      </button>
      {isZh ? (
        <>
          <button className="quick-card" onClick={() => void store.setZhView('srs')}>
            <span className="qc-ico">⭐</span>
            <span className="qc-body">
              <b>Ôn tập hôm nay</b>
              <small>Thẻ nhớ SRS · Lại/Khó/Tốt/Dễ</small>
            </span>
            <span className="chev">›</span>
          </button>
          <button className="quick-card" onClick={() => store.setTab('grammar')}>
            <span className="qc-ico">📘</span>
            <span className="qc-body">
              <b>Ngữ pháp HSK</b>
              <small>422 điểm theo từng cấp</small>
            </span>
            <span className="chev">›</span>
          </button>
        </>
      ) : (
        <button className="quick-card" onClick={() => store.setTab('games')}>
          <span className="qc-ico">🎮</span>
          <span className="qc-body">
            <b>Ôn tập</b>
            <small>Flashcard · dịch · đồng/trái nghĩa</small>
          </span>
          <span className="chev">›</span>
        </button>
      )}
      <button className="quick-card" onClick={() => store.setTab('vocab')}>
        <span className="qc-ico">📚</span>
        <span className="qc-body">
          <b>{isZh ? 'Từ điển ' + store.course?.name : 'Kho từ vựng'}</b>
          <small>{isZh ? 'HSK 3.0 · tra theo Hán tự/pinyin' : 'Tìm kiếm & xem chi tiết từ'}</small>
        </span>
        <span className="chev">›</span>
      </button>
      <button className="quick-card" onClick={() => store.setTab('stats')}>
        <span className="qc-ico">📊</span>
        <span className="qc-body">
          <b>Thống kê</b>
          <small>Tiến độ theo cấp · 7 ngày gần nhất{isZh ? '' : ' · streak 🔥'}</small>
        </span>
        <span className="chev">›</span>
      </button>
    </div>
  );
}

/** Panel chọn bài học (en) — "Học bài này" mở trang học bài (tua từng từ) */
function LessonPanel({ lessons }: { lessons: LessonMeta[] }) {
  const store = useCourseStore();

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0 }}>📚 Bài học từ vựng</h3>
        {lessons.length > 6 ? (
          <small className="help lesson-scroll-hint" style={{ whiteSpace: 'nowrap' }}>
            cuộn để xem thêm ↓
          </small>
        ) : null}
      </div>
      <div className="lesson-scroll">
        <div className="lesson-grid">
          {lessons.map((l) => {
            const inCourse = l.id ? store.entries.filter((e) => e.lessonId === l.id).length : 0;
            return (
              <div key={l.id} className="lesson-card">
                <div className="lt">{l.title}</div>
                <div className="lm">
                  🏷️ {l.tag} · {l.count} từ
                  {inCourse > 0 ? ` · đã thêm ${inCourse}` : ''}
                </div>
                <Button
                  size="sm"
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={() => void store.startLessonStudy(l.id)}
                >
                  Học bài này →
                </Button>
                {inCourse > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    style={{ width: '100%', marginTop: 6 }}
                    onClick={() => {
                      store.setGameLesson(l.id);
                      store.setTab('games');
                    }}
                  >
                    🎮 Ôn bài này
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <small className="help" style={{ marginTop: 10, display: 'block' }}>
        💡 Bấm "Học bài này" để mở trang học từng từ của bài (từ cũng được thêm vào kho).
      </small>
    </Card>
  );
}
