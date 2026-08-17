/**
 * HomeScreen — "Hôm nay": hub điều hướng.
 *   - Hero: lời chào + vòng tiến độ + stat pills (bấm → chuyển trang).
 *   - Quick actions: 4 thẻ nhanh (học từ mới / ôn tập / kho từ / thống kê) — click → chuyển trang.
 *   - Bài học từ vựng: lưới card, "Học bài này" → trang học bài.
 */
import { useMemo, useState } from 'react';
import { Button, Card, Chip, ProgressBar, ProgressRing } from '../../components/ui';
import { DAILY_QUOTA } from '../../data/courses';
import { type LessonMeta } from '../../data/lessons';
import { useLessons } from './useLessons';
import { normalize, todayStr } from '../../lib/format';
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

/** Số thứ tự bài từ id 'lesson-zh-012' → 12, 'lesson-003' → 3 */
function lessonNum(id: string): string {
  const m = String(id || '').match(/(\d+)\s*$/);
  return m ? m[1] : '';
}

/** Panel chọn bài học — lọc theo nhóm, tìm kiếm, xem tiến độ từng bài */
function LessonPanel({ lessons }: { lessons: LessonMeta[] }) {
  const store = useCourseStore();
  const [tag, setTag] = useState('all');
  const [q, setQ] = useState('');

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    lessons.forEach((l) => m.set(l.tag, (m.get(l.tag) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lessons]);

  const filtered = useMemo(() => {
    const nq = q.trim() ? normalize(q) : '';
    return lessons.filter((l) => {
      if (tag !== 'all' && l.tag !== tag) return false;
      if (!nq) return true;
      return normalize(l.title).includes(nq) || normalize(l.tag).includes(nq);
    });
  }, [lessons, tag, q]);

  const statsById = useMemo(() => {
    const m = new Map<string, { added: number; mastered: number; done: boolean }>();
    lessons.forEach((l) => {
      const owned = store.entries.filter((e) => e.lessonId === l.id);
      const added = owned.length;
      const mastered = owned.filter((e) => e.learningStatus === 'mastered').length;
      m.set(l.id, { added, mastered, done: added >= l.count });
    });
    return m;
  }, [lessons, store.entries]);

  const doneCount = lessons.filter((l) => statsById.get(l.id)?.done).length;
  const addedWords = lessons.reduce((a, l) => a + (statsById.get(l.id)?.added ?? 0), 0);
  const totalWords = lessons.reduce((a, l) => a + l.count, 0);
  const overall = totalWords ? Math.round((addedWords / totalWords) * 100) : 0;

  return (
    <Card className="lesson-panel">
      <div className="lp-head">
        <div className="lp-title">
          <h3 style={{ margin: 0 }}>📚 Bài học từ vựng</h3>
          <small className="help">
            {lessons.length} bài · {totalWords} từ · đã mở <b>{addedWords}</b> từ
          </small>
        </div>
        <div className="lp-sum">
          <span className="stat" title="Bài đã mở đủ số từ vào kho">
            ✅{' '}
            <b>
              {doneCount}/{lessons.length}
            </b>{' '}
            bài xong
          </span>
        </div>
      </div>
      <ProgressBar pct={overall} />

      {/* Thanh lọc — dính trên đầu khi cuộn danh sách dài */}
      <div className="lesson-toolbar">
        <div className="chip-row">
          <Chip active={tag === 'all'} onClick={() => setTag('all')}>
            Tất cả ({lessons.length})
          </Chip>
          {tags.map(([t, n]) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
              {t} ({n})
            </Chip>
          ))}
        </div>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Tìm bài…"
          style={{ marginTop: 8 }}
        />
      </div>

      <div className="lesson-scroll">
        {filtered.length === 0 ? (
          <p className="help" style={{ padding: '14px 4px' }}>
            Không có bài phù hợp — đổi bộ lọc hoặc từ khoá nhé.
          </p>
        ) : (
          <div className="lesson-grid">
            {filtered.map((l) => {
              const s = statsById.get(l.id) || { added: 0, mastered: 0, done: false };
              const pct = l.count ? Math.min(100, Math.round((s.added / l.count) * 100)) : 0;
              return (
                <div key={l.id} className={'lesson-card' + (s.done ? ' lc-done' : '')}>
                  <div className="lc-top">
                    <span className="lev-badge">{l.tag}</span>
                    {lessonNum(l.id) ? <span className="lc-num">#{lessonNum(l.id)}</span> : null}
                  </div>
                  <div className="lt">{l.title}</div>
                  <div className="lm">
                    {l.count} từ
                    {s.added > 0 ? ` · mở ${s.added}` : ''}
                    {s.mastered > 0 ? ` · 🎓 ${s.mastered}` : ''}
                  </div>
                  {s.added > 0 && !s.done ? (
                    <div className="lesson-progress" title={`${pct}% từ đã mở`}>
                      <span className="lp-bar" style={{ width: pct + '%' }} />
                    </div>
                  ) : null}
                  {s.done ? <span className="lesson-stamp">✓ ĐÃ HỌC</span> : null}
                  <div className="lc-actions">
                    {s.done ? (
                      <Button
                        size="sm"
                        style={{ width: '100%' }}
                        onClick={() => {
                          store.setGameLesson(l.id);
                          store.setTab('games');
                        }}
                      >
                        🎮 Ôn bài này
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        style={{ width: '100%' }}
                        onClick={() => void store.startLessonStudy(l.id)}
                      >
                        {s.added === 0 ? 'Học bài này →' : 'Học tiếp →'}
                      </Button>
                    )}
                    {s.done ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ width: '100%', marginTop: 6 }}
                        onClick={() => void store.startLessonStudy(l.id)}
                      >
                        Học lại
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <small className="help" style={{ marginTop: 10, display: 'block' }}>
        💡 "Học bài này" mở trang học từng từ của bài — từ được thêm vào kho để ôn lại sau. Tem{' '}
        <b>✓ ĐÃ HỌC</b> xuất hiện khi đã mở đủ số từ của bài.
      </small>
    </Card>
  );
}
