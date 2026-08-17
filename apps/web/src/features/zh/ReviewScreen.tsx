/**
 * ReviewScreen — ÔN TẬP HÔM NAY (SRS — SM-2, khóa zh; docs/chinese_design.md §4.7).
 * Hàng đợi = từ đến hạn (srs.due <= hôm nay) hoặc chưa từng ôn (từ mới).
 * Lật thẻ để nhớ nghĩa → đánh giá Lại / Khó / Tốt / Dễ → lịch ôn tự điều chỉnh.
 * Không streak 🔥 ở khóa tiếng Trung (thiết kế yêu cầu — xem Layout/Stats).
 */
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState } from '../../components/ui';
import { dueIn, shuffle } from '../../lib/zh';
import { useCourseStore } from '../../store/useCourseStore';

type Grade = 0 | 1 | 2 | 3;

const GRADES: { g: Grade; label: string; ico: string; cls: string }[] = [
  { g: 0, label: 'Lại', ico: '🔁', cls: 'bad' },
  { g: 1, label: 'Khó', ico: '😅', cls: 'ghost' },
  { g: 2, label: 'Tốt', ico: '😊', cls: 'primary' },
  { g: 3, label: 'Dễ', ico: '🚀', cls: 'ok' },
];

export function ReviewScreen({ onBack }: { onBack: () => void }) {
  const entries = useCourseStore((s) => s.entries);
  const applySrs = useCourseStore((s) => s.applySrs);
  const recordHistory = useCourseStore((s) => s.recordHistory);
  const today = dueIn(0);
  const [seed, setSeed] = useState(0);
  const [qi, setQi] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [graded, setGraded] = useState<number[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  const queue = useMemo(
    () => shuffle(entries.filter((e) => !e.srs || (e.srs.due ?? '') <= today)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, seed],
  );
  const q = queue[qi];

  const pick = (g: Grade) => {
    if (!q || !flipped) return;
    setGraded((a) => [...a, g]);
    setDoneCount((n) => n + 1);
    void applySrs(q.id, g);
    void recordHistory('srs', q.word, g >= 2);
    setFlipped(false);
    if (qi + 1 >= queue.length)
      setDoneCount(queue.length); // nhấn Xong rồi
    else setQi(qi + 1);
  };

  const remaining = queue.length - Math.min(doneCount, queue.length);

  if (queue.length === 0)
    return (
      <EmptyState big="📅" title="Hôm nay không có gì để ôn">
        Thêm từ mới vào kho (từ điển ⭐ hoặc học bài) — từ mới sẽ vào hàng đợi ôn của ngày hôm nay.
      </EmptyState>
    );

  if (!q)
    return (
      <div className="detail-page">
        <Card style={{ textAlign: 'center' }}>
          <div className="zh-hero" style={{ fontSize: 40 }}>
            🎉
          </div>
          <h3>Đã ôn xong {queue.length} từ</h3>
          <p className="help">
            {graded.filter((g) => g >= 2).length} từ nhớ tốt ·{' '}
            {graded.filter((g) => g === 0).length} từ cần ôn lại.
          </p>
          <Button
            onClick={() => {
              setQi(0);
              setFlipped(false);
              setGraded([]);
              setDoneCount(0);
              setSeed((s) => s + 1);
            }}
          >
            🔄 Ôn lại
          </Button>
          <Button variant="ghost" onClick={onBack}>
            ← Quay lại
          </Button>
        </Card>
      </div>
    );

  const pinyin = q.senses?.[0]?.pronunciation || '';
  const vi =
    q.senses
      ?.map((s) => s.meaning.vi || s.meaning.en)
      .filter(Boolean)
      .join('; ') || q.word;

  return (
    <>
      <div className="hero">
        <h2>⭐ Ôn tập hôm nay</h2>
        <p>
          {remaining} từ còn lại · {graded.length} đã ôn
        </p>
        <Button size="sm" onClick={onBack} style={{ marginTop: 6 }}>
          ← Quay lại
        </Button>
      </div>

      <Card style={{ textAlign: 'center', padding: 28 }}>
        <div className="zh-hero" style={{ fontSize: 64, margin: 0 }}>
          {q.word}
        </div>
        <div className="ipa" style={{ fontSize: 17 }}>
          {pinyin}
        </div>

        {flipped ? (
          <div className="def" style={{ marginTop: 14, fontSize: 15 }}>
            {vi}
          </div>
        ) : (
          <p className="help" style={{ margin: '14px 0' }}>
            Bạn có nhớ nghĩa của từ này không?
          </p>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 16,
            maxWidth: 320,
            marginInline: 'auto',
          }}
        >
          {!flipped ? (
            <Button onClick={() => setFlipped(true)}>
              {q.senses?.length ? '👁 Xem nghĩa' : 'Đã biết — đánh giá'}
            </Button>
          ) : (
            GRADES.map((gr) => (
              <Button
                key={gr.g}
                variant={gr.cls === 'ok' ? 'soft' : (gr.cls as 'primary' | 'ghost' | 'danger')}
                onClick={() => pick(gr.g)}
              >
                {gr.ico} {gr.label}
                {gr.g === 0 ? ' · ôn lại hôm nay' : gr.g === 3 ? ` · ${dueIn(4)}` : ''}
              </Button>
            ))
          )}
        </div>
      </Card>
    </>
  );
}
