/**
 * ZhRoot — GIAO DIỆN RIÊNG CHO KHÓA TIẾNG TRUNG (Design v4).
 * Thiết kế y theo chinese-app-ui.jsx: rail trái 5 tab (Từ điển · Flashcard ·
 * Luyện viết · Ôn tập · Tiến độ) + topbar + khung 2-pane. Không dùng shell
 * tiếng Anh — tách hoàn toàn để mỗi khóa có giao diện riêng.
 *
 * TỪ VỰNG THEO HSK: mỗi cấp HSK chia 2 phần — 单字 (từ đơn) và 词语 (từ ghép);
 * mỗi phần chia thành BÀI HỌC 20 mục. Dữ liệu đọc trực tiếp từ hsk.json
 * (5.363 từ HSK 3.0 — tải nhu cầu khi mở khóa Trung).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import type { WordEntry } from '@english/shared';
import { loadZhDict, loadZhStrokes, type ZhStrokesData, type ZhWord } from '../../data/zhDict';
import { charTones, numericFromMarked } from '../../lib/zh';
import { todayStr } from '../../lib/format';
import { useCourseStore } from '../../store/useCourseStore';

/* ---------------------------------------------------------------- NAV --- */

type NavKey = 'dict' | 'flash' | 'write' | 'review' | 'progress';
const NAV: { key: NavKey; label: string; ico: string }[] = [
  { key: 'dict', label: 'Từ điển', ico: '📖' },
  { key: 'flash', label: 'Flashcard', ico: '🂠' },
  { key: 'write', label: 'Luyện viết', ico: '✍️' },
  { key: 'review', label: 'Ôn tập', ico: '🔄' },
  { key: 'progress', label: 'Tiến độ', ico: '📊' },
];
const TITLES: Record<NavKey, { zh: string; vi: string }> = {
  dict: { zh: '从零开始', vi: 'Học tiếng Trung từ Zero — từ vựng theo HSK' },
  flash: { zh: '记忆卡', vi: 'Ôn từ vựng bằng Flashcard' },
  write: { zh: '写字', vi: 'Luyện viết chữ Hán' },
  review: { zh: '复习', vi: 'Ôn tập theo lịch SRS' },
  progress: { zh: '进度', vi: 'Tiến độ học tập' },
};

/* ------------------------------------------------------ TIỆN ÍCH NHỎ --- */

const LEVELS = [1, 2, 3, 4, 5, 6];
const PAGE = 20; // mỗi bài học = 20 mục

const TONE_PATHS: Record<string, string> = {
  '1': 'M4 8 L28 8',
  '2': 'M4 13 C 12 13, 18 3, 28 3',
  '3': 'M4 6 C 10 14, 14 14, 16 9 C 18 4, 24 4, 28 8',
  '4': 'M4 3 C 14 3, 20 15, 28 15',
  '5': 'M4 10 L14 10 L16 8 L28 8',
  '0': 'M4 10 L28 10',
};

function ToneCurve({ tone, active }: { tone: number; active?: boolean }) {
  const d = TONE_PATHS[String(tone)] || TONE_PATHS['0'];
  return (
    <svg width="32" height="18" viewBox="0 0 32 18" fill="none" aria-hidden="true">
      <path d={d} stroke={active ? '#B8332B' : '#B7B0A6'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Con dấu HSK (viền đỏ) — theo file mẫu */
function SealBadge({ level }: { level: number }) {
  return (
    <div className="zh-seal" aria-label={`HSK ${level}`}>
      <span>HSK</span>
      <strong>{level}</strong>
    </div>
  );
}

/** Các ô nét — theo file mẫu (độ mờ tăng dần) */
function StrokeStages({ hanzi, strokes }: { hanzi: string; strokes: number }) {
  const n = Math.max(1, strokes || 1);
  const stages = Math.min(n, 6);
  return (
    <div className="zh-stroke-row">
      {Array.from({ length: stages }).map((_, i) => (
        <div key={i} className="zh-stroke-box">
          <span style={{ opacity: (i + 1) / stages }}>{hanzi}</span>
        </div>
      ))}
      {n > 6 && <span className="zh-stroke-more">+{n - 6} nét</span>}
    </div>
  );
}

/** Chuẩn hóa mục (từ đơn/ghép trong hsk.json hoặc thẻ nhớ SRS trong kho) */
type Card = {
  hanzi: string;
  pinyin: string;
  tone: number;
  hsk: number;
  meaningVi: string;
  meaningEn: string;
  word?: ZhWord;
  entry?: WordEntry;
};
function toCard(item: ZhWord | WordEntry): Card {
  if ((item as ZhWord).simplified) {
    const w = item as ZhWord;
    const t = charTones(w.simplified, w.pinyin_numeric);
    return {
      hanzi: w.simplified,
      pinyin: w.pinyin,
      tone: t[0]?.tone ?? 0,
      hsk: w.hsk_level,
      meaningVi: w.meaning_vi || '',
      meaningEn: w.meaning_en || '',
      word: w,
    };
  }
  const e = item as WordEntry;
  const py = e.senses?.[0]?.pronunciation || '';
  const t = charTones(e.word, numericFromMarked(py));
  return {
    hanzi: e.word,
    pinyin: py,
    tone: t[0]?.tone ?? 0,
    hsk: e.level ?? 0,
    meaningVi: e.senses?.[0]?.meaning?.vi || '',
    meaningEn: '',
    entry: e,
  };
}

/** Đánh giá thẻ theo SM-2 (gọi qua store — bookmark trước nếu chưa có) */
function rateItem(item: Card, grade: 0 | 1 | 2 | 3) {
  const st = useCourseStore.getState();
  const apply = (id?: string) => id && st.applySrs(id, grade);
  if (item.word) {
    void st.bookmarkZhWord(item.word).then(() => {
      const id = useCourseStore.getState().entries.find((e) => e.word === item.hanzi)?.id;
      apply(id);
    });
  } else if (item.hanzi) {
    const id = st.entries.find((e) => e.word === item.hanzi)?.id;
    apply(id);
  }
}

/* -------------------------------------------------------- GIỮA FILE --- */

export function ZhRoot() {
  const store = useCourseStore();
  const [words, setWords] = useState<ZhWord[] | null>(null);
  const [strokes, setStrokes] = useState<ZhStrokesData | null>(null);
  const [err, setErr] = useState('');

  // Điều hướng + trạng thái từ điển (bài học theo HSK)
  const [nav, setNav] = useState<NavKey>('dict');
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<number | null>(1);
  const [sec, setSec] = useState<'zi' | 'ci'>('zi'); // 单字 từ đơn · 词语 từ ghép
  const [lessonIdx, setLessonIdx] = useState(0);
  const [item, setItem] = useState<ZhWord | null>(null);

  // Bộ bài flashcard (chụp ngay khi bấm "Học bài này")
  const [deck, setDeck] = useState<Card[] | null>(null);

  useEffect(() => {
    let live = true;
    loadZhDict()
      .then((w) => live && setWords(w))
      .catch(() => live && setErr('Không tải được từ điển (hsk.json)'));
    loadZhStrokes()
      .then((d) => live && setStrokes(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const inKho = useMemo(() => new Set(store.entries.map((e) => e.word)), [store.entries]);

  // Mục theo cấp + phần (từ đơn / từ ghép)
  const base = useMemo(() => {
    if (!words) return [];
    return words.filter(
      (w) =>
        (!level || w.hsk_level === level) &&
        (sec === 'zi' ? w.simplified.length === 1 : w.simplified.length >= 2),
    );
  }, [words, level, sec]);

  // Tìm kiếm (Hán tự / pinyin / nghĩa)
  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!nq) return base;
    return base.filter(
      (w) =>
        w.simplified.includes(q.trim()) ||
        w.pinyin.toLowerCase().includes(nq) ||
        w.pinyin_numeric.includes(nq) ||
        w.meaning_vi.toLowerCase().includes(nq) ||
        w.meaning_en.toLowerCase().includes(nq) ||
        w.radical === q.trim(),
    );
  }, [base, q]);

  const levels = useMemo(() => {
    if (!words) return [];
    return LEVELS.map((lv) => ({
      lv,
      zi: words.filter((w) => w.hsk_level === lv && w.simplified.length === 1).length,
      ci: words.filter((w) => w.hsk_level === lv && w.simplified.length >= 2).length,
    }));
  }, [words]);

  // Bài học = nhóm 20 mục
  const lessons = useMemo(() => {
    const arr: { n: number; hsk: number; items: ZhWord[] }[] = [];
    for (let i = 0; i < filtered.length; i += PAGE) {
      arr.push({ n: i / PAGE + 1, hsk: filtered[i].hsk_level, items: filtered.slice(i, i + PAGE) });
    }
    return arr;
  }, [filtered]);

  const selLesson = lessons[Math.min(lessonIdx, Math.max(0, lessons.length - 1))];

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    words?.forEach((w) => {
      m[w.hsk_level] = (m[w.hsk_level] || 0) + 1;
    });
    return m;
  }, [words]);

  const openFlash = (items: Card[]) => {
    setDeck(items);
    setNav('flash');
  };

  if (err)
    return (
      <div className="zh-app" style={{ padding: 60, fontFamily: 'var(--font)' }}>
        ⚠️ {err}
      </div>
    );

  return (
    <div className="zh-app">
      {/* ---------- Rail trái ---------- */}
      <nav className="zh-rail">
        <div className="zh-rail-mark">汉</div>
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`zh-rail-btn ${nav === n.key ? 'on' : ''}`}
            onClick={() => setNav(n.key)}
          >
            <span className="ico">{n.ico}</span>
            {n.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className="zh-rail-btn"
          title="Đổi khóa học"
          onClick={() => void useCourseStore.getState().exitCourse()}
        >
          <span className="ico">⇄</span>
          Đổi khóa
        </button>
      </nav>

      {/* ---------- Main ---------- */}
      <div className="zh-main">
        <div className="zh-topbar">
          <p className="zh-eyebrow">Zero → HSK 6</p>
          <div className="zh-title-row">
            <h1>{TITLES[nav].zh}</h1>
            <span>{TITLES[nav].vi}</span>
          </div>

          {nav === 'dict' && (
            <>
              <div className="zh-search-row">
                <div className="zh-search">
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
                    placeholder="Tra Hán tự, pinyin hoặc nghĩa..."
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setLessonIdx(0);
                      setItem(null);
                    }}
                  />
                </div>
                <div className="zh-chips">
                  <button
                    className={`zh-chip ${level === null ? 'on' : ''}`}
                    onClick={() => {
                      setLevel(null);
                      setLessonIdx(0);
                      setItem(null);
                    }}
                  >
                    Tất cả {words ? words.length : ''}
                  </button>
                  {levels.map((x) => (
                    <button
                      key={x.lv}
                      className={`zh-chip ${level === x.lv ? 'on' : ''}`}
                      onClick={() => {
                        setLevel(x.lv);
                        setLessonIdx(0);
                        setItem(null);
                      }}
                    >
                      HSK {x.lv} <small>{counts[x.lv]}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="zh-sectabs">
                <button
                  className={`zh-sec ${sec === 'zi' ? 'on' : ''}`}
                  onClick={() => {
                    setSec('zi');
                    setLessonIdx(0);
                    setItem(null);
                  }}
                >
                  字 · Từ đơn
                  <small>{level ? (levels.find((x) => x.lv === level)?.zi ?? 0) : '…'}</small>
                </button>
                <button
                  className={`zh-sec ${sec === 'ci' ? 'on' : ''}`}
                  onClick={() => {
                    setSec('ci');
                    setLessonIdx(0);
                    setItem(null);
                  }}
                >
                  词 · Từ ghép
                  <small>{level ? (levels.find((x) => x.lv === level)?.ci ?? 0) : '…'}</small>
                </button>
              </div>
            </>
          )}
        </div>

        {/* ---------- Body theo tab ---------- */}
        {nav === 'dict' && (
          <DictView
            words={words}
            lessons={lessons}
            selLesson={selLesson}
            lessonIdx={lessonIdx}
            setLessonIdx={setLessonIdx}
            item={item}
            setItem={setItem}
            inKho={inKho}
            strokes={strokes}
            onLearn={(items) => openFlash(items.map(toCard))}
            onWrite={(items) => {
              setDeck(items.map(toCard));
              setNav('write');
            }}
          />
        )}
        {nav === 'flash' && (
          <FlashView
            deck={deck}
            fallback={selLesson?.items ?? []}
            onDone={() => setNav('review')}
            onReset={(cards) => {
              setDeck(cards);
              setNav('flash');
            }}
          />
        )}
        {nav === 'write' && (
          <WriteView cards={deck ?? (selLesson?.items ?? []).map(toCard)} strokes={strokes} />
        )}
        {nav === 'review' && <ReviewView onStart={(cards) => openFlash(cards)} />}
        {nav === 'progress' && <ProgressView words={words} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------- TAB: TỪ ĐIỂN --- */

function DictView({
  words,
  lessons,
  selLesson,
  lessonIdx,
  setLessonIdx,
  item,
  setItem,
  inKho,
  strokes,
  onLearn,
  onWrite,
}: {
  words: ZhWord[] | null;
  lessons: { n: number; hsk: number; items: ZhWord[] }[];
  selLesson?: { n: number; hsk: number; items: ZhWord[] };
  lessonIdx: number;
  setLessonIdx: (n: number) => void;
  item: ZhWord | null;
  setItem: (w: ZhWord | null) => void;
  inKho: Set<string>;
  strokes: ZhStrokesData | null;
  onLearn: (items: ZhWord[]) => void;
  onWrite: (items: ZhWord[]) => void;
}) {
  // Vị trí từ đang xem trong bài → nút "Từ tiếp theo / Từ trước"
  const idx = item && selLesson ? selLesson.items.findIndex((w) => w.id === item.id) : -1;
  const prev = item && selLesson && idx > 0 ? () => setItem(selLesson.items[idx - 1]) : null;
  const next =
    item && selLesson && idx >= 0 && idx < selLesson.items.length - 1
      ? () => setItem(selLesson.items[idx + 1])
      : null;

  return (
    <div className="zh-body">
      {/* Pane trái — danh sách BÀI HỌC */}
      <div className="zh-list">
        {!words ? (
          <p className="zh-hint">Đang tải từ điển…</p>
        ) : lessons.length === 0 ? (
          <p className="zh-hint">Không tìm thấy mục nào.</p>
        ) : (
          lessons.map((l, i) => {
            const learned = l.items.filter((it) => inKho.has(it.simplified)).length;
            return (
              <button
                key={i}
                className={`zh-lesson ${i === lessonIdx ? 'on' : ''}`}
                onClick={() => {
                  setLessonIdx(i);
                  setItem(null);
                }}
              >
                <span className="zl-tag">HSK {l.hsk}</span>
                <span className="zl-body">
                  <b>
                    Bài {l.n} · {l.items.length} từ
                  </b>
                  <span className="zl-words">
                    {l.items
                      .slice(0, 4)
                      .map((w) => w.simplified)
                      .join(' ')}{' '}
                    {l.items.length > 4 ? '…' : ''}
                  </span>
                  <span className="zl-prog">
                    {learned}/{l.items.length} đã học
                  </span>
                </span>
                <span className="chev">›</span>
              </button>
            );
          })
        )}
      </div>

      {/* Pane phải — bài học / chi tiết từ */}
      <div className="zh-detail">
        {item ? (
          <WordDetailPanel
            w={item}
            counter={selLesson && idx >= 0 ? `Từ ${idx + 1}/${selLesson.items.length}` : undefined}
            inKho={inKho.has(item.simplified)}
            strokes={strokes}
            onBookmark={() => void useCourseStore.getState().bookmarkZhWord(item)}
            onBack={() => setItem(null)}
            onPrev={prev}
            onNext={next}
            onWrite={() => onWrite([item])}
          />
        ) : selLesson && words ? (
          <LessonPanel
            lesson={selLesson}
            inKho={inKho}
            onPick={(w) => setItem(w)}
            onLearn={() => onLearn(selLesson.items)}
            onWrite={() => onWrite(selLesson.items)}
          />
        ) : (
          <p className="zh-hint" style={{ padding: 20 }}>
            Chọn một bài học bên trái.
          </p>
        )}
      </div>
    </div>
  );
}

/** Panel 1 bài học: 20 mục dạng lưới */
function LessonPanel({
  lesson,
  inKho,
  onPick,
  onLearn,
  onWrite,
}: {
  lesson: { n: number; hsk: number; items: ZhWord[] };
  inKho: Set<string>;
  onPick: (w: ZhWord) => void;
  onLearn: () => void;
  onWrite: () => void;
}) {
  const learned = lesson.items.filter((w) => inKho.has(w.simplified)).length;
  const pct = Math.round((learned / lesson.items.length) * 100);
  return (
    <div className="zh-lesson-panel">
      <div className="lp-head">
        <div>
          <div className="zh-sect">
            HSK {lesson.hsk} · Bài {lesson.n}
          </div>
          <h2 className="lp-title">Đang học từ vựng</h2>
          <p className="lp-sub">
            Đã học <b>{learned}</b>/{lesson.items.length} từ
          </p>
        </div>
        <div className="lp-actions">
          <button className="zh-btn-primary" onClick={onLearn}>
            <Plus /> Học bài này →
          </button>
          <button className="zh-btn-ghost" onClick={onWrite}>
            ✍️ Luyện viết
          </button>
        </div>
      </div>
      <div className="zh-prog">
        <div className="zh-prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="zh-grid">
        {lesson.items.map((w) => (
          <button key={w.id} className="zh-cell" onClick={() => onPick(w)}>
            <span className="zc-hanzi">{w.simplified}</span>
            <span className="zc-py">{w.pinyin}</span>
            <span className="zc-mean">{w.meaning_vi || '…'}</span>
            {inKho.has(w.simplified) && <span className="dot jade" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Highlight từ khóa (lần xuất hiện đầu tiên) trong câu ví dụ */
function HighlightWord({ text, word }: { text: string; word: string }) {
  const idx = word ? text.indexOf(word) : -1;
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{word}</mark>
      {text.slice(idx + word.length)}
    </>
  );
}

/** Chi tiết 1 từ/chữ — y theo mẫu */
function WordDetailPanel({
  w,
  counter,
  inKho,
  strokes,
  onBookmark,
  onBack,
  onPrev,
  onNext,
  onWrite,
}: {
  w: ZhWord;
  counter?: string;
  inKho: boolean;
  strokes: ZhStrokesData | null;
  onBookmark: () => void;
  onBack: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onWrite: () => void;
}) {
  const t = charTones(w.simplified, w.pinyin_numeric);
  const tone = t[0]?.tone ?? 0;
  const nStrokes = w.strokes?.[0]?.n ?? 0;
  const charData = strokes?.[w.simplified];
  const ref = useRef<HTMLDivElement>(null);

  // Từ loại: ưu tiên senses[], fallback field pos
  const senses =
    w.senses && w.senses.length
      ? w.senses
      : [{ pos: w.pos || '?', en: w.meaning_en, vi: w.meaning_vi }];

  // Pinyin tô màu theo thanh điệu (âm tiết → tông màu chuẩn)
  const pySyllables = useMemo(() => {
    const marked = w.pinyin.split(/\s+/).filter(Boolean);
    const nums = w.pinyin_numeric.split(/\s+/).filter(Boolean);
    return marked.map((syl, i) => ({
      syl,
      tone: Number((nums[i] || '').match(/\d$/)?.[0] || 0),
    }));
  }, [w.pinyin, w.pinyin_numeric]);

  // Đổi từ → cuộn pane chi tiết về đầu
  useEffect(() => {
    const el = ref.current?.closest('.zh-detail');
    if (el) el.scrollTop = 0;
  }, [w]);

  return (
    <div className="zh-word-detail" ref={ref}>
      <button className="zh-back" onClick={onBack}>
        ← Về bài học
      </button>

      <div className="zh-word-nav">
        <button className="zh-btn-ghost" onClick={() => onPrev?.()} disabled={!onPrev}>
          ← Từ trước
        </button>
        <span className="zh-word-counter">{counter}</span>
        <button className="zh-btn-primary" onClick={() => onNext?.()} disabled={!onNext}>
          Từ tiếp theo →
        </button>
      </div>

      <div className="zh-hero">
        <div className="zh-hero-left">
          <div className="zh-hero-hanzi">{w.simplified}</div>
          <div>
            <div className="zh-hero-py-row">
              <ToneCurve tone={tone} active />
              <span className="zh-hero-py">
                {pySyllables.map((s, i) => (
                  <span key={i} className="tl" data-tone={s.tone}>
                    {s.syl}
                    {i < pySyllables.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </span>
              <button
                className="zh-audio"
                title="Nghe phát âm (TTS)"
                onClick={() => {
                  try {
                    const u = new SpeechSynthesisUtterance(w.simplified);
                    u.lang = 'zh-CN';
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(u);
                  } catch {
                    /* bỏ qua */
                  }
                }}
              >
                🔈
              </button>
            </div>
            <div className="zh-hero-meaning">
              <span className="vi">{w.meaning_vi || '…'}</span>
              {w.meaning_en ? (
                <>
                  {'  ·  '}
                  <span className="en">{w.meaning_en}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <SealBadge level={w.hsk_level} />
      </div>

      <div className="zh-meta-row">
        <span className="zh-tag seal">HSK {w.hsk_level}</span>
        {w.traditional && w.traditional !== w.simplified ? (
          <span className="zh-tag">phồn thể {w.traditional}</span>
        ) : null}
        {w.classifier ? <span className="zh-tag">lượng từ {w.classifier}</span> : null}
        {w.frequency_rank ? <span className="zh-tag">tần suất #{w.frequency_rank}</span> : null}
      </div>

      <div className="zh-sect-label">Từ loại</div>
      <div className="zh-senses">
        {senses.map((s, i) => (
          <div className="zh-sense-row" key={i}>
            <span className="zh-pos-chip" data-pos={String(s.pos || '').toLowerCase()}>
              {s.pos || '?'}
            </span>
            <div className="zh-sense-body">
              <div className="zh-sense-en">{s.en || '—'}</div>
              <div className="zh-sense-vi">{s.vi || '—'}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="zh-sect-label">Bộ thủ</div>
      <div className="zh-radical-row">
        {w.radical ? <div className="zh-radical-chip">{w.radical}</div> : null}
        <span className="zh-tag">{nStrokes || '?'} nét</span>
        <span className="zh-tag">{w.simplified.length} chữ</span>
      </div>

      <div className="zh-sect-label">Thứ tự nét · {nStrokes || '?'} nét</div>
      <StrokeStages hanzi={w.simplified} strokes={nStrokes} />
      {charData ? (
        <p className="zh-hint" style={{ fontSize: 11.5, marginTop: 6 }}>
          ✓ Dữ liệu nét có sẵn — mở tab Luyện viết để tập vẽ.
        </p>
      ) : null}

      <div className="zh-sect-label">Ví dụ · {w.example_sentences?.length || 0} câu</div>
      <div className="zh-examples">
        {(w.example_sentences || []).slice(0, 3).map((ex, i) => (
          <div className="zh-ex-card" key={i}>
            <div className="zh-ex-zh">
              <HighlightWord text={ex.zh} word={w.simplified} />
            </div>
            <div className="zh-ex-py">{ex.pinyin}</div>
            <div className="zh-ex-vi">{ex.vi || ex.en}</div>
            {ex.vi && ex.en ? <div className="zh-ex-en">{ex.en}</div> : null}
          </div>
        ))}
        {(w.example_sentences || []).length === 0 ? (
          <p className="zh-hint" style={{ fontSize: 13 }}>
            Chưa có ví dụ cho từ này.
          </p>
        ) : null}
      </div>

      <div className="zh-actions">
        <button className="zh-btn-primary" onClick={onBookmark} disabled={inKho}>
          {inKho ? '⭐ Đã có trong kho' : '+ Thêm vào ôn tập'}
        </button>
        <button className="zh-btn-ghost" onClick={onWrite}>
          ✍️ Luyện viết chữ này
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------- TAB: FLASHCARD --- */

function FlashView({
  deck,
  fallback,
  onDone,
  onReset,
}: {
  deck: Card[] | null;
  fallback: ZhWord[];
  onDone: () => void;
  onReset: (cards: Card[]) => void;
}) {
  const cards = deck ?? fallback.map(toCard);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [seen, setSeen] = useState<Card[]>([]);
  const card = cards[Math.min(idx, cards.length - 1)];

  const stateRef = useRef({ idx, cards });
  useEffect(() => {
    stateRef.current = { idx, cards };
  }, [idx, cards]);

  const next = () => {
    const s = stateRef.current;
    setFlipped(false);
    setDone((d) => d + 1);
    setIdx((i) => (i + 1) % Math.max(s.cards.length, 1));
    const c = s.cards[s.idx];
    if (c) setSeen((x) => (x.includes(c) ? x : [...x, c]));
  };

  const rate = (grade: 0 | 1 | 2 | 3) => {
    const c = stateRef.current.cards[stateRef.current.idx];
    if (c) rateItem(c, grade);
    next();
  };

  // Giữ tham chiếu mới nhất cho phím tắt (tránh stale closure)
  const nextRef = useRef(next);
  const rateRef = useRef(rate);
  useEffect(() => {
    nextRef.current = next;
    rateRef.current = rate;
  });

  // Phím: Space/Enter lật · 1-4 đánh giá · → từ kế
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (k === '1') rateRef.current(0);
      else if (k === '2') rateRef.current(1);
      else if (k === '3') rateRef.current(2);
      else if (k === '4') rateRef.current(3);
      else if (k === 'ArrowRight') nextRef.current();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!card)
    return (
      <div className="zh-flash">
        <p className="zh-hint">Bộ thẻ trống — chọn bài học ở Từ điển trước.</p>
      </div>
    );

  return (
    <div className="zh-flash">
      <div className="zh-fc-wrap">
        <div className="zh-fc-progress">
          <span>
            {done}/{cards.length} hôm nay
          </span>
          <div className="zh-fc-bar">
            <div className="zh-fc-fill" style={{ width: `${(done / cards.length) * 100}%` }} />
          </div>
          {seen.length ? (
            <button
              className="zh-fc-reset"
              onClick={() => {
                onReset(seen);
                setDone(0);
                setIdx(0);
                setFlipped(false);
                setSeen([]);
              }}
            >
              Rút gọn bộ thẻ
            </button>
          ) : null}
        </div>

        <div
          className={`zh-fc-card ${flipped ? 'is-flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
        >
          {!flipped ? (
            <div className="zh-fc-face">
              <SealBadge level={card.hsk} />
              <div className="zh-fc-hanzi">{card.hanzi}</div>
              <span className="zh-fc-hint">Khoảng trắng / Enter để lật thẻ</span>
            </div>
          ) : (
            <div className="zh-fc-face">
              <div className="zh-hero-py-row" style={{ justifyContent: 'center' }}>
                <ToneCurve tone={card.tone} active />
                <span className="zh-hero-py">{card.pinyin}</span>
              </div>
              <div className="zh-hero-meaning" style={{ textAlign: 'center', fontSize: 17 }}>
                <span className="vi">{card.meaningVi}</span>
                {card.meaningEn ? (
                  <>
                    {'  ·  '}
                    <span className="en">{card.meaningEn}</span>
                  </>
                ) : null}
              </div>
              <div className="zh-example" style={{ marginTop: 18, width: '100%' }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
                  Ví dụ câu đang bổ sung — nhấn 1–4 để chấm điểm nhớ.
                </p>
              </div>
            </div>
          )}
        </div>

        {flipped && (
          <div className="zh-fc-rate-row">
            <button className="zh-fc-rate again" onClick={() => rate(0)}>
              <XIcon /> Chưa nhớ
            </button>
            <button className="zh-fc-rate hard" onClick={() => rate(1)}>
              Khó
            </button>
            <button className="zh-fc-rate good" onClick={() => rate(2)}>
              Được
            </button>
            <button className="zh-fc-rate easy" onClick={() => rate(3)}>
              <CheckIcon /> Dễ
            </button>
          </div>
        )}

        <button className="zh-done-row" onClick={onDone}>
          ✅ Kết thúc phiên → Ôn tập hôm nay
        </button>
      </div>
    </div>
  );
}

function XIcon() {
  return <span style={{ fontWeight: 900 }}>✕</span>;
}
function CheckIcon() {
  return <span style={{ fontWeight: 900 }}>✓</span>;
}
function Plus() {
  return <span style={{ fontWeight: 900 }}>＋</span>;
}

/* --------------------------------------------------- TAB: LUYỆN VIẾT --- */

function WriteView({ cards, strokes }: { cards: Card[]; strokes: ZhStrokesData | null }) {
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<'watch' | 'practice'>('watch');
  const [quizDone, setQuizDone] = useState(0);
  const [practiced, setPracticed] = useState<Card[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const card = cards[Math.min(idx, Math.max(0, cards.length - 1))];
  const char = card?.hanzi?.[0] || '';
  const charData = char && strokes ? strokes[char] : null;

  useEffect(() => {
    if (!char || !charData || !boxRef.current) return;
    const el = boxRef.current;
    el.innerHTML = '';
    const writer = HanziWriter.create(boxRef.current, char, {
      charDataLoader: (_c, onLoad) => onLoad({ strokes: charData.s, medians: charData.m }),
      width: 240,
      height: 240,
      padding: 8,
      strokeColor: '#1C1B19',
      outlineColor: '#E9E4DC',
      highlightColor: '#B8332B',
      drawingColor: '#B8332B',
      strokeAnimationSpeed: 0.55,
      showOutline: true,
      showCharacter: mode === 'practice',
      showHintAfterMisses: 3,
    });
    if (mode === 'watch') void writer.animateCharacter();
    else void writer.quiz({ onComplete: () => setQuizDone((n) => n + 1) });
    return () => {
      (writer as unknown as { destroy?: () => void }).destroy?.();
    };
  }, [char, charData, mode]);

  const next = (dir: 1 | -1) => {
    setIdx((i) => (i + dir + cards.length) % Math.max(cards.length, 1));
    setQuizDone(0);
  };

  if (!card)
    return (
      <div className="zh-flash">
        <p className="zh-hint">Chọn bài học ở Từ điển để luyện viết.</p>
      </div>
    );

  const nStrokes = card.word?.strokes?.[0]?.n ?? 0;

  return (
    <div className="zh-write-wrap">
      <div className="zh-write-grid">
        <div>
          <div className="zh-mode-toggle">
            <button className={mode === 'watch' ? 'on' : ''} onClick={() => setMode('watch')}>
              ▶ Xem nét
            </button>
            <button
              className={mode === 'practice' ? 'on' : ''}
              onClick={() => {
                setQuizDone(0);
                setMode('practice');
              }}
            >
              ✍️ Luyện
            </button>
          </div>

          <div className="zh-write-canvas">
            <span className="zh-wg h" />
            <span className="zh-wg v" />
            <div ref={boxRef} className="zh-write-box" />
            {mode === 'practice' && <span className="zh-write-cursor" />}
          </div>

          <p className="zh-write-caption">
            {mode === 'watch'
              ? 'Xem hoạt hình thứ tự nét, sau đó chuyển sang chế độ Luyện để tự viết.'
              : 'Viết theo đúng thứ tự nét trong ô vuông trên.'}
            {quizDone > 0 && mode === 'practice' ? ' · Hoàn thành ✓' : ''}
          </p>
        </div>

        <div>
          <div className="zh-sect-label" style={{ marginTop: 0 }}>
            Đang luyện
          </div>
          <div className="zh-hero-py-row">
            <ToneCurve tone={card.tone} active />
            <span className="zh-hero-py">{card.pinyin}</span>
          </div>
          <div className="zh-hero-meaning" style={{ marginBottom: 20 }}>
            <span className="vi">{card.meaningVi}</span>
          </div>

          <div className="zh-sect-label">Bộ thủ</div>
          <div className="zh-radical-row">
            {card.word?.radical ? <div className="zh-radical-chip">{card.word.radical}</div> : null}
          </div>

          <div className="zh-sect-label">{card.word?.strokes?.[0]?.n ?? '?'} nét</div>
          <StrokeStages hanzi={char} strokes={nStrokes} />

          <div className="zh-actions">
            <button className="zh-btn-ghost" onClick={() => next(-1)}>
              Từ trước
            </button>
            <button className="zh-btn-primary" onClick={() => next(1)}>
              Từ tiếp theo
            </button>
          </div>
          <button
            className="zh-btn-ghost"
            style={{ marginTop: 10, width: '100%' }}
            onClick={() => setPracticed((s) => (s.includes(card) ? s : [...s, card]))}
          >
            ⏱ Ghi nhận đã luyện hôm nay
          </button>
        </div>
      </div>

      <div className="zh-sect-label">Đã luyện hôm nay</div>
      <div className="zh-practiced-row">
        {practiced.length === 0 ? (
          <span className="zh-hint">Chưa có — bấm "Ghi nhận đã luyện" khi hoàn thành một chữ.</span>
        ) : (
          practiced.map((c, i) => (
            <div className="zh-practiced-chip" key={i} title={`${c.pinyin} — ${c.meaningVi}`}>
              {c.hanzi[0]}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------- TAB: ÔN TẬP --- */

function ReviewView({ onStart }: { onStart: (cards: Card[]) => void }) {
  const entries = useCourseStore((s) => s.entries);
  const today = todayStr();

  const due = useMemo(() => {
    return entries
      .filter((e) => !e.srs || (e.srs.due ?? '') <= today)
      .sort((a, b) => ((a.srs?.due ?? '9999') < (b.srs?.due ?? '9999') ? -1 : 1));
  }, [entries, today]);

  const overdue = due.filter((e) => e.srs && e.srs.due < today).length;
  const cards = useMemo(() => due.map(toCard), [due]);

  return (
    <div className="zh-review">
      <div className="zh-review-summary">
        <div className="zh-review-stat">
          <span className="num">{due.length}</span>
          <span className="lbl">từ đến hạn</span>
        </div>
        <div className="zh-review-stat overdue">
          <span className="num">{overdue}</span>
          <span className="lbl">quá hạn</span>
        </div>
        <button
          className="zh-btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => onStart(cards)}
          disabled={!cards.length}
        >
          🔄 Bắt đầu ôn tập
        </button>
      </div>

      <div className="zh-sect-label">Danh sách đến hạn</div>
      <div className="zh-review-list">
        {due.length === 0 ? (
          <p className="zh-hint">Hôm nay không có từ nào đến hạn. 🎉</p>
        ) : (
          due.map((e) => {
            const c = toCard(e);
            const days = e.srs?.interval ?? 0;
            return (
              <div className="zh-review-row" key={e.id}>
                <span className="zh-list-hanzi">{c.hanzi}</span>
                <div className="zh-list-meta">
                  <div className="py">{c.pinyin}</div>
                  <div className="mean">{c.meaningVi || e.senses?.[0]?.meaning?.vi || ''}</div>
                </div>
                <span className={`zh-interval ${e.srs && e.srs.due < today ? 'overdue' : ''}`}>
                  {e.srs
                    ? e.srs.due < today
                      ? 'Quá hạn'
                      : `Ôn lại sau ${days} ngày`
                    : 'Mới · chưa có lịch'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------- TAB: TIẾN ĐỘ --- */

function ProgressView({ words }: { words: ZhWord[] | null }) {
  const entries = useCourseStore((s) => s.entries);
  const daily = useCourseStore((s) => s.daily);
  const today = todayStr();

  const todayLearned = new Set(daily[today] || []).size;
  const total = entries.length;

  // 7 ngày gần đây
  const week = useMemo(() => {
    const days: { d: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = todayStr(dt);
      const n = (daily[key] || []).length;
      days.push({ d: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dt.getDay()], n });
    }
    return days;
  }, [daily]);

  // Tiến độ theo cấp
  const levelProg = useMemo(() => {
    const byLevel = new Map<number, number>();
    entries.forEach((e) => {
      const lv = e.level ?? 0;
      if (lv >= 1 && lv <= 6) byLevel.set(lv, (byLevel.get(lv) || 0) + 1);
    });
    const totalByLevel: Record<number, number> = {};
    words?.forEach((w) => {
      totalByLevel[w.hsk_level] = (totalByLevel[w.hsk_level] || 0) + 1;
    });
    return LEVELS.map((lv) => ({
      lv,
      learned: byLevel.get(lv) || 0,
      total: totalByLevel[lv] || 0,
    }));
  }, [entries, words]);

  const maxWeek = Math.max(1, ...week.map((d) => d.n));

  return (
    <div className="zh-progress">
      <div className="zh-stat-cards">
        <div className="zh-stat-card">
          <span className="ico">🔖</span>
          <span className="num">{todayLearned}</span>
          <span className="lbl">từ mới hôm nay</span>
        </div>
        <div className="zh-stat-card">
          <span className="ico">🔄</span>
          <span className="num">{total}</span>
          <span className="lbl">tổng từ trong kho</span>
        </div>
        <div className="zh-stat-card">
          <span className="ico">📈</span>
          <span className="num">HSK {Math.max(1, ...entries.map((e) => e.level ?? 1))}</span>
          <span className="lbl">cấp cao nhất đang học</span>
        </div>
      </div>

      <div className="zh-sect-label">7 ngày gần đây</div>
      <div className="zh-week">
        {week.map((d) => (
          <div className="zh-week-col" key={d.d}>
            <div className="zh-week-bar" style={{ height: `${(d.n / maxWeek) * 100}%` }} />
            <span className="n">{d.n}</span>
            <span className="d">{d.d}</span>
          </div>
        ))}
      </div>

      <div className="zh-sect-label">Tiến độ theo cấp độ</div>
      <div className="zh-level-bars">
        {levelProg.map((l) => (
          <div className="zh-level-row" key={l.lv}>
            <span className="tag">HSK {l.lv}</span>
            <div className="track">
              <div
                className="fill"
                style={{ width: `${l.total ? (l.learned / l.total) * 100 : 0}%` }}
              />
            </div>
            <span className="count">
              {l.learned}/{l.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
