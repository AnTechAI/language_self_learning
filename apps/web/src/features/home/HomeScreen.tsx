/**
 * HomeScreen — tab "Bài học" (Design en theo lexicon-ui.jsx).
 * Danh sách bài học dạng thẻ: vòng tiến độ + thanh tiến độ + nút Học bài/
 * Tiếp tục/Ôn tập. Bấm bài → chạy guided study (LessonStudyScreen) hoặc
 * mở flashcard của riêng bài (khi đã học xong).
 */
import { useMemo } from 'react';
import { DAILY_QUOTA } from '../../data/courses';
import { lessonLearnedCount, type LessonMeta } from '../../data/lessons';
import { todayStr } from '../../lib/format';
import { learnedToday } from '../../lib/learning';
import { useCourseStore } from '../../store/useCourseStore';
import { useLessons } from './useLessons';

/** Bảng màu tuần tự cho từng bài (theo lexicon-ui.jsx) */
const LESSON_COLORS = ['#256B67', '#C98A2E', '#7A6B9E', '#B14A3C', '#3E7CA6'];

function lessonNum(id: string): number {
  const m = String(id || '').match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

export function HomeScreen() {
  const store = useCourseStore();
  const course = store.course;
  const lessons = useLessons();
  const daily = store.daily;
  const today = todayStr();
  const todayCount = learnedToday(daily, today).length;

  const statsById = useMemo(() => {
    const m = new Map<string, { learned: number; pct: number; done: boolean }>();
    lessons.forEach((l) => {
      const learned = lessonLearnedCount(l.id, store.entries);
      m.set(l.id, {
        learned,
        pct: l.count ? Math.round((learned / l.count) * 100) : 0,
        done: learned >= l.count,
      });
    });
    return m;
  }, [lessons, store.entries]);

  if (!course) return null;

  return (
    <div className="lex-page">
      <div className="lex-page-head">
        <h2 className="lex-title">Bài học</h2>
        <span className="lex-today">
          📖 Đã học hôm nay: <b>{todayCount}</b>/{DAILY_QUOTA} từ
        </span>
      </div>

      <div className="lex-lesson-list">
        {lessons.length === 0 ? (
          <p className="lex-empty">Đang tải danh sách bài học…</p>
        ) : (
          lessons.map((l, i) => (
            <LessonCard
              key={l.id}
              lesson={l}
              color={LESSON_COLORS[i % LESSON_COLORS.length]}
              learned={statsById.get(l.id)?.learned ?? 0}
              pct={statsById.get(l.id)?.pct ?? 0}
              done={statsById.get(l.id)?.done ?? false}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LessonCard({
  lesson,
  color,
  learned,
  pct,
  done,
}: {
  lesson: LessonMeta;
  color: string;
  learned: number;
  pct: number;
  done: boolean;
}) {
  const store = useCourseStore();

  const start = () => {
    if (done) {
      // Đã học xong bài → ôn flashcard đúng phạm vi bài
      const ids = store.entries.filter((e) => e.lessonId === lesson.id).map((e) => e.id);
      store.setGameLesson(lesson.id);
      store.startGame('flashcard', ids);
    } else {
      void store.startLessonStudy(lesson.id);
    }
  };

  const label = done ? 'Ôn tập' : learned > 0 ? 'Tiếp tục' : 'Học bài';

  return (
    <div className="lex-lesson-card">
      <div className="ll-ring" style={{ borderColor: color, color }}>
        {pct}%
      </div>
      <div className="ll-body">
        <div className="ll-eye">Bài {lessonNum(lesson.id)}</div>
        <div className="ll-title">{lesson.title}</div>
        <div className="ll-bar">
          <div className="ll-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="ll-meta">
          {learned}/{lesson.count} từ · {lesson.tag}
        </div>
      </div>
      <button
        className="ll-btn"
        style={{
          borderColor: done ? color : 'var(--line)',
          background: done ? color : 'transparent',
          color: done ? '#fff' : 'var(--ink-3)',
        }}
        onClick={start}
      >
        {label} →
      </button>
    </div>
  );
}
