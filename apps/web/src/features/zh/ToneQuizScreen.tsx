/**
 * ToneQuizScreen — NGHE & CHỌN THANH ĐIỆU (khóa zh — docs/chinese_design.md §4.4).
 * TTS đọc cả từ → chọn thanh điệu (1-4 / nhẹ) của chữ được đánh dấu,
 * đối chiếu đường cong thanh điệu. Chỉ các từ có pinyin trong kho.
 */
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, Speak } from '../../components/ui';
import { charTones, numericFromMarked, shuffle, TONE_CURVES, TONE_OPTIONS } from '../../lib/zh';
import { useCourseStore } from '../../store/useCourseStore';

const QTY = 15;

interface Q {
  word: string;
  idx: number; // vị trí chữ được hỏi
  char: string;
  answer: string;
  pinyinN: string;
}

export function ToneQuizScreen({ onBack }: { onBack: () => void }) {
  const entries = useCourseStore((s) => s.entries);
  const recordHistory = useCourseStore((s) => s.recordHistory);
  const [seed, setSeed] = useState(0);
  const [qi, setQi] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const queue = useMemo<Q[]>(() => {
    const qs: Q[] = [];
    for (const e of shuffle(entries)) {
      const pn = e.senses?.[0]?.pronunciation ? numericFromMarked(e.senses[0].pronunciation) : '';
      if (!pn || !e.word) continue;
      const tones = charTones(e.word, pn);
      tones.forEach((t, i) => {
        if (t.tone > 0)
          qs.push({ word: e.word, idx: i, char: t.char, answer: String(t.tone), pinyinN: pn });
      });
      if (qs.length >= QTY) break;
    }
    return shuffle(qs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, seed]);

  const q = queue[qi];

  const pick = (t: string) => {
    if (!q || chosen) return;
    setChosen(t);
    const ok = t === q.answer;
    if (ok) setCorrect((c) => c + 1);
    void recordHistory('tone', q.word, ok);
  };

  const next = () => {
    if (qi + 1 >= queue.length) setDone(true);
    else {
      setQi(qi + 1);
      setChosen(null);
    }
  };

  if (done)
    return (
      <div className="detail-page">
        <Card style={{ textAlign: 'center' }}>
          <div className="zh-hero" style={{ fontSize: 40 }}>
            🎵
          </div>
          <h3>
            Xong! {correct}/{queue.length} đúng
          </h3>
          <p className="help">
            {correct === queue.length
              ? 'Thanh điệu chuẩn cả phiên — xuất sắc!'
              : 'Ôn lại các thanh điệu rồi thử lại nhé.'}
          </p>
          <Button
            onClick={() => {
              setDone(false);
              setQi(0);
              setChosen(null);
              setCorrect(0);
              setSeed((s) => s + 1);
            }}
          >
            🔄 Chơi lại
          </Button>
          <Button variant="ghost" onClick={onBack}>
            ← Quay lại
          </Button>
        </Card>
      </div>
    );

  if (!q)
    return (
      <EmptyState big="🎵" title="Chưa có từ để luyện thanh điệu">
        Thêm từ vào kho (từ điển ⭐ hoặc bài học) rồi quay lại — cần pinyin để luyện nghe.
      </EmptyState>
    );

  const chart = (t: string) => TONE_CURVES[t];

  return (
    <>
      <div className="hero">
        <h2>🎵 Thanh điệu</h2>
        <p>
          Câu {qi + 1}/{queue.length} · đúng {correct}
        </p>
        <Button size="sm" onClick={onBack} style={{ marginTop: 6 }}>
          ← Quay lại
        </Button>
      </div>

      <Card>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>
            Nghe phát âm · chọn thanh điệu của chữ <b style={{ fontSize: 22 }}>{q.char}</b>:
          </div>
          <div className="zh-hero" style={{ fontSize: 56, margin: 0 }}>
            {[...q.word].map((c, i) => (
              <span
                key={i}
                style={
                  i === q.idx ? { color: 'var(--brand)', textDecoration: 'underline' } : undefined
                }
              >
                {c}
              </span>
            ))}
          </div>
          <div className="ipa">
            {q.pinyinN
              .split(' ')
              .map((s, i) => (
                <span key={i} style={i === q.idx ? { fontWeight: 800 } : undefined}>
                  {s}
                </span>
              ))
              .reduce<React.ReactNode[]>((acc, s, i) => (i ? [...acc, ' ', s] : [s]), [])}
          </div>
          <Speak text={q.word} lang="zh-CN" title="Nghe lại" />
        </div>

        <div
          className="tone-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
            gap: 8,
            marginTop: 14,
          }}
        >
          {TONE_OPTIONS.map((t) => {
            const c = chart(t);
            const isAns = chosen !== null && t === q.answer;
            const isChosen = chosen === t;
            const cls = chosen
              ? isAns
                ? 'tone-btn ok'
                : isChosen
                  ? 'tone-btn bad'
                  : 'tone-btn dim'
              : 'tone-btn';
            return (
              <button key={t} className={cls} onClick={() => pick(t)} disabled={!!chosen}>
                <svg viewBox="0 0 120 120" style={{ width: '100%', height: 56 }}>
                  {[28, 60, 92].map((y) => (
                    <line
                      key={y}
                      x1={8}
                      y1={y}
                      x2={118}
                      y2={y}
                      stroke="currentColor"
                      opacity={0.15}
                      strokeWidth={1}
                    />
                  ))}
                  <path
                    d={c.path}
                    fill="none"
                    stroke={c.color}
                    strokeWidth={7}
                    strokeLinecap="round"
                  />
                </svg>
                <b>{t}</b>
                <small>{c.name}</small>
              </button>
            );
          })}
        </div>

        {chosen ? (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <div className={chosen === q.answer ? 'def ok' : 'def bad'}>
              {chosen === q.answer
                ? '✓ Đúng rồi!'
                : `✗ Sai — chữ ${q.char} đọc ${q.answer} (${chart(q.answer).name}).`}
            </div>
            <Button onClick={next} style={{ marginTop: 8 }}>
              {qi + 1 >= queue.length ? '🏁 Xem kết quả' : 'Câu tiếp →'}
            </Button>
          </div>
        ) : (
          <p className="help" style={{ textAlign: 'center', marginTop: 10 }}>
            🔊 Bấm loa để nghe lại · đường cong thể hiện âm điệu của từng thanh
          </p>
        )}
      </Card>
    </>
  );
}
