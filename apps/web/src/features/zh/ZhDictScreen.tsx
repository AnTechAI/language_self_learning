/**
 * ZhDictScreen — TỪ ĐIỂN TIẾNG TRUNG (khóa zh — tab 'Từ vựng').
 * Thiết kế theo chinese-app-ui.jsx: tìm kiếm + chip HSK ở topbar, thân gồm
 * 2 pane — danh sách từ (trái) + chi tiết từ (phải). Tải hsk.json nhu cầu.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Speak } from '../../components/ui';
import { loadZhDict, type ZhWord } from '../../data/zhDict';
import { charTones, stripTones, TONE_CURVES } from '../../lib/zh';
import { useCourseStore } from '../../store/useCourseStore';

const LEVELS = [1, 2, 3, 4, 5, 6];

/** Đường cong thanh điệu nhỏ (tham chiếu thiết kế) */
function ToneCurve({ tone, active }: { tone: string; active?: boolean }) {
  const c = TONE_CURVES[tone] || TONE_CURVES['0'];
  return (
    <svg
      width="34"
      height="18"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {[28, 60, 92].map((y) => (
        <line
          key={y}
          x1={6}
          y1={y}
          x2={118}
          y2={y}
          stroke={active ? '#d8d1c5' : '#e9e4dc'}
          strokeWidth={1}
        />
      ))}
      <path
        d={c.path}
        stroke={active ? c.color : '#b7b0a6'}
        strokeWidth={8}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Con dấu cấp độ HSK */
function SealBadge({ level }: { level: number }) {
  return (
    <div className="seal-badge" aria-label={`HSK ${level}`}>
      <span>HSK</span>
      <strong>{level}</strong>
    </div>
  );
}

export function ZhDictScreen() {
  const store = useCourseStore();
  const [words, setWords] = useState<ZhWord[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [sel, setSel] = useState<ZhWord | null>(null);

  useEffect(() => {
    let live = true;
    loadZhDict()
      .then((w) => {
        if (!live) return;
        setWords(w);
        setSel(w[0] || null);
      })
      .catch(() => live && setErr('Không tải được từ điển (hsk.json)'));
    return () => {
      live = false;
    };
  }, []);

  const inKho = useMemo(() => new Set(store.entries.map((e) => e.word)), [store.entries]);

  const filtered = useMemo(() => {
    if (!words) return [];
    const nq = stripTones(q.trim()).toLowerCase();
    return words.filter((w) => {
      if (level && w.hsk_level !== level) return false;
      if (!nq) return true;
      return (
        w.simplified.includes(q.trim()) ||
        w.traditional.includes(q.trim()) ||
        stripTones(w.pinyin).includes(nq) ||
        w.pinyin_numeric.includes(nq) ||
        stripTones(w.meaning_vi).includes(nq) ||
        w.meaning_vi.toLowerCase().includes(q.trim().toLowerCase()) ||
        w.meaning_en.toLowerCase().includes(nq) ||
        w.radical === q.trim() ||
        stripTones(w.radical).includes(nq)
      );
    });
  }, [words, q, level]);

  if (err)
    return (
      <div className="empty-wrap">
        <p>⚠️ {err}</p>
      </div>
    );

  const counts = (() => {
    const m: Record<number, number> = {};
    words?.forEach((w) => (m[w.hsk_level] = (m[w.hsk_level] || 0) + 1));
    return m;
  })();

  return (
    <div className="dict-page">
      {/* Topbar — tìm kiếm + chip HSK */}
      <div className="dict-topbar">
        <p className="eyebrow">Zero → HSK 6</p>
        <div className="title-row">
          <h1 className="hanzi-title">从零开始</h1>
          <span>Học tiếng Trung từ Zero</span>
        </div>
        <div className="search-row">
          <div className="search-box">
            <svg
              width="16"
              height="16"
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
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tra Hán tự, pinyin hoặc nghĩa..."
            />
          </div>
          <div className="chips">
            <button className={`chip ${level === null ? 'on' : ''}`} onClick={() => setLevel(null)}>
              Tất cả {words ? words.length : ''}
            </button>
            {LEVELS.map((lv) => (
              <button
                key={lv}
                className={`chip ${level === lv ? 'on' : ''}`}
                onClick={() => setLevel(lv)}
              >
                HSK {lv} {counts[lv] || ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body — 2 pane */}
      <div className="dict-body">
        <div className="dict-list">
          {!words ? (
            <p className="dict-hint">Đang tải từ điển…</p>
          ) : filtered.length === 0 ? (
            <p className="dict-hint">Không tìm thấy từ nào.</p>
          ) : (
            filtered.map((w) => (
              <button
                key={w.id}
                className={`dict-item ${sel?.id === w.id ? 'active' : ''}`}
                onClick={() => setSel(w)}
              >
                <span className="dl-hanzi">{w.simplified}</span>
                <span className="dl-meta">
                  <span className="dl-py">{w.pinyin}</span>
                  <span className="dl-mean">{w.meaning_vi || w.meaning_en || '…'}</span>
                </span>
                {inKho.has(w.simplified) ? (
                  <span className="dot" title="Trong kho" />
                ) : (
                  <span className="dot dim" title="Chưa học" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="dict-detail">
          {sel ? (
            <WordDetail
              w={sel}
              inKho={inKho.has(sel.simplified)}
              onBookmark={() => void store.bookmarkZhWord(sel)}
              onWrite={() => {
                store.setZhWriteTarget({ word: sel.simplified, pinyin: sel.pinyin });
                store.setZhView('writing');
              }}
            />
          ) : (
            <p className="dict-hint">Chọn một từ để xem chi tiết.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function WordDetail({
  w,
  inKho,
  onBookmark,
  onWrite,
}: {
  w: ZhWord;
  inKho: boolean;
  onBookmark: () => void;
  onWrite: () => void;
}) {
  const tones = charTones(w.simplified, w.pinyin_numeric);
  const firstTone = tones[0]?.tone != null ? String(tones[0].tone) : '0';

  return (
    <div className="dict-detail-inner">
      <div className="hero-row">
        <div className="hero-left">
          <div className="hero-hanzi">{w.simplified}</div>
          <div>
            <div className="hero-py-row">
              <ToneCurve tone={firstTone} active />
              <span className="hero-py">{w.pinyin}</span>
              <Speak text={w.simplified} lang="zh-CN" title="Nghe phát âm (TTS)" />
            </div>
            <div className="hero-meaning">
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

      <div className="section-label">Thanh điệu</div>
      <div className="tone-row">
        {tones.map((t, i) => (
          <span key={i} className="tone-cell">
            <span className="tone-char">{t.char}</span>
            <ToneCurve tone={String(t.tone)} active />
            <small>{t.tone}</small>
          </span>
        ))}
      </div>

      <div className="section-label">Bộ thủ & Lượng từ</div>
      <div className="radical-row">
        {w.radical ? <span className="radical-chip">{w.radical}</span> : null}
        {w.classifier ? <span className="pos-chip">量词 {w.classifier}</span> : null}
        {w.traditional && w.traditional !== w.simplified ? (
          <span className="pos-chip">phồn thể {w.traditional}</span>
        ) : null}
        <span className="pos-chip">{w.pos || 'từ'}</span>
        {w.frequency_rank ? (
          <span className="pos-chip" title="Tần suất SUBTLEX-CH (thấp = phổ biến)">
            tần suất #{w.frequency_rank}
          </span>
        ) : null}
      </div>

      <div className="section-label">Thứ tự nét</div>
      <div className="stroke-row">
        {w.strokes.map((s) => (
          <span key={s.c} className="stroke-box" title={`${s.c} · ${s.n} nét`}>
            <span>{s.c}</span>
            <small>{s.n > 0 ? `${s.n} nét` : '?'}</small>
          </span>
        ))}
      </div>

      <div className="section-label">Nghĩa khác</div>
      {w.senses.length > 1 ? (
        <ul className="sense-list">
          {w.senses.slice(1).map((s, i) => (
            <li key={i}>
              {s.pos ? <em>{s.pos}: </em> : null}
              {s.vi || s.en || ''}
              {s.en && s.vi ? <small> · {s.en}</small> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="dict-hint">Từ đơn nghĩa.</p>
      )}

      <div className="section-label">Ví dụ câu</div>
      {w.example_sentences.length ? (
        w.example_sentences.map((x, i) => (
          <div key={i} className="example-card">
            <div className="ezh">{x.zh}</div>
            <div className="epy">{x.pinyin}</div>
            <div className="evi">{x.vi}</div>
          </div>
        ))
      ) : (
        <div className="example-card empty">
          <p>Ví dụ câu đang được bổ sung ở phiên bản sau.</p>
        </div>
      )}

      <div className="dict-actions">
        {inKho ? (
          <Button variant="primary" disabled title="Từ này đã có trong kho">
            ⭐ Đã thêm vào kho
          </Button>
        ) : (
          <Button variant="primary" onClick={onBookmark}>
            + Thêm vào kho để ôn tập
          </Button>
        )}
        <Button variant="ghost" onClick={onWrite}>
          ✍️ Luyện viết chữ này
        </Button>
      </div>
    </div>
  );
}
