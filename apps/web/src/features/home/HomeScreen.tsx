/**
 * HomeScreen — "Hôm nay": tiến độ từ mới, chọn bài học, thẻ từ mới, ôn tập nhanh.
 */
import { useEffect, useMemo, useState } from 'react';
import type { WordEntry } from '@english/shared';
import { Button, Card, EmptyState, PosChips, ProgressBar, Speak, Stat } from '../../components/ui';
import { DAILY_QUOTA } from '../../data/courses';
import { lessonLearnedCount, loadLesson, type LessonMeta } from '../../data/lessons';
import type { ExtraSeedRow } from '../../data/registry';
import { useLessons } from './useLessons';
import { pickSense, todayStr } from '../../lib/format';
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
  const newWords = useMemo(
    () =>
      allNew.filter((e) => (e.senses || []).some((s) => s.meaning?.[course?.target.code || ''])),
    [allNew, course],
  );
  const current = newWords[0] || null;
  const missingTarget = course ? allNew.length - newWords.length : 0;

  const due = useMemo(
    () => entries.filter((e) => e.learningStatus !== 'new' && e.lastReviewDay !== today),
    [entries, today],
  );
  const dueShow = due.slice(0, 5);

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

      {current ? (
        <Card>
          <h3>Từ mới tiếp theo</h3>
          <NewWordCard entry={current} />
        </Card>
      ) : (
        <Card>
          <EmptyState
            big={learned.length > 0 ? '🎉' : '🌱'}
            title={learned.length > 0 ? 'Hết từ mới cho hôm nay!' : 'Bắt đầu ngay hôm nay'}
          >
            <p style={{ margin: 0 }}>
              {learned.length > 0
                ? `Bạn đã học ${learned.length} từ. Ngày mai quay lại để học tiếp nhé.`
                : 'Bấm nút bên dưới để xem từ mới đầu tiên.'}
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <Button
                variant={learned.length > 0 ? 'soft' : 'primary'}
                onClick={() => {
                  if (learned.length > 0) store.startFlashcardWith(due.map((d) => d.id));
                  else if (newWords[0]) void store.markLearned(newWords[0].id);
                }}
              >
                {learned.length > 0 ? '🗂️ Ôn tập ngay' : 'Học từ mới đầu tiên →'}
              </Button>
            </div>
          </EmptyState>
        </Card>
      )}

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

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Ôn tập nhanh hôm nay</h2>
          {due.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => store.startFlashcardWith(due.map((d) => d.id))}
            >
              Ôn tất cả ({due.length})
            </Button>
          ) : null}
        </div>
        {dueShow.length === 0 ? (
          <EmptyState big="✅">
            Hôm nay bạn đã ôn xong các từ đã học. Học từ mới lên nào!
          </EmptyState>
        ) : (
          <ul className="word-list">
            {dueShow.map((e) => {
              const m = e.senses?.[0]?.meaning;
              return (
                <li key={e.id} className="word-item" onClick={() => store.openDetail(e.id)}>
                  <span className={`status-dot ${e.learningStatus}`} />
                  <div style={{ flex: 1 }}>
                    <div className="w">{e.word}</div>
                    <div className="meta">
                      <PosChips entry={e} />
                      {m?.[course.target.code] ? ` · ${m[course.target.code]}` : ''}
                    </div>
                  </div>
                  <span className="chev">›</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

/** Panel chọn bài học (en) — lưới bài + từ của bài khi chọn */
function LessonPanel({ lessons }: { lessons: LessonMeta[] }) {
  const store = useCourseStore();
  // Tự chọn bài đầu tiên để nội dung hiện ngay, không cần thêm 1 cú click
  const [selected, setSelected] = useState<string | null>(lessons[0]?.id || null);

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
              <div
                key={l.id}
                className={'lesson-card' + (selected === l.id ? ' selected' : '')}
                onClick={() => setSelected(l.id)}
              >
                <div className="lt">{l.title}</div>
                <div className="lm">
                  🏷️ {l.tag} · {l.count} từ
                  {inCourse > 0 ? ` · đã thêm ${inCourse}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selected ? (
        <LessonWords key={selected} lessonId={selected} />
      ) : (
        <small className="help" style={{ marginTop: 10, display: 'block' }}>
          Chọn 1 bài để xem từ vựng và bắt đầu học.
        </small>
      )}
    </Card>
  );
}

/** Từ vựng của bài đã chọn — đọc thẳng file bài (xem trước, chưa cần gộp vào kho) */
function LessonWords({ lessonId }: { lessonId: string }) {
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

  const allMerged = inCourse >= total;
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
          {!allMerged ? (
            <Button
              size="sm"
              onClick={async () => {
                await store.pickLesson(lessonId);
              }}
            >
              Học bài này →
            </Button>
          ) : null}
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

/** Thẻ từ mới (nhìn + đánh giá đã hiểu / ôn lại sau) */
function NewWordCard({ entry }: { entry: WordEntry }) {
  const store = useCourseStore();
  const course = store.course;
  const s0 = pickSense(entry);
  const m = s0?.meaning || {};
  const target = course ? m[course.target.code] || '' : '';

  return (
    <div className="learn-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800 }}>{entry.word}</span>
        {course ? <Speak text={entry.word} lang={course.source.code} /> : null}
        {s0?.pronunciation ? (
          <span className="ipa" style={{ color: 'var(--ink-3)' }}>
            {s0.pronunciation}
          </span>
        ) : null}
      </div>
      <div style={{ margin: '6px 0' }}>
        <PosChips entry={entry} />
      </div>
      <div className="def" style={{ fontSize: 16 }}>
        {target}
      </div>
      {s0?.meaning?.en ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{s0.meaning.en}</div>
      ) : null}
      {s0?.examples?.[0] ? (
        <div style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 13, marginTop: 6 }}>
          ❝ {s0.examples[0]}
        </div>
      ) : null}
      <div className="row" style={{ marginTop: 14 }}>
        <Button
          variant="ghost"
          style={{ flex: 1 }}
          onClick={() => void store.markLearned(entry.id)}
        >
          🔄 Ôn lại sau
        </Button>
        <Button style={{ flex: 2 }} onClick={() => void store.markLearned(entry.id)}>
          ✓ Tôi đã hiểu từ này
        </Button>
      </div>
    </div>
  );
}
