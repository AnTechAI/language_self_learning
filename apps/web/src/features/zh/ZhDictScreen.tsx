/**
 * ZhDictScreen — TỪ ĐIỂN TIẾNG TRUNG (khóa zh — tab 'Từ vựng').
 * Tra/browse HSK 3.0 đầy đủ (hsk.json tải nhu cầu): tìm theo Hán tự / pinyin
 * (có dấu hoặc không) / nghĩa Việt-Anh / bộ thủ, lọc theo cấp độ, xem chi tiết
 * từ (bộ thủ, số nét, phồn thể, TTS) + bookmark vào kho (để luyện viết/ôn tập).
 * Thiết kế: docs/chinese_design.md §4.1.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, EmptyState, Speak } from '../../components/ui';
import { loadZhDict, type ZhWord } from '../../data/zhDict';
import { stripTones } from '../../lib/zh';
import { useCourseStore } from '../../store/useCourseStore';

const LEVELS = [1, 2, 3, 4, 5, 6];

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
      .then((w) => live && setWords(w))
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
      <EmptyState big="⚠️" title="Lỗi">
        {err}
      </EmptyState>
    );

  return (
    <>
      <div className="hero">
        <h2>📖 Từ điển tiếng Trung (HSK 3.0)</h2>
        <p>Tìm theo Hán tự, pinyin (có/không dấu), nghĩa Việt–Anh hoặc bộ thủ.</p>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="vd: 你好 · ni hao · xin chào · 亻"
          style={{ width: '100%', maxWidth: 420 }}
        />
        <div className="chip-row" style={{ marginTop: 8 }}>
          <Chip active={!level} onClick={() => setLevel(null)}>
            Tất cả ({words ? words.length : '…'})
          </Chip>
          {LEVELS.map((l) => (
            <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
              HSK {l}
            </Chip>
          ))}
        </div>
      </div>

      {!words ? (
        <Card>Tải từ điển…</Card>
      ) : sel ? (
        <WordDetailCard
          w={sel}
          inKho={inKho.has(sel.simplified)}
          onBack={() => setSel(null)}
          onBookmark={() => void store.bookmarkZhWord(sel)}
        />
      ) : filtered.length === 0 ? (
        <EmptyState big="🔍" title="Không có kết quả">
          Thử từ khoá khác hoặc bỏ lọc cấp độ.
        </EmptyState>
      ) : (
        <div className="zh-word-list">
          {filtered.slice(0, 120).map((w) => (
            <Button
              key={w.id}
              className="word-item zh-row"
              onClick={() => setSel(w)}
              style={{ display: 'flex', width: '100%', textAlign: 'left' }}
              title={w.meaning_vi || w.meaning_en}
            >
              <span className="w zh-w">{w.simplified}</span>
              <span className="meta">
                <span className="ipa">{w.pinyin}</span>
                {w.meaning_vi ? ` · ${w.meaning_vi}` : ''}
              </span>
              <span className="lev-badge">HSK {w.hsk_level}</span>
              {inKho.has(w.simplified) ? <span title="Trong kho">⭐</span> : null}
            </Button>
          ))}
          {filtered.length > 120 ? (
            <small className="help" style={{ padding: '0 4px' }}>
              Hiện {120}/{filtered.length} — hãy gõ thêm để tra chính xác.
            </small>
          ) : null}
        </div>
      )}
    </>
  );
}

/** Chi tiết 1 từ — Hán tự lớn, pinyin, phồn thể, bộ thủ + số nét, nghĩa, bookmark */
function WordDetailCard({
  w,
  inKho,
  onBack,
  onBookmark,
}: {
  w: ZhWord;
  inKho: boolean;
  onBack: () => void;
  onBookmark: () => void;
}) {
  return (
    <div className="detail-page">
      <Card>
        <Button size="sm" onClick={onBack} style={{ marginBottom: 12 }}>
          ← Quay lại từ điển
        </Button>
        <div className="zh-detail-head">
          <span className="zh-hero">{w.simplified}</span>
          <span className="zh-detail-side">
            <span className="ipa">{w.pinyin}</span>
            {w.traditional !== w.simplified ? <small>phồn thể: {w.traditional}</small> : null}
          </span>
          <Speak text={w.simplified} lang="zh-CN" title="Nghe phát âm (TTS)" />
        </div>
        <div className="chip-row" style={{ margin: '8px 0' }}>
          <span className="lev-badge">HSK {w.hsk_level}</span>
          {w.pos ? <span className="pos-chip">{w.pos}</span> : null}
          {w.classifier ? <span className="pos-chip">量词 {w.classifier}</span> : null}
        </div>

        <div className="def">{w.meaning_vi || '…'}</div>
        <div className="help">{w.meaning_en}</div>

        {/* Bộ thủ + số nét từng chữ */}
        {w.strokes.length ? (
          <div className="zh-stroke-row">
            {w.strokes.map((s) => (
              <span key={s.c} className="zh-stroke-cell" title={`${s.c} · ${s.n} nét`}>
                <b>{s.c}</b>
                {s.n > 0 ? <small>{s.n} nét</small> : <small>?</small>}
              </span>
            ))}
            {w.radical ? <span className="help">· bộ thủ {w.radical}</span> : null}
          </div>
        ) : null}

        {w.senses.length > 1 ? (
          <div style={{ marginTop: 12 }}>
            <small className="help">Các nghĩa khác:</small>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              {w.senses.slice(1).map((s, i) => (
                <li key={i} style={{ margin: '3px 0', fontSize: 13 }}>
                  {s.pos ? <em>{s.pos}: </em> : null}
                  {s.vi || s.en || ''}
                  {s.en ? <small className="help"> · {s.en}</small> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {w.example_sentences.length ? (
          <div style={{ marginTop: 12 }}>
            <small className="help">Ví dụ câu:</small>
            {w.example_sentences.map((x, i) => (
              <div key={i} className="zh-ex">
                <b>{x.zh}</b> <span className="ipa">{x.pinyin}</span>
                <div className="help">{x.vi}</div>
              </div>
            ))}
          </div>
        ) : null}

        {inKho ? (
          <div className="help" style={{ marginTop: 14 }}>
            ⭐ Từ này đã có trong kho (luyện viết / ôn tập).
          </div>
        ) : (
          <Button style={{ marginTop: 14 }} onClick={onBookmark}>
            ⭐ Thêm vào kho để học
          </Button>
        )}
      </Card>
    </div>
  );
}
