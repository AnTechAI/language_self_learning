/**
 * VocabScreen — "Từ vựng" (khóa Tiếng Anh): bố cục 2-pane theo Design v4.
 * Trái: chip bài học + tìm kiếm + lọc trạng thái + danh sách từ.
 * Phải: chi tiết từ (WordDetail) mở ngay trong khung — không tách trang.
 */
import { useMemo, useState } from 'react';
import { Button, Chip, EmptyState, Speak } from '../../components/ui';
import { lessonById, lessonLearnedCount, type LessonMeta } from '../../data/lessons';
import { useCourseStore } from '../../store/useCourseStore';
import { useLessons } from '../home/useLessons';

export function VocabScreen() {
  const store = useCourseStore();
  const course = store.course;
  const detailId = store.detailId;
  const closeDetail = store.closeDetail;
  const lessons = useLessons();
  const [mobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);

  if (!course) return null;

  // Mobile + đã chọn từ → hiện chi tiết toàn màn, danh sách ẩn
  if (mobile && detailId) {
    return (
      <div className="dict-page">
        <div className="dict-topbar">
          <Button variant="ghost" size="sm" onClick={() => closeDetail()}>
            ← Về danh sách từ
          </Button>
        </div>
        <WordDetail id={detailId} />
      </div>
    );
  }

  return (
    <div className="dict-page">
      <div className="dict-topbar">
        <p className="eyebrow">Vocabulary</p>
        <div className="title-row">
          <h1 className="title-display">Kho từ vựng</h1>
          <span>{store.entries.length} từ · chọn bài học để lọc</span>
        </div>
        <ChipsRow lessons={lessons} />
      </div>

      <div className="dict-body">
        <LeftPane />
        <div className="dict-detail">
          {detailId ? (
            <WordDetail id={detailId} />
          ) : (
            <div className="dict-detail-inner">
              <p className="dict-hint" style={{ fontSize: 15, paddingTop: 12 }}>
                👈 Chọn một từ bên trái để xem chi tiết.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipsRow({ lessons }: { lessons: LessonMeta[] }) {
  const store = useCourseStore();
  const items = [
    <Chip key="all" active={!store.vocabLessonId} onClick={() => store.setVocabLesson(null)}>
      Tất cả từ ({store.entries.length})
    </Chip>,
    ...lessons.map((l) => (
      <Chip
        key={l.id}
        active={store.vocabLessonId === l.id}
        onClick={() => {
          store.setVocabLesson(l.id);
          void store.pickLesson(l.id);
        }}
      >
        📘 {l.title}
      </Chip>
    )),
  ];
  return <div className="chips">{items}</div>;
}

/** Danh sách từ của 1 bài học (chỉ en) */
function LessonWords({ lessonId }: { lessonId: string }) {
  const store = useCourseStore();
  const meta = lessonById(lessonId);
  const lessonEntries = store.entries.filter((e) => e.lessonId === lessonId);
  const learned = lessonLearnedCount(lessonId, store.entries);
  if (!meta) return <p className="dict-hint">Đang tải bài học…</p>;

  return (
    <>
      <div className="list-head">
        <div>
          <b>{meta.title}</b>
          <small>
            🏷️ {meta.tag} · Đã học {learned}/{lessonEntries.length || meta.count} từ
          </small>
        </div>
        {lessonEntries.length < meta.count ? (
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
      <ul className="word-list">
        {lessonEntries.map((e) => (
          <WordRow key={e.id} id={e.id} />
        ))}
      </ul>
      {!lessonEntries.length ? (
        <p className="dict-hint" style={{ padding: '14px 6px' }}>
          🌱 Bài chưa có từ — bấm <b>Học bài này →</b> để tự thêm 20 từ.
        </p>
      ) : null}
    </>
  );
}

/** Khung trái: tìm kiếm + lọc trạng thái + danh sách */
function LeftPane() {
  const store = useCourseStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'new' | 'learning' | 'mastered'>('all');

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return store.entries
      .filter((e) => (status === 'all' ? true : e.learningStatus === status))
      .filter((e) =>
        query
          ? e.word.toLowerCase().includes(query) ||
            (e.senses || []).some((s) => s.meaning?.vi?.toLowerCase().includes(query))
          : true,
      )
      .sort((a, b) => a.word.localeCompare(b.word));
  }, [store.entries, q, status]);

  const course = store.course;
  if (!course) return null;

  const statuses: { id: 'all' | 'new' | 'learning' | 'mastered'; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'new', label: '🟡 Mới' },
    { id: 'learning', label: '🟢 Đang học' },
    { id: 'mastered', label: '🔵 Đã thuộc' },
  ];

  return (
    <div className="dict-list">
      <div className="search-block">
        <div className="search-box">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            placeholder={`Tìm từ ${course.wordFieldPh} hoặc nghĩa…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm từ"
          />
          {q ? (
            <button className="search-clear" onClick={() => setQ('')} aria-label="Xóa tìm kiếm">
              ✕
            </button>
          ) : null}
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {statuses.map((s) => (
            <Chip key={s.id} active={status === s.id} onClick={() => setStatus(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {store.vocabLessonId ? (
        <LessonWords lessonId={store.vocabLessonId} />
      ) : (
        <>
          <ul className="word-list">
            {list.map((e) => (
              <WordRow key={e.id} id={e.id} />
            ))}
          </ul>
          {!list.length ? <EmptyState big="🔍">Không tìm thấy từ phù hợp</EmptyState> : null}
        </>
      )}
    </div>
  );
}

function WordRow({ id }: { id: string }) {
  const entry = useCourseStore((s) => s.entries.find((e) => e.id === id));
  const openDetail = useCourseStore((s) => s.openDetail);
  const detailId = useCourseStore((s) => s.detailId);
  const course = useCourseStore((s) => s.course);
  if (!entry || !course) return null;
  const m = entry.senses?.[0]?.meaning;
  return (
    <li className={`word-item ${detailId === id ? 'active' : ''}`} onClick={() => openDetail(id)}>
      <span className={`status-dot ${entry.learningStatus}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="w">{entry.word}</div>
        <div className="meta">
          {entry.senses?.[0]?.partOfSpeech ? <span>{entry.senses[0].partOfSpeech} · </span> : null}
          {m?.[course.target.code] ? m[course.target.code] : ''}
        </div>
      </div>
      <span className="chev">›</span>
    </li>
  );
}

/** Chi tiết từ — bên phải (hoặc toàn khung trên mobile) */
export function WordDetail({ id }: { id: string }) {
  const store = useCourseStore();
  const entry = store.entries.find((e) => e.id === id);
  const course = store.course;
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!entry || !course)
    return (
      <div className="dict-detail-inner">
        <p className="dict-hint">🤔 Không tìm thấy từ</p>
      </div>
    );

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const meta = entry.lessonId ? lessonById(entry.lessonId) : undefined;

  return (
    <div className="dict-detail-inner">
      <div className="hero-row">
        <div className="hero-left">
          <div>
            <div className="hero-py-row">
              <span className="detail-word">{entry.word}</span>
              <Speak text={entry.word} lang={course.source.code} />
            </div>
            {entry.senses?.[0]?.pronunciation ? (
              <div className="hero-meaning en" style={{ color: 'var(--ink-3)', fontSize: 15 }}>
                /{entry.senses[0].pronunciation}/
              </div>
            ) : null}
            <div className="hero-meaning" style={{ marginTop: 6 }}>
              <span className="vi">{entry.senses?.[0]?.meaning?.[course.target.code] || ''}</span>
            </div>
          </div>
        </div>
        <span className={`status-dot ${entry.learningStatus}`} title={entry.learningStatus} />
      </div>

      {(entry.senses || []).map((s, i) => {
        const m = s.meaning || {};
        return (
          <div key={i} className="sense-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {s.partOfSpeech ? <span className="pos-chip">{s.partOfSpeech}</span> : null}
              {s.pronunciation ? (
                <span className="ipa" style={{ color: 'var(--ink-3)', fontSize: 13 }}>
                  {s.pronunciation}
                </span>
              ) : null}
              {m[course.source.code] &&
              m[course.target.code] &&
              m[course.source.code] !== m[course.target.code] ? (
                <Speak
                  text={m[course.target.code] || ''}
                  lang={course.target.code}
                  title="Nghe nghĩa"
                />
              ) : null}
            </div>
            <div style={{ fontWeight: 700 }}>{m[course.target.code] || ''}</div>
            {m[course.source.code] ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{m[course.source.code]}</div>
            ) : null}
            {s.examples?.[0] ? (
              <div
                style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 13, marginTop: 6 }}
              >
                ❝ {s.examples[0]}
              </div>
            ) : null}
          </div>
        );
      })}

      <div
        className="sense-card"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
      >
        {entry.synonyms?.length ? (
          <Button variant="ghost" size="sm" onClick={() => toggle('syn')}>
            🔁 Đồng nghĩa ({entry.synonyms.length})
          </Button>
        ) : null}
        {entry.antonyms?.length ? (
          <Button variant="ghost" size="sm" onClick={() => toggle('ant')}>
            ↔️ Trái nghĩa ({entry.antonyms.length})
          </Button>
        ) : null}
        {entry.tags?.length ? (
          <Button variant="ghost" size="sm" onClick={() => toggle('tag')}>
            🏷️ Chủ đề ({entry.tags.length})
          </Button>
        ) : null}
        {entry.wordRoot ? (
          <Button variant="ghost" size="sm" onClick={() => toggle('root')}>
            🌿 Gốc từ
          </Button>
        ) : null}
        {meta ? (
          <Button variant="ghost" size="sm" onClick={() => toggle('lesson')}>
            📘 Bài học
          </Button>
        ) : null}
      </div>
      {open.syn ? <ChipList items={entry.synonyms || []} /> : null}
      {open.ant ? <ChipList items={entry.antonyms || []} /> : null}
      {open.tag ? <ChipList items={entry.tags || []} /> : null}
      {open.root && entry.wordRoot ? (
        <div style={{ marginTop: 10, color: 'var(--ink-2)', fontSize: 14 }}>
          🌿 {String(entry.wordRoot)}
        </div>
      ) : null}
      {open.lesson && meta ? (
        <div style={{ marginTop: 10, fontSize: 13.5, color: 'var(--ink-2)' }}>
          📘 <b>{meta.title}</b> — chủ đề <b>{meta.tag}</b> ({meta.count} từ/bài)
        </div>
      ) : null}
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((s) => (
        <span key={s} className="chip" style={{ cursor: 'default' }}>
          {s}
        </span>
      ))}
    </div>
  );
}
