/**
 * GrammarScreen — NGỮ PHÁP TIẾNG TRUNG theo cấp HSK 3.0 (khóa zh).
 * 422 điểm ngữ pháp của syllabus chính thức (krmanik/HSK-3.0), kèm ví dụ câu.
 * docs/chinese_design.md §4.5.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, Chip, EmptyState } from '../../components/ui';
import { loadZhGrammar, type ZhGrammarPoint } from '../../data/zhDict';

const LEVELS = [1, 2, 3, 4, 5, 6];

export function GrammarScreen() {
  const [pts, setPts] = useState<ZhGrammarPoint[] | null>(null);
  const [err, setErr] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadZhGrammar()
      .then((p) => live && setPts(p))
      .catch(() => live && setErr('Không tải được ngữ pháp (zh-grammar.json)'));
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(
    () => (pts || []).filter((p) => (level ? p.level === level : true)),
    [pts, level],
  );

  if (err)
    return (
      <EmptyState big="⚠️" title="Lỗi">
        {err}
      </EmptyState>
    );

  return (
    <>
      <div className="hero">
        <h2>📘 Ngữ pháp tiếng Trung (HSK 3.0)</h2>
        <p>Theo đúng khung ngữ pháp từng cấp — 422 điểm kèm ví dụ câu.</p>
        <div className="chip-row" style={{ marginTop: 8 }}>
          <Chip active={!level} onClick={() => setLevel(null)}>
            Tất cả ({pts ? pts.length : '…'})
          </Chip>
          {LEVELS.map((l) => (
            <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
              Cấp {l} ({pts ? pts.filter((p) => p.level === l).length : ''})
            </Chip>
          ))}
        </div>
      </div>

      {!pts ? (
        <Card>Tải ngữ pháp…</Card>
      ) : filtered.length === 0 ? (
        <EmptyState big="📘" title="Trống">
          Không có điểm ngữ pháp ở cấp này.
        </EmptyState>
      ) : (
        <div className="zh-word-list">
          {filtered.map((p) => (
            <Card key={p.id} className="grammar-card">
              <button
                className="grammar-head"
                onClick={() => setOpen(open === p.id ? null : p.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                <span className="lev-badge">HSK {p.level}</span>
                <span className="grammar-title">{p.title}</span>
                <span className="cue">
                  {p.examples.length} ví dụ {open === p.id ? '▴' : '▾'}
                </span>
              </button>
              {open === p.id ? (
                <div style={{ padding: '10px 4px 4px' }}>
                  {p.note !== p.title ? (
                    <p className="help" style={{ marginTop: 0 }}>
                      {p.note}
                    </p>
                  ) : null}
                  {p.examples.slice(0, 8).map((ex, i) => (
                    <div key={i} className="zh-ex" style={{ marginBottom: 6 }}>
                      {ex}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
