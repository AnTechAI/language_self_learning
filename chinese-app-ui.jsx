import React, { useState, useMemo } from "react";
import {
  Search,
  BookOpen,
  Layers,
  PenLine,
  RotateCcw,
  BarChart3,
  Volume2,
  Bookmark,
  Plus,
} from "lucide-react";

/* ---------------------------------------------------------
   Mock data — sẽ được thay bằng dictionary thật (HSK 3.0)
--------------------------------------------------------- */
const WORDS = [
  {
    id: 1,
    hanzi: "学",
    pinyin: "xué",
    tone: 2,
    hsk: 1,
    meaningVi: "học",
    meaningEn: "to study",
    radicals: ["⺍", "冖", "子"],
    strokes: 8,
    example: { zh: "我每天学习中文。", pinyin: "Wǒ měitiān xuéxí Zhōngwén.", vi: "Tôi học tiếng Trung mỗi ngày." },
    learned: true,
  },
  {
    id: 2,
    hanzi: "水",
    pinyin: "shuǐ",
    tone: 3,
    hsk: 1,
    meaningVi: "nước",
    meaningEn: "water",
    radicals: ["水"],
    strokes: 4,
    example: { zh: "请给我一杯水。", pinyin: "Qǐng gěi wǒ yì bēi shuǐ.", vi: "Cho tôi một ly nước." },
    learned: true,
  },
  {
    id: 3,
    hanzi: "茶",
    pinyin: "chá",
    tone: 2,
    hsk: 2,
    meaningVi: "trà",
    meaningEn: "tea",
    radicals: ["艹", "人", "木"],
    strokes: 9,
    example: { zh: "你喝茶还是喝咖啡？", pinyin: "Nǐ hē chá háishi hē kāfēi?", vi: "Bạn uống trà hay cà phê?" },
    learned: false,
  },
  {
    id: 4,
    hanzi: "书",
    pinyin: "shū",
    tone: 1,
    hsk: 1,
    meaningVi: "sách",
    meaningEn: "book",
    radicals: ["乛", "𠃌"],
    strokes: 4,
    example: { zh: "这本书很有意思。", pinyin: "Zhè běn shū hěn yǒuyìsi.", vi: "Cuốn sách này rất thú vị." },
    learned: false,
  },
  {
    id: 5,
    hanzi: "问",
    pinyin: "wèn",
    tone: 4,
    hsk: 1,
    meaningVi: "hỏi",
    meaningEn: "to ask",
    radicals: ["门", "口"],
    strokes: 6,
    example: { zh: "我可以问你一个问题吗？", pinyin: "Wǒ kěyǐ wèn nǐ yí ge wèntí ma?", vi: "Tôi có thể hỏi bạn một câu không?" },
    learned: false,
  },
  {
    id: 6,
    hanzi: "写",
    pinyin: "xiě",
    tone: 3,
    hsk: 2,
    meaningVi: "viết",
    meaningEn: "to write",
    radicals: ["冖", "与"],
    strokes: 5,
    example: { zh: "请写你的名字。", pinyin: "Qǐng xiě nǐ de míngzi.", vi: "Xin viết tên của bạn." },
    learned: false,
  },
];

const NAV = [
  { key: "dict", label: "Từ điển", icon: BookOpen },
  { key: "flash", label: "Flashcard", icon: Layers },
  { key: "write", label: "Luyện viết", icon: PenLine },
  { key: "review", label: "Ôn tập", icon: RotateCcw },
  { key: "progress", label: "Tiến độ", icon: BarChart3 },
];

const TONE_PATHS = {
  1: "M4 8 L28 8",
  2: "M4 13 C 12 13, 18 3, 28 3",
  3: "M4 6 C 10 14, 14 14, 16 9 C 18 4, 24 4, 28 8",
  4: "M4 3 C 14 3, 20 15, 28 15",
};

function ToneCurve({ tone, active }) {
  return (
    <svg width="32" height="18" viewBox="0 0 32 18" fill="none" aria-hidden="true">
      <path
        d={TONE_PATHS[tone]}
        stroke={active ? "#B8332B" : "#B7B0A6"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SealBadge({ level }) {
  return (
    <div className="seal-badge" aria-label={`HSK ${level}`}>
      <span>HSK</span>
      <strong>{level}</strong>
    </div>
  );
}

function StrokeStages({ hanzi, strokes }) {
  const stages = Math.min(strokes, 6);
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: stages }).map((_, i) => (
        <div key={i} className="stroke-box">
          <span style={{ opacity: (i + 1) / stages }}>{hanzi}</span>
        </div>
      ))}
      {strokes > 6 && <span className="stroke-more">+{strokes - 6} nét</span>}
    </div>
  );
}

export default function ChineseApp() {
  const [query, setQuery] = useState("");
  const [activeNav, setActiveNav] = useState("dict");
  const [selectedId, setSelectedId] = useState(WORDS[0].id);
  const [learnedMap, setLearnedMap] = useState(
    Object.fromEntries(WORDS.map((w) => [w.id, w.learned]))
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WORDS;
    return WORDS.filter(
      (w) =>
        w.hanzi.includes(q) ||
        w.pinyin.toLowerCase().includes(q) ||
        w.meaningVi.toLowerCase().includes(q) ||
        w.meaningEn.toLowerCase().includes(q)
    );
  }, [query]);

  const selected = WORDS.find((w) => w.id === selectedId) || WORDS[0];

  return (
    <div className="shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Inter:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600&display=swap');

        :root {
          --bg: #FFFFFF;
          --bg-soft: #FAF8F5;
          --ink: #1C1B19;
          --ink-soft: #7A7369;
          --line: #E9E4DC;
          --seal: #B8332B;
          --seal-soft: #F7E9E7;
          --jade: #3D6B5C;
          --jade-soft: #E9F1EE;
        }
        * { box-sizing: border-box; }
        .shell {
          font-family: 'Inter', 'Noto Sans', sans-serif;
          background: var(--bg);
          color: var(--ink);
          min-height: 100vh;
          display: flex;
          width: 100%;
        }
        .hanzi { font-family: 'Noto Serif SC', serif; }

        /* --- nav rail --- */
        .rail {
          width: 76px;
          flex-shrink: 0;
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 0;
          gap: 4px;
        }
        .rail-mark {
          width: 40px; height: 40px;
          border-radius: 8px;
          background: var(--seal);
          color: #fff;
          font-family: 'Noto Serif SC', serif;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          font-size: 19px;
          margin-bottom: 22px;
          transform: rotate(-2deg);
        }
        .rail-btn {
          width: 52px; height: 52px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 4px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--ink-soft);
          cursor: pointer;
          font-size: 10.5px;
          font-family: 'Inter', sans-serif;
          transition: background .15s ease, color .15s ease;
        }
        .rail-btn:hover { background: var(--bg-soft); color: var(--ink); }
        .rail-btn.active { background: var(--seal-soft); color: var(--seal); }

        /* --- main layout --- */
        .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .topbar {
          padding: 22px 32px 18px;
          border-bottom: 1px solid var(--line);
        }
        .eyebrow {
          font-size: 11px;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin: 0 0 4px;
        }
        .title-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 16px; }
        .title-row h1 {
          font-family: 'Noto Serif SC', serif;
          font-size: 24px;
          margin: 0;
          font-weight: 700;
        }
        .title-row span { color: var(--ink-soft); font-size: 14px; }

        .search-row { display: flex; gap: 10px; align-items: center; }
        .search-box {
          flex: 1;
          max-width: 420px;
          display: flex; align-items: center; gap: 8px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 9px 12px;
          background: var(--bg-soft);
        }
        .search-box input {
          border: none; background: transparent; outline: none;
          font-size: 14px; width: 100%; color: var(--ink);
          font-family: 'Inter', sans-serif;
        }
        .search-box svg { color: var(--ink-soft); flex-shrink: 0; }

        .chips { display: flex; gap: 6px; margin-left: 4px; }
        .chip {
          font-size: 12px;
          padding: 5px 11px;
          border-radius: 999px;
          border: 1px solid var(--line);
          color: var(--ink-soft);
          background: #fff;
        }
        .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }

        /* --- body: list + detail --- */
        .body { flex: 1; display: flex; min-height: 0; }
        .list {
          width: 300px;
          flex-shrink: 0;
          border-right: 1px solid var(--line);
          overflow-y: auto;
          padding: 8px;
        }
        .list-item {
          width: 100%;
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
        }
        .list-item:hover { background: var(--bg-soft); }
        .list-item.active { background: var(--seal-soft); }
        .list-hanzi {
          font-family: 'Noto Serif SC', serif;
          font-size: 22px;
          width: 34px;
          text-align: center;
          flex-shrink: 0;
        }
        .list-meta { min-width: 0; flex: 1; }
        .list-meta .py { font-size: 12.5px; color: var(--ink-soft); }
        .list-meta .mean { font-size: 13.5px; font-weight: 500; }
        .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--jade); flex-shrink: 0; }

        /* --- detail panel --- */
        .detail { flex: 1; padding: 36px 44px; overflow-y: auto; }
        .hero { display: flex; justify-content: space-between; align-items: flex-start; }
        .hero-left { display: flex; gap: 26px; align-items: center; }
        .hero-hanzi {
          font-family: 'Noto Serif SC', serif;
          font-size: 96px;
          line-height: 1;
          font-weight: 700;
        }
        .hero-py-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .hero-py { font-size: 20px; color: var(--ink-soft); font-weight: 500; }
        .hero-audio {
          width: 30px; height: 30px; border-radius: 999px;
          border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center;
          background: #fff; color: var(--seal); cursor: pointer;
        }
        .hero-meaning { font-size: 15px; color: var(--ink); }
        .hero-meaning .vi { font-weight: 600; }
        .hero-meaning .en { color: var(--ink-soft); }

        .seal-badge {
          width: 58px; height: 58px;
          border: 2.5px solid var(--seal);
          border-radius: 8px;
          color: var(--seal);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          transform: rotate(3deg);
          font-family: 'Noto Serif SC', serif;
        }
        .seal-badge span { font-size: 9px; letter-spacing: .08em; }
        .seal-badge strong { font-size: 20px; line-height: 1; }

        .section-label {
          font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
          color: var(--ink-soft); margin: 30px 0 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .section-label::after { content: ''; flex: 1; height: 1px; background: var(--line); }

        .radical-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .radical-chip {
          font-family: 'Noto Serif SC', serif;
          width: 40px; height: 40px;
          border: 1px solid var(--line);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
          background: var(--bg-soft);
        }

        .stroke-box {
          width: 44px; height: 44px;
          border: 1px dashed var(--line);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Noto Serif SC', serif;
          font-size: 20px;
          background: var(--bg-soft);
        }
        .stroke-more { font-size: 12px; color: var(--ink-soft); }

        .example-card {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 16px 18px;
          background: var(--bg-soft);
        }
        .example-card .zh { font-family: 'Noto Serif SC', serif; font-size: 18px; margin-bottom: 4px; }
        .example-card .py { font-size: 13px; color: var(--ink-soft); margin-bottom: 6px; }
        .example-card .vi { font-size: 13.5px; }

        .actions { display: flex; gap: 10px; margin-top: 30px; }
        .btn-primary {
          display: flex; align-items: center; gap: 7px;
          background: var(--seal); color: #fff;
          border: none; border-radius: 9px;
          padding: 10px 16px;
          font-size: 13.5px; font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .btn-ghost {
          display: flex; align-items: center; gap: 7px;
          background: #fff; color: var(--ink);
          border: 1px solid var(--line); border-radius: 9px;
          padding: 10px 16px;
          font-size: 13.5px; font-weight: 500;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .btn-ghost.on { color: var(--seal); border-color: var(--seal); background: var(--seal-soft); }
      `}</style>

      {/* Nav rail */}
      <nav className="rail">
        <div className="rail-mark">汉</div>
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.key}
              className={`rail-btn ${activeNav === n.key ? "active" : ""}`}
              onClick={() => setActiveNav(n.key)}
            >
              <Icon size={18} strokeWidth={1.8} />
              {n.label}
            </button>
          );
        })}
      </nav>

      <div className="main">
        {/* Top bar */}
        <div className="topbar">
          <p className="eyebrow">Zero → HSK 6</p>
          <div className="title-row">
            <h1>从零开始</h1>
            <span>Học tiếng Trung từ Zero</span>
          </div>
          <div className="search-row">
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Tra Hán tự, pinyin hoặc nghĩa..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="chips">
              {[1, 2, 3, 4].map((lv) => (
                <span key={lv} className={`chip ${lv === selected.hsk ? "on" : ""}`}>
                  HSK {lv}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="body">
          <div className="list">
            {filtered.map((w) => (
              <button
                key={w.id}
                className={`list-item ${w.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(w.id)}
              >
                <div className="list-hanzi">{w.hanzi}</div>
                <div className="list-meta">
                  <div className="py">{w.pinyin}</div>
                  <div className="mean">{w.meaningVi}</div>
                </div>
                {learnedMap[w.id] && <div className="dot" title="Đã học" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p style={{ padding: 16, fontSize: 13, color: "var(--ink-soft)" }}>
                Không tìm thấy từ nào.
              </p>
            )}
          </div>

          <div className="detail">
            <div className="hero">
              <div className="hero-left">
                <div className="hero-hanzi">{selected.hanzi}</div>
                <div>
                  <div className="hero-py-row">
                    <ToneCurve tone={selected.tone} active />
                    <span className="hero-py">{selected.pinyin}</span>
                    <div className="hero-audio">
                      <Volume2 size={14} strokeWidth={2} />
                    </div>
                  </div>
                  <div className="hero-meaning">
                    <span className="vi">{selected.meaningVi}</span>
                    {"  ·  "}
                    <span className="en">{selected.meaningEn}</span>
                  </div>
                </div>
              </div>
              <SealBadge level={selected.hsk} />
            </div>

            <div className="section-label">Bộ thủ</div>
            <div className="radical-row">
              {selected.radicals.map((r, i) => (
                <div className="radical-chip" key={i}>
                  {r}
                </div>
              ))}
            </div>

            <div className="section-label">Thứ tự nét · {selected.strokes} nét</div>
            <StrokeStages hanzi={selected.hanzi} strokes={selected.strokes} />

            <div className="section-label">Ví dụ</div>
            <div className="example-card">
              <div className="zh">{selected.example.zh}</div>
              <div className="py">{selected.example.pinyin}</div>
              <div className="vi">{selected.example.vi}</div>
            </div>

            <div className="actions">
              <button className="btn-primary">
                <Plus size={15} /> Thêm vào ôn tập
              </button>
              <button
                className={`btn-ghost ${learnedMap[selected.id] ? "on" : ""}`}
                onClick={() =>
                  setLearnedMap((m) => ({ ...m, [selected.id]: !m[selected.id] }))
                }
              >
                <Bookmark size={15} /> {learnedMap[selected.id] ? "Đã học" : "Đánh dấu đã học"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
