/**
 * HomeScreen — "Hôm nay": chọn bài học (chỉ hiện bài; từ hiện khi bấm "Học bài này").
 */
import { useEffect, useMemo, useState } from 'react';
import type { WordEntry } from '@english/shared';
import { Button, Card, EmptyState, ProgressBar, Stat } from '../../components/ui';
import { DAILY_QUOTA } from '../../data/courses';
import { lessonLearnedCount, loadLesson, type LessonMeta } from '../../data/lessons';
import type { ExtraSeedRow } from '../../data/registry';
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

  return (
    <>
      <div className="hero">
        <h2>
          {greeting} {course.icon} 👋
        </h2>
        <p>
          Hôm nay là{' '}
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          . Hãy học vài từ {course.name.toLowerCase()} nhé!
        </p>
        <div className="stats">
          <Stat>
            📖 Đã học hôm nay:{' '}
            <b>
              {learned.length}/{quota}
            </b>{' '}
            từ
          </Stat>
          {streak > 0 ? (
            <Stat>
              🔥 <b>{streak}</b> ngày liên tiếp
            </Stat>
          ) : null}
          <Stat>
            🗂️ Còn <b>{allNew.length}</b> từ mới
          </Stat>
        </div>
        <ProgressBar pct={pct} />
      </div>

      {course.seed === 'en' && lessons.length > 0 && <LessonPanel lessons={lessons} />}

      {missingTarget > 0 ? (
        <Card
          style={{ background: 'var(--amber-soft)', borderColor: '#f5dcae', padding: '12px 16px' }}
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

/** Panel chọn bài học (en) — chỉ hiện CÁC BÀI; từ của bài hiện khi bấm "Học bài này" */
function LessonPanel({ lessons }: { lessons: LessonMeta[] }) {
  const store = useCourseStore();
  // Bài đang mở từ (chỉ được đặt khi bấm "Học bài này")
  const [active, setActive] = useState<string | null>(null);

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
          <small className="help" style={{ whiteSpace: 'nowrap' }}>
            cuộn để xem thêm ↓
          </small>
        ) : null}
      </div>
      <div className="lesson-scroll">
        <div className="lesson-grid">
          {lessons.map((l) => {
            const inCourse = l.id ? store.entries.filter((e) => e.lessonId === l.id).length : 0;
            return (
              <div key={l.id} className={'lesson-card' + (active === l.id ? ' selected' : '')}>
                <div className="lt">{l.title}</div>
                <div className="lm">
                  🏷️ {l.tag} · {l.count} từ
                  {inCourse > 0 ? ` · đã thêm ${inCourse}` : ''}
                </div>
                <Button
                  size="sm"
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={async () => {
                    await store.pickLesson(l.id);
                    setActive(l.id);
                  }}
                >
                  Học bài này →
                </Button>
              </div>
            );
          })}
        </div>
      </div>
      {active ? (
        <LessonWords key={active} lessonId={active} onClose={() => setActive(null)} />
      ) : (
        <small className="help" style={{ marginTop: 10, display: 'block' }}>
          💡 Bấm "Học bài này" để thêm từ của bài vào kho và xem danh sách từ bên dưới.
        </small>
      )}
    </Card>
  );
}

/** Từ vựng của bài đã bấm "Học bài này" — đọc thẳng file bài */
function LessonWords({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const store = useCourseStore();
  const course = store.course;
  const [lesson, setLesson] = useState<(LessonMeta & { words: ExtraSeedRow[] }) | null>(null);

  useEffect(() => {
    let alive = true;
    loadLesson(lessonId)
      .then((l) => {
        if (alive) setLesson(l);
      })
      .catch(() => {
        if (alive) setLesson(null);
      });
    return () => {
      alive = false;
    };
  }, [lessonId]);

  // Bản đồ từ đã có trong kho (theo word) để chấm trạng thái từng từ
  const byWord = useMemo(() => {
    const m = new Map<string, WordEntry>();
    store.entries.forEach((e) => m.set(e.word.toLowerCase(), e));
    return m;
  }, [store.entries]);

  const inCourse = lesson
    ? lesson.words.filter((r) => byWord.has(String(r[0] || '').toLowerCase())).length
    : 0;
  const learned = lesson ? lessonLearnedCount(lessonId, store.entries) : 0;
  const total = lesson ? lesson.words.length : 0;
  const target = course?.target.code || 'vi';

  if (!lesson)
    return (
      <div style={{ marginTop: 12 }}>
        <EmptyState big="📘" title="Đang tải bài học…">
          <p style={{ margin: 0 }}>
            Nếu mãi không tải, hãy chạy <code>node tools/build-lessons.js</code>.
          </p>
        </EmptyState>
      </div>
    );

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: 15 }}>{lesson.title}</h4>
          <small className="help">
            🏷️ {lesson.tag} · {total} từ · Đã học <b>{learned}</b> · Trong kho{' '}
            <b>
              {inCourse}/{total}
            </b>
          </small>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {inCourse > 0 ? (
            <Button
              variant="soft"
              size="sm"
              onClick={() => {
                store.setGameLesson(lessonId);
                store.setTab('games');
              }}
            >
              🎮 Ôn bài này
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            ▲ Thu gọn
          </Button>
        </div>
      </div>
      <ul className="word-list">
        {lesson.words.map((row, i) => {
          const w = String(row[0] || '').toLowerCase();
          const e = byWord.get(w);
          const status = e ? e.learningStatus : 'todo';
          const label = !e
            ? 'chưa học'
            : e.learningStatus === 'new'
              ? 'mới'
              : e.learningStatus === 'mastered'
                ? 'đã thuộc'
                : 'đang học';
          return (
            <li
              key={w + i}
              className="word-item"
              style={e ? {} : { cursor: 'default' }}
              onClick={
                e
                  ? () => {
                      store.openDetail(e.id);
                      store.setTab('vocab');
                    }
                  : undefined
              }
            >
              <span className={`status-dot ${status}`} />
              <div style={{ flex: 1 }}>
                <div className="w">
                  {row[0]}
                  {row[1] ? <span className="ipa"> {row[1]}</span> : null}
                </div>
                <div className="meta">
                  {row[2] ? <span>{row[2]}</span> : null}
                  {row[4] ? <span> · {row[4]}</span> : null}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color:
                    status === 'mastered'
                      ? '#0ea5e9'
                      : status === 'learning'
                        ? 'var(--brand-strong)'
                        : status === 'new'
                          ? 'var(--amber)'
                          : 'var(--ink-3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
      {!inCourse ? (
        <small className="help" style={{ marginTop: 8, display: 'block' }}>
          💡 Bấm "Học bài này" để thêm {target === 'vi' ? 'nghĩa Việt + phiên âm' : 'toàn bộ từ'}{' '}
          của bài vào kho và bắt đầu học.
        </small>
      ) : null}
    </div>
  );
}
