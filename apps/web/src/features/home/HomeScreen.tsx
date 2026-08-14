/**
 * HomeScreen — "Hôm nay": tiến độ từ mới, học theo bài, thẻ từ mới, ôn tập nhanh.
 */
import { useMemo, useState } from 'react';
import type { WordEntry } from '@english/shared';
import { Button, Card, EmptyState, PosChips, ProgressBar, Speak, Stat } from '../../components/ui';
import { DAILY_QUOTA } from '../../data/courses';
import { type LessonMeta } from '../../data/lessons';
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

/** Panel chọn bài học (en) */
function LessonPanel({ lessons }: { lessons: LessonMeta[] }) {
  const store = useCourseStore();
  const [selected, setSelected] = useState(lessons[0]?.id || '');

  return (
    <Card>
      <h3>📚 Học từ mới theo bài học</h3>
      <div className="row">
        <select
          className="input grow"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title} ({l.count} từ)
            </option>
          ))}
        </select>
        <Button
          onClick={async () => {
            if (!selected) return;
            store.setLessonFocus(selected);
            await store.pickLesson(selected);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          Học bài này →
        </Button>
      </div>
      <small className="help" style={{ marginTop: 6, display: 'block' }}>
        Chọn bài → các từ của bài được tự thêm vào kho và hiện ngay bên dưới để học.
      </small>
    </Card>
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
