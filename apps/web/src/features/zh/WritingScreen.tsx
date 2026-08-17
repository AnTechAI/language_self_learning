/**
 * WritingScreen — LUYỆN VIẾT CHỮ HÁN (khóa zh — thiết kế docs/chinese_design.md §4.3).
 * Hanzi Writer (thư viện mã nguồn mở — SVG): chế độ XEM (animation thứ tự nét)
 * và chế độ LUYỆN (vẽ theo, chấm đúng/sai từng nét). Dữ liệu nét tải nhu cầu
 * (zh-strokes.json — trích từ hanzi-writer-data cho đúng bộ chữ HSK).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { Button, Card, Chip, EmptyState } from '../../components/ui';
import { loadZhStrokes, type ZhStrokesData } from '../../data/zhDict';
import { shuffle } from '../../lib/zh';
import { useCourseStore } from '../../store/useCourseStore';

const SIZE = 240;
const dark = () => document.documentElement.dataset.theme === 'dark';

export function WritingScreen({ onBack }: { onBack: () => void }) {
  const entries = useCourseStore((s) => s.entries);
  const [strokes, setStrokes] = useState<ZhStrokesData | null>(null);
  const [err, setErr] = useState('');
  const [idx, setIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [mode, setMode] = useState<'auto' | 'quiz'>('auto');
  const [quizDone, setQuizDone] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    loadZhStrokes()
      .then((d) => live && setStrokes(d))
      .catch(() => live && setErr('Không tải được dữ liệu nét chữ (zh-strokes.json)'));
    return () => {
      live = false;
    };
  }, []);

  const pool = useMemo(
    () => shuffle(entries.filter((e) => e.word && [...e.word].some((c) => strokes && strokes[c]))),
    [entries, strokes],
  );
  const entry = pool[idx];
  const word = entry?.word || '';
  const chars = [...word];
  const char = chars[Math.min(charIdx, chars.length - 1)] || '';
  const charData = strokes?.[char];

  useEffect(() => {
    if (!char || !charData || !boxRef.current) return;
    const el = boxRef.current;
    el.innerHTML = '';
    const ink = dark() ? '#ece5d2' : '#2b2a24';
    const brand = dark() ? '#d46a4f' : '#b3402c';
    const outline = dark() ? '#3a3a2c' : '#e3dac5';
    const writer = HanziWriter.create(boxRef.current, char, {
      charDataLoader: (
        _c: string,
        onLoad: (d: { strokes: string[]; medians: number[][][] }) => void,
      ) => onLoad({ strokes: charData.s, medians: charData.m }),
      width: SIZE,
      height: SIZE,
      padding: 6,
      strokeColor: ink,
      outlineColor: outline,
      highlightColor: brand,
      drawingColor: brand,
      strokeAnimationSpeed: 0.6,
      showOutline: true,
      showCharacter: mode === 'quiz',
      showHintAfterMisses: 3,
    });
    if (mode === 'auto') void writer.animateCharacter();
    else void writer.quiz({ onComplete: () => setQuizDone((n) => n + 1) });
    return () => {
      (writer as unknown as { destroy?: () => void }).destroy?.();
    };
  }, [char, charData, mode]);

  if (err)
    return (
      <EmptyState big="⚠️" title="Lỗi">
        {err}
      </EmptyState>
    );

  return (
    <>
      <div className="hero">
        <h2>✍️ Luyện viết chữ Hán</h2>
        <p>Xem thứ tự nét rồi vẽ theo — chấm điểm từng nét.</p>
        <Button size="sm" onClick={onBack} style={{ marginTop: 6 }}>
          ← Quay lại
        </Button>
      </div>

      {!entry ? (
        <EmptyState big="🖊️" title="Chưa có từ để luyện">
          Thêm từ vào kho (từ điển ⭐ hoặc bài học) rồi quay lại đây.
        </EmptyState>
      ) : (
        <>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                {mode === 'auto' ? '▶ XEM thứ tự nét' : '✍️ LUYỆN — vẽ theo'}
                {quizDone > 0 && mode === 'quiz' ? ' · hoàn thành ✓' : ''}
              </div>
              <div className="zh-hero" style={{ fontSize: 44, margin: 0 }}>
                {word}
              </div>
              {entry.senses?.[0]?.pronunciation ? (
                <div className="ipa">{entry.senses[0].pronunciation}</div>
              ) : null}
              <div
                ref={boxRef}
                className="writer-box"
                style={{ width: SIZE + 12, height: SIZE + 12 }}
              />
              <div className="chip-row" style={{ justifyContent: 'center', marginTop: 10 }}>
                {chars.map((c, i) => (
                  <Chip key={i} active={i === charIdx} onClick={() => setCharIdx(i)}>
                    {c}
                  </Chip>
                ))}
              </div>
            </div>
          </Card>
          <div className="btn-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant={mode === 'auto' ? 'primary' : 'ghost'}
              onClick={() => setMode('auto')}
              style={{ flex: 1 }}
            >
              ▶ Xem nét
            </Button>
            <Button
              variant={mode === 'quiz' ? 'primary' : 'ghost'}
              onClick={() => {
                setQuizDone(0);
                setMode('quiz');
              }}
              style={{ flex: 1 }}
            >
              ✍️ Luyện viết
            </Button>
            <Button
              onClick={() => {
                setIdx((i) => (i + 1) % pool.length);
                setCharIdx(0);
                setQuizDone(0);
              }}
              style={{ flex: 1 }}
            >
              ⏭ Từ khác
            </Button>
          </div>
        </>
      )}
    </>
  );
}
