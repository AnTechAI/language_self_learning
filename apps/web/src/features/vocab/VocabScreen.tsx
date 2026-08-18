/**
 * VocabScreen — tab "Từ vựng" (Design en theo lexicon-ui.jsx).
 * Thanh tìm kiếm + lọc bài học + BẢNG từ kẻ sọc (Từ/IPA · Loại từ · Nghĩa ·
 * Bài). Bấm hàng → MODAL chi tiết từ (Anh-Anh/Anh-Việt/Ví dụ/Đồng & trái nghĩa).
 */
import { useMemo, useState } from 'react';
import type { WordEntry } from '@english/shared';
import { Speak } from '../../components/ui';
import { lessonById, type LessonMeta } from '../../data/lessons';
import { useCourseStore } from '../../store/useCourseStore';
import { useLessons } from '../home/useLessons';

export function VocabScreen() {
  const store = useCourseStore();
  const course = store.course;
  const lessons = useLessons();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return store.entries
      .filter((e) => (filter === 'all' ? true : e.lessonId === filter))
      .filter((e) =>
        query
          ? e.word.toLowerCase().includes(query) ||
            (e.senses || []).some(
              (s) =>
                s.meaning?.vi?.toLowerCase().includes(query) ||
                s.meaning?.en?.toLowerCase().includes(query),
            )
          : true,
      )
      .sort((a, b) => a.word.localeCompare(b.word));
  }, [store.entries, q, filter]);

  if (!course) return null;

  const openWord = (id: string) => setOpenId(id);

  return (
    <div className="lex-page">
      <div className="lex-page-head">
        <h2 className="lex-title">Từ vựng</h2>
        <span className="lex-today">🗂️ {store.entries.length} từ trong kho</span>
      </div>

      <div className="lex-toolbar">
        <div className="lex-search">
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
            placeholder="Tìm từ hoặc nghĩa..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm từ"
          />
        </div>
        <select className="lex-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tất cả từ</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              Bài {lessonNum(l.id)}: {l.title}
            </option>
          ))}
        </select>
      </div>

      <div className="lex-table">
        <div className="lt-head">
          <span>Từ</span>
          <span>Loại từ</span>
          <span>Nghĩa</span>
          <span>Bài</span>
        </div>
        {list.map((e) => (
          <div key={e.id} className="lt-row" onClick={() => openWord(e.id)}>
            <div>
              <div className="lt-word">{e.word}</div>
              <div className="lt-ipa">{e.senses?.[0]?.pronunciation || ''}</div>
            </div>
            <span>
              {e.senses?.[0]?.partOfSpeech ? <Tag>{e.senses[0].partOfSpeech}</Tag> : null}
            </span>
            <span className="lt-mean">
              {e.senses?.[0]?.meaning?.[course.target.code] || e.senses?.[0]?.meaning?.vi || ''}
            </span>
            <span className="lt-lesson">{e.lessonId ? `#${lessonNum(e.lessonId)}` : ''}</span>
          </div>
        ))}
        {list.length === 0 ? <p className="lex-empty">Không tìm thấy từ phù hợp.</p> : null}
      </div>

      {openId ? (
        <div className="lex-overlay" onClick={() => setOpenId(null)}>
          <WordDetail id={openId} onClose={() => setOpenId(null)} />
        </div>
      ) : null}
    </div>
  );
}

function lessonNum(id: string): number {
  const m = String(id || '').match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

export function Tag({
  children,
  tone = 'teal',
}: {
  children: React.ReactNode;
  tone?: 'teal' | 'amber' | 'line';
}) {
  const cls = `lex-tag ${tone}`;
  return <span className={cls}>{children}</span>;
}

/** Highlight từ khóa (bỏ qua hoa/thường) trong câu ví dụ */
function HighlightEn({ text, word }: { text: string; word: string }) {
  const lower = text.toLowerCase();
  const idx = word ? lower.indexOf(word.toLowerCase()) : -1;
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + word.length)}</mark>
      {text.slice(idx + word.length)}
    </>
  );
}

/** Chi tiết từ — modal gọn 1 trang (không cuộn) + highlight theo lexicon */
export function WordDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const store = useCourseStore();
  const entry: WordEntry | undefined = store.entries.find((e) => e.id === id);
  const course = store.course;
  if (!entry || !course) return null;

  const s0 = entry.senses?.[0];
  const m = s0?.meaning || {};
  const meta = entry.lessonId ? lessonById(entry.lessonId) : undefined;
  const syn = entry.synonyms || [];
  const ant = entry.antonyms || [];
  const senses = entry.senses || [];

  return (
    <div className="lex-modal lm-compact" onClick={(e) => e.stopPropagation()}>
      <div className="lm-head">
        <span className="lm-word">{entry.word}</span>
        <Speak text={entry.word} lang={course.source.code} />
        <div className="lm-flex" />
        {meta ? <Tag tone="line">Bài {lessonNum(meta.id)}</Tag> : null}
      </div>

      <div className="lm-meta">
        {s0?.pronunciation ? <span className="lm-ipa">{s0.pronunciation}</span> : null}
        <PosChip pos={s0?.partOfSpeech || ''} />
        {entry.tags?.[0] ? <Tag tone="line">{entry.tags[0]}</Tag> : null}
      </div>

      <div className="lm-grid">
        <Field label="Anh - Anh" accent="teal">
          {m.en || '—'}
        </Field>
        <Field label="Anh - Việt" accent="amber">
          {m.vi || '—'}
        </Field>
      </div>

      {s0?.examples?.[0] ? (
        <Field label="Ví dụ" accent="rose">
          <em>
            "<HighlightEn text={s0.examples[0]} word={entry.word} />"
          </em>
        </Field>
      ) : null}

      {senses.length > 1 ? (
        <div className="lm-senses">
          <div className="lex-field-label">Nghĩa khác · {senses.length - 1}</div>
          {senses.slice(1).map((s, i) => (
            <div className="lm-sense" key={i}>
              <PosChip pos={s.partOfSpeech} />
              <div className="lm-sense-txt">
                <span className="lm-sense-en">{s.meaning?.en || ''}</span>
                <span className="lm-sense-vi">{s.meaning?.vi || ''}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="lm-syn-row">
        <div>
          <div className="lex-field-label">Đồng nghĩa</div>
          <div className="lex-tag-row">
            {syn.length ? (
              syn.map((s) => <Tag key={s}>{s}</Tag>)
            ) : (
              <span className="lex-hint">—</span>
            )}
          </div>
        </div>
        <div>
          <div className="lex-field-label">Trái nghĩa</div>
          <div className="lex-tag-row">
            {ant.length ? (
              ant.map((s) => (
                <Tag key={s} tone="amber">
                  {s}
                </Tag>
              ))
            ) : (
              <span className="lex-hint">—</span>
            )}
          </div>
        </div>
      </div>

      <button className="lm-close" onClick={() => onClose?.()}>
        Đóng
      </button>
    </div>
  );
}

/** Chip từ loại tô màu theo loại (giống hệ màu zh) */
function PosChip({ pos }: { pos: string }) {
  return (
    <span className="lex-pos-chip" data-pos={String(pos || '').toLowerCase()}>
      {pos || '?'}
    </span>
  );
}

function Field({
  label,
  accent = 'teal',
  children,
}: {
  label: string;
  accent?: 'teal' | 'amber' | 'rose';
  children: React.ReactNode;
}) {
  return (
    <div className={`lex-field lf-${accent}`}>
      <div className="lex-field-label">{label}</div>
      <div className="lex-field-body">{children}</div>
    </div>
  );
}

export type { LessonMeta };
