/**
 * VocabScreen — "Từ vựng": chip bài học, tìm kiếm, lọc trạng thái, danh sách từ,
 * và màn chi tiết từ (WordDetail).
 */
import { useMemo, useState } from 'react';
import { Button, Card, Chip, EmptyState, PosChips, Speak } from '../../components/ui';
import { lessonById, lessonLearnedCount, type LessonMeta } from '../../data/lessons';
import { pickSense, rootText } from '../../lib/format';
import { useCourseStore } from '../../store/useCourseStore';
import { useLessons } from '../home/useLessons';

export function VocabScreen() {
  const store = useCourseStore();
  const course = store.course;
  const lessons = useLessons();

  if (!course) return null;

  return (
    <>
      <ChipsRow lessons={lessons} />
      {store.vocabLessonId ? (
        <LessonWords lessonId={store.vocabLessonId} />
      ) : (
        <AllWords lessons={lessons} />
      )}
    </>
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
  return <div className="chip-row">{items}</div>;
}

/** Danh sách từ của 1 bài học (chỉ en) */
function LessonWords({ lessonId }: { lessonId: string }) {
  const store = useCourseStore();
  const meta = lessonById(lessonId);
  const lessonEntries = store.entries.filter((e) => e.lessonId === lessonId);
  const learned = lessonLearnedCount(lessonId, store.entries);
  if (!meta)
    return (
      <Card>
        <EmptyState big="📘">Đang tải bài học…</EmptyState>
      </Card>
    );

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>{meta.title}</h2>
          <small className="help">
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
        <EmptyState big="🌱">
          <p>Bài chưa có trong kho — bấm "Học bài này" để tự thêm 20 từ.</p>
          <Button
            onClick={async () => {
              await store.pickLesson(lessonId);
            }}
          >
            Học bài này →
          </Button>
        </EmptyState>
      ) : null}
    </Card>
  );
}

/** Toàn bộ từ + tìm kiếm + lọc trạng thái */
function AllWords({ lessons }: { lessons: LessonMeta[] }) {
  const store = useCourseStore();
  const course = store.course;
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

  const statuses: { id: 'all' | 'new' | 'learning' | 'mastered'; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'new', label: '🟡 Mới' },
    { id: 'learning', label: '🟢 Đang học' },
    { id: 'mastered', label: '🔵 Đã thuộc' },
  ];

  if (!course) return null;
  void lessons;

  return (
    <Card>
      <div className="search-bar">
        <span style={{ opacity: 0.5 }}>🔍</span>
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
      <div className="chip-row" style={{ marginTop: 10 }}>
        {statuses.map((s) => (
          <Chip key={s.id} active={status === s.id} onClick={() => setStatus(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>
      <ul className="word-list">
        {list.map((e) => (
          <WordRow key={e.id} id={e.id} />
        ))}
      </ul>
      {!list.length ? <EmptyState big="🔍">Không tìm thấy từ phù hợp</EmptyState> : null}
    </Card>
  );
}

function WordRow({ id }: { id: string }) {
  const entry = useCourseStore((s) => s.entries.find((e) => e.id === id));
  const openDetail = useCourseStore((s) => s.openDetail);
  const course = useCourseStore((s) => s.course);
  if (!entry || !course) return null;
  const m = entry.senses?.[0]?.meaning;
  return (
    <li className="word-item" onClick={() => openDetail(id)}>
      <span className={`status-dot ${entry.learningStatus}`} />
      <div style={{ flex: 1 }}>
        <div className="w">{entry.word}</div>
        <div className="meta">
          <PosChips entry={entry} />
          {m?.[course.target.code] ? ` · ${m[course.target.code]}` : ''}
        </div>
      </div>
      <span className="chev">›</span>
    </li>
  );
}

/** Chi tiết từ — core info luôn hiện, thông tin phụ qua nút mở rộng */
export function WordDetail({ id }: { id: string }) {
  const store = useCourseStore();
  const entry = store.entries.find((e) => e.id === id);
  const course = store.course;
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!entry || !course)
    return (
      <Card>
        <EmptyState big="🤔">Không tìm thấy từ</EmptyState>
      </Card>
    );

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const s0 = pickSense(entry);
  const meta = entry.lessonId ? lessonById(entry.lessonId) : undefined;

  return (
    <>
      <Card className="detail-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button variant="ghost" size="sm" onClick={() => store.closeDetail()}>
            ← Quay lại
          </Button>
          <div className="spacer" style={{ flex: 1 }} />
          <span className={`status-dot ${entry.learningStatus}`} />
        </div>
        <div style={{ textAlign: 'center', margin: '12px 0 4px' }}>
          <div
            className="detail-word"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
          >
            {entry.word}
            <Speak text={entry.word} lang={course.source.code} />
          </div>
          {s0?.pronunciation ? (
            <div className="ipa" style={{ color: 'var(--ink-3)' }}>
              {s0.pronunciation}
            </div>
          ) : null}
          <div style={{ marginTop: 6 }}>
            <PosChips entry={entry} />
          </div>
        </div>
      </Card>

      {/* Các nghĩa (luôn hiện) */}
      {(entry.senses || []).map((s, i) => {
        const m = s.meaning || {};
        return (
          <Card key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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
          </Card>
        );
      })}

      {/* Thông tin phụ qua nút mở rộng */}
      <Card>
        <div className="row">
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
            🌿 {rootText(entry.wordRoot)}
          </div>
        ) : null}
        {open.lesson && meta ? (
          <div style={{ marginTop: 10, fontSize: 13.5, color: 'var(--ink-2)' }}>
            📘 <b>{meta.title}</b> — chủ đề <b>{meta.tag}</b> ({meta.count} từ/bài)
          </div>
        ) : null}
      </Card>
    </>
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
