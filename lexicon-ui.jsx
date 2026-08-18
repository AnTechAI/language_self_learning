import React, { useState, useMemo } from "react";
import { BookOpen, Library, RotateCcw, BarChart3, Search, Volume2, ChevronRight, Check, X, Shuffle, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";

const INK = "#1E2A44";
const PAPER = "#FFFFFF";
const PAPER_ALT = "#EFEFEF";
const TEAL = "#256B67";
const TEAL_DARK = "#153F3D";
const AMBER = "#C98A2E";
const GREEN = "#4C7A4F";
const RED = "#B14A3C";
const LINE = "#D6CEB8";

const LESSONS = [
  { id: 1, title: "Đời sống hằng ngày", total: 20, learned: 6, color: TEAL },
  { id: 2, title: "Công việc & Sự nghiệp", total: 20, learned: 0, color: AMBER },
  { id: 3, title: "Du lịch", total: 20, learned: 0, color: "#7A6B9E" },
  { id: 4, title: "Sức khỏe", total: 20, learned: 0, color: RED },
  { id: 5, title: "Công nghệ", total: 20, learned: 0, color: "#3E7CA6" },
];

const WORDS = [
  { word: "abundant", ipa: "/əˈbʌndənt/", pos: "adj", lesson: 1, defEN: "existing in large quantities; more than enough", defVN: "dồi dào, phong phú", example: "The region has abundant natural resources.", syn: ["plentiful", "ample"], ant: ["scarce", "insufficient"] },
  { word: "diligent", ipa: "/ˈdɪlɪdʒənt/", pos: "adj", lesson: 1, defEN: "showing care and effort in one's work or duties", defVN: "chăm chỉ, cần cù", example: "She is a diligent student who never misses homework.", syn: ["hardworking", "industrious"], ant: ["lazy", "idle"] },
  { word: "reluctant", ipa: "/rɪˈlʌktənt/", pos: "adj", lesson: 1, defEN: "unwilling and hesitant", defVN: "miễn cưỡng, do dự", example: "He was reluctant to accept the offer.", syn: ["hesitant", "unwilling"], ant: ["eager", "willing"] },
  { word: "commute", ipa: "/kəˈmjuːt/", pos: "v", lesson: 1, defEN: "to travel regularly between home and workplace", defVN: "đi làm/đi học hằng ngày", example: "I commute to work by bus every day.", syn: ["travel", "journey"], ant: ["stay", "remain"] },
  { word: "budget", ipa: "/ˈbʌdʒɪt/", pos: "n", lesson: 1, defEN: "an estimate of income and expenditure for a set period", defVN: "ngân sách", example: "We need to stick to our monthly budget.", syn: ["allowance", "funds"], ant: ["surplus", "excess"] },
  { word: "postpone", ipa: "/pəˈspoʊn/", pos: "v", lesson: 1, defEN: "to delay an event to a later time", defVN: "hoãn lại, trì hoãn", example: "The meeting was postponed until next week.", syn: ["delay", "defer"], ant: ["proceed", "advance"] },
];

const WEEK_STATS = [
  { day: "T2", words: 8 }, { day: "T3", words: 14 }, { day: "T4", words: 5 },
  { day: "T5", words: 20 }, { day: "T6", words: 12 }, { day: "T7", words: 3 }, { day: "CN", words: 16 },
];

const REVIEW_MODES = [
  { id: "flashcard", label: "Flashcard" },
  { id: "en-en", label: "Dịch Anh - Anh" },
  { id: "vn-en", label: "Dịch Việt - Anh" },
  { id: "syn", label: "Đồng nghĩa" },
  { id: "ant", label: "Trái nghĩa" },
];

function Tag({ children, tone = "teal" }) {
  const map = {
    teal: { bg: "#DDEBE9", fg: TEAL_DARK },
    amber: { bg: "#F3E2C4", fg: "#7A4E13" },
    line: { bg: PAPER_ALT, fg: INK },
  };
  const c = map[tone];
  return (
    <span style={{ background: c.bg, color: c.fg, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.04em", padding: "3px 8px", borderRadius: 3, textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

function WordDetail({ w, onClose }) {
  if (!w) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,42,68,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, width: 460, maxWidth: "90vw", padding: "28px 30px", boxShadow: "0 12px 30px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 600, color: INK }}>{w.word}</span>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: TEAL_DARK }}><Volume2 size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: TEAL_DARK }}>{w.ipa}</span>
          <Tag>{w.pos}</Tag>
        </div>
        <Field label="Anh - Anh">{w.defEN}</Field>
        <Field label="Anh - Việt">{w.defVN}</Field>
        <Field label="Ví dụ"><em>"{w.example}"</em></Field>
        <div style={{ display: "flex", gap: 24, marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A836A", marginBottom: 6 }}>Đồng nghĩa</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{w.syn.map(s => <Tag key={s} tone="teal">{s}</Tag>)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A836A", marginBottom: 6 }}>Trái nghĩa</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{w.ant.map(s => <Tag key={s} tone="amber">{s}</Tag>)}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop: 22, width: "100%", background: INK, color: PAPER, border: "none", borderRadius: 6, padding: "10px 0", fontSize: 14, cursor: "pointer" }}>Đóng</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A836A", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14.5, color: INK, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function LessonListCard({ lesson, onStart }) {
  const pct = Math.round((lesson.learned / lesson.total) * 100);
  const locked = lesson.id !== 1;
  const started = lesson.learned > 0;
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, background: "#FFFFFF", padding: "18px 20px", display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${lesson.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: lesson.color }}>
        {pct}%
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: "#8A836A", letterSpacing: "0.06em", textTransform: "uppercase" }}>Bài {lesson.id}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: INK, margin: "2px 0 8px" }}>{lesson.title}</div>
        <div style={{ height: 5, borderRadius: 3, background: PAPER_ALT, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: lesson.color }} />
        </div>
        <div style={{ fontSize: 12, color: "#8A836A", marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" }}>{lesson.learned}/{lesson.total} từ</div>
      </div>
      <button onClick={() => !locked && onStart(lesson.id)} disabled={locked} style={{
        padding: "9px 16px", borderRadius: 6, fontSize: 13.5, cursor: locked ? "default" : "pointer",
        border: `1px solid ${locked ? LINE : lesson.color}`,
        background: locked ? "transparent" : lesson.color,
        color: locked ? "#B3AB90" : "#FFFFFF",
        display: "flex", alignItems: "center", gap: 6, flexShrink: 0
      }}>
        {locked ? <Lock size={13} /> : null}
        {locked ? "Khóa" : started ? "Tiếp tục" : "Học bài"}
      </button>
    </div>
  );
}

function StudyWord({ w, current, total, onNext }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: "#8A836A", fontFamily: "'IBM Plex Mono', monospace" }}>Từ {current}/{total}</div>
        <div style={{ height: 5, width: 140, borderRadius: 3, background: PAPER_ALT, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(current / total) * 100}%`, background: TEAL }} />
        </div>
      </div>

      <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, background: "#FFFFFF", padding: "32px 34px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 600, color: INK }}>{w.word}</span>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: TEAL_DARK }}><Volume2 size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: TEAL_DARK }}>{w.ipa}</span>
          <Tag>{w.pos}</Tag>
        </div>
        <Field label="Anh - Anh">{w.defEN}</Field>
        <Field label="Anh - Việt">{w.defVN}</Field>
        <Field label="Ví dụ"><em>"{w.example}"</em></Field>
        <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A836A", marginBottom: 6 }}>Đồng nghĩa</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{w.syn.map(s => <Tag key={s} tone="teal">{s}</Tag>)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A836A", marginBottom: 6 }}>Trái nghĩa</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{w.ant.map(s => <Tag key={s} tone="amber">{s}</Tag>)}</div>
          </div>
        </div>
      </div>

      <button onClick={onNext} style={{ marginTop: 18, width: "100%", padding: "12px 0", borderRadius: 6, background: INK, color: PAPER, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14.5 }}>
        {current === total ? "Hoàn thành bài học" : "Từ tiếp theo"} <ChevronRight size={16} />
      </button>
    </div>
  );
}

function LessonDone({ lesson, onNewLesson, onRestart, onReview }) {
  return (
    <div style={{ maxWidth: 420, margin: "40px auto 0", textAlign: "center" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK, marginBottom: 8 }}>Hoàn thành bài {lesson.id}!</div>
      <div style={{ fontSize: 14, color: "#5A5540", marginBottom: 28 }}>Bạn đã học {lesson.total} từ trong "{lesson.title}".</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={onNewLesson} style={{ padding: "12px 0", borderRadius: 6, border: "none", background: TEAL, color: "#FFFFFF", cursor: "pointer", fontSize: 14.5 }}>Bài mới</button>
        <button onClick={onRestart} style={{ padding: "12px 0", borderRadius: 6, border: `1px solid ${LINE}`, background: "transparent", color: INK, cursor: "pointer", fontSize: 14.5 }}>Học lại</button>
        <button onClick={onReview} style={{ padding: "12px 0", borderRadius: 6, border: `1px solid ${LINE}`, background: "transparent", color: INK, cursor: "pointer", fontSize: 14.5 }}>Ôn tập</button>
      </div>
    </div>
  );
}

function LessonPage({ onGoToReview }) {
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);
  const [wordIdx, setWordIdx] = useState(0);

  const lesson = LESSONS.find(l => l.id === activeId);
  const words = lesson ? WORDS.filter(w => w.lesson === lesson.id) : [];

  const start = (id) => { setActiveId(id); setWordIdx(0); setView("study"); };
  const restart = () => { setWordIdx(0); setView("study"); };
  const nextWord = () => {
    if (wordIdx + 1 >= words.length) setView("done");
    else setWordIdx(i => i + 1);
  };
  const backToList = () => { setView("list"); setActiveId(null); };

  if (view === "list") {
    return (
      <div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, margin: "0 0 18px", color: INK }}>Bài học</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {LESSONS.map(l => <LessonListCard key={l.id} lesson={l} onStart={start} />)}
        </div>
      </div>
    );
  }

  if (view === "study") {
    return (
      <div>
        <button onClick={backToList} style={{ background: "none", border: "none", cursor: "pointer", color: "#8A836A", fontSize: 13, marginBottom: 16, padding: 0 }}>← Danh sách bài học</button>
        <StudyWord w={words[wordIdx]} current={wordIdx + 1} total={words.length} onNext={nextWord} />
      </div>
    );
  }

  return (
    <LessonDone
      lesson={lesson}
      onRestart={restart}
      onNewLesson={backToList}
      onReview={onGoToReview}
    />
  );
}

function VocabPage({ onOpen }) {
  const [q, setQ] = useState("");
  const [lessonFilter, setLessonFilter] = useState("all");
  const filtered = useMemo(() => WORDS.filter(w =>
    (lessonFilter === "all" || w.lesson === Number(lessonFilter)) &&
    (w.word.toLowerCase().includes(q.toLowerCase()) || w.defVN.includes(q))
  ), [q, lessonFilter]);

  return (
    <div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, margin: "0 0 18px", color: INK }}>Từ vựng</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 12px" }}>
          <Search size={15} color="#8A836A" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm từ hoặc nghĩa..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, flex: 1, color: INK }} />
        </div>
        <select value={lessonFilter} onChange={e => setLessonFilter(e.target.value)} style={{ border: `1px solid ${LINE}`, borderRadius: 6, background: "#FFFFFF", padding: "8px 12px", fontSize: 13.5, color: INK }}>
          <option value="all">Tất cả bài học</option>
          {LESSONS.map(l => <option key={l.id} value={l.id}>Bài {l.id}: {l.title}</option>)}
        </select>
      </div>

      <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr 0.6fr", background: PAPER_ALT, padding: "10px 16px", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6C6650" }}>
          <span>Từ</span><span>Loại từ</span><span>Nghĩa</span><span>Bài</span>
        </div>
        {filtered.map((w, i) => (
          <div key={w.word} onClick={() => onOpen(w)} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr 0.6fr", padding: "12px 16px", cursor: "pointer", background: i % 2 ? PAPER_ALT : "transparent", borderTop: `1px solid ${LINE}`, alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15.5, color: INK }}>{w.word}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: TEAL_DARK }}>{w.ipa}</div>
            </div>
            <span style={{ fontSize: 13 }}><Tag>{w.pos}</Tag></span>
            <span style={{ fontSize: 13.5, color: "#5A5540" }}>{w.defVN}</span>
            <span style={{ fontSize: 12.5, color: "#8A836A" }}>#{w.lesson}</span>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#8A836A", fontSize: 13.5 }}>Không tìm thấy từ phù hợp.</div>}
      </div>
    </div>
  );
}

function ReviewPage() {
  const [mode, setMode] = useState("flashcard");
  const [answerType, setAnswerType] = useState("choice");
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState("");
  const [typedResult, setTypedResult] = useState(null);
  const w = WORDS[idx % WORDS.length];
  const isTranslationMode = mode === "en-en" || mode === "vn-en";

  const next = () => { setIdx(i => i + 1); setFlipped(false); setPicked(null); setTyped(""); setTypedError(""); setTypedResult(null); };

  const submitTyped = () => {
    if (!typed.trim()) { setTypedError("Nhập câu trả lời trước đã"); return; }
    setTypedError("");
    const correct = typed.trim().toLowerCase() === w.word.toLowerCase();
    setTypedResult(correct ? "correct" : "wrong");
  };

  const options = useMemo(() => {
    if (mode === "syn") {
      const correct = w.syn[0];
      const wrong = WORDS.filter(x => x.word !== w.word).slice(0, 3).map(x => x.word);
      return [correct, ...wrong].sort(() => 0.5 - Math.random());
    }
    if (mode === "ant") {
      const correct = w.ant[0];
      const wrong = WORDS.filter(x => x.word !== w.word).slice(0, 3).map(x => x.word);
      return [correct, ...wrong].sort(() => 0.5 - Math.random());
    }
    if (mode === "en-en" || mode === "vn-en") {
      const wrong = WORDS.filter(x => x.word !== w.word).slice(0, 3).map(x => x.word);
      return [w.word, ...wrong].sort(() => 0.5 - Math.random());
    }
    return [];
  }, [mode, idx]);

  return (
    <div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, margin: "0 0 18px", color: INK }}>Ôn tập</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 26, flexWrap: "wrap" }}>
        {REVIEW_MODES.map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setFlipped(false); setPicked(null); setTyped(""); setTypedError(""); setTypedResult(null); }} style={{
            padding: "8px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13,
            border: `1px solid ${mode === m.id ? TEAL : LINE}`,
            background: mode === m.id ? TEAL : "#FFFFFF", color: mode === m.id ? "#FFFFFF" : INK
          }}>{m.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {mode === "flashcard" && (
          <div>
            <div onClick={() => setFlipped(f => !f)} style={{ cursor: "pointer", border: `1px solid ${LINE}`, borderRadius: 10, background: "#FFFFFF", minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center" }}>
              {!flipped ? (
                <>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 600, color: INK }}>{w.word}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: TEAL_DARK, marginTop: 8 }}>{w.ipa}</div>
                  <div style={{ fontSize: 12, color: "#8A836A", marginTop: 18 }}>Nhấn để xem nghĩa</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 15, color: INK, marginBottom: 8 }}>{w.defVN}</div>
                  <div style={{ fontSize: 13, color: "#5A5540", marginBottom: 10 }}>{w.defEN}</div>
                  <div style={{ fontSize: 13, fontStyle: "italic", color: "#8A836A" }}>"{w.example}"</div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={next} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: `1px solid ${RED}`, background: "#F6E4DF", color: "#7A2E1F", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><X size={15}/> Chưa nhớ</button>
              <button onClick={next} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: `1px solid ${GREEN}`, background: "#E1EBE1", color: "#2F4E32", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Check size={15}/> Đã nhớ</button>
            </div>
          </div>
        )}

        {(mode === "en-en" || mode === "vn-en" || mode === "syn" || mode === "ant") && (
          <div>
            {isTranslationMode && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[{ id: "choice", label: "Trắc nghiệm" }, { id: "typed", label: "Điền từ" }].map(t => (
                  <button key={t.id} onClick={() => { setAnswerType(t.id); setPicked(null); setTyped(""); setTypedError(""); setTypedResult(null); }} style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 12.5, cursor: "pointer",
                    border: `1px solid ${answerType === t.id ? INK : LINE}`,
                    background: answerType === t.id ? INK : "transparent",
                    color: answerType === t.id ? PAPER : "#7A7461"
                  }}>{t.label}</button>
                ))}
              </div>
            )}

            <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, background: "#FFFFFF", padding: 26, marginBottom: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A836A", marginBottom: 10 }}>
                {mode === "en-en" && "Định nghĩa tiếng Anh"}
                {mode === "vn-en" && "Nghĩa tiếng Việt"}
                {mode === "syn" && "Chọn từ đồng nghĩa với"}
                {mode === "ant" && "Chọn từ trái nghĩa với"}
              </div>
              <div style={{ fontSize: 16, color: INK, lineHeight: 1.5 }}>
                {mode === "en-en" && w.defEN}
                {mode === "vn-en" && w.defVN}
                {(mode === "syn" || mode === "ant") && <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600 }}>{w.word}</span>}
              </div>
            </div>

            {isTranslationMode && answerType === "typed" ? (
              <div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    value={typed}
                    disabled={typedResult !== null}
                    onChange={e => { setTyped(e.target.value); if (typedError) setTypedError(""); }}
                    onKeyDown={e => { if (e.key === "Enter" && typedResult === null) submitTyped(); }}
                    placeholder="Nhập từ tiếng Anh..."
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: `1px solid ${typedResult === "wrong" ? RED : typedResult === "correct" ? GREEN : LINE}`, background: "#FFFFFF", fontSize: 14.5, color: INK, outline: "none" }}
                  />
                  {typedResult === null && (
                    <button onClick={submitTyped} style={{ padding: "10px 18px", borderRadius: 6, border: "none", background: TEAL, color: "#FFFFFF", cursor: "pointer", fontSize: 14 }}>Kiểm tra</button>
                  )}
                </div>
                {typedError && <div style={{ color: RED, fontSize: 12.5, marginTop: 6 }}>{typedError}</div>}
                {typedResult && (
                  <div style={{ marginTop: 10, fontSize: 13.5, color: typedResult === "correct" ? "#2F4E32" : "#7A2E1F" }}>
                    {typedResult === "correct" ? "Chính xác!" : `Chưa đúng. Đáp án: ${w.word}`}
                  </div>
                )}
                {typedResult !== null && (
                  <button onClick={next} style={{ marginTop: 16, width: "100%", padding: "10px 0", borderRadius: 6, background: INK, color: PAPER, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>Câu tiếp theo <ChevronRight size={15} /></button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {options.map(opt => {
                    const isCorrect = mode === "syn" ? opt === w.syn[0] : mode === "ant" ? opt === w.ant[0] : opt === w.word;
                    const show = picked !== null;
                    let bg = "#FFFFFF", border = LINE, color = INK;
                    if (show && opt === picked) { bg = isCorrect ? "#E1EBE1" : "#F6E4DF"; border = isCorrect ? GREEN : RED; color = isCorrect ? "#2F4E32" : "#7A2E1F"; }
                    else if (show && isCorrect) { bg = "#E1EBE1"; border = GREEN; color = "#2F4E32"; }
                    return (
                      <button key={opt} disabled={show} onClick={() => setPicked(opt)} style={{ padding: "12px 10px", borderRadius: 6, border: `1px solid ${border}`, background: bg, color, cursor: show ? "default" : "pointer", fontSize: 14 }}>{opt}</button>
                    );
                  })}
                </div>
                {picked !== null && (
                  <button onClick={next} style={{ marginTop: 16, width: "100%", padding: "10px 0", borderRadius: 6, background: INK, color: PAPER, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>Câu tiếp theo <ChevronRight size={15} /></button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A836A" }}>{label}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 30, color: INK, margin: "6px 0 2px" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: TEAL_DARK }}>{sub}</div>}
    </div>
  );
}

function StatsPage() {
  return (
    <div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, margin: "0 0 18px", color: INK }}>Thống kê</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Tổng từ đã học" value="86" sub="/ 100 từ" />
        <StatCard label="Bài học hoàn thành" value="0" sub="/ 5 bài" />
        <StatCard label="Từ học hôm nay" value="16" />
        <StatCard label="Độ chính xác ôn tập" value="78%" sub="7 ngày qua" />
      </div>

      <div style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 8, padding: "18px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "#5A5540", marginBottom: 12 }}>Từ đã học theo ngày</div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WEEK_STATS} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#8A836A" }} axisLine={{ stroke: LINE }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#8A836A" }} axisLine={false} tickLine={false} />
              <Bar dataKey="words" fill={TEAL} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 8, padding: "18px 20px" }}>
        <div style={{ fontSize: 13, color: "#5A5540", marginBottom: 14 }}>Tiến độ theo bài học</div>
        {LESSONS.map(l => (
          <div key={l.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: INK }}>Bài {l.id}: {l.title}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8A836A" }}>{l.learned}/{l.total}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: PAPER_ALT, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(l.learned / l.total) * 100}%`, background: l.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const NAV = [
  { id: "lesson", label: "Bài học", icon: BookOpen },
  { id: "vocab", label: "Từ vựng", icon: Library },
  { id: "review", label: "Ôn tập", icon: RotateCcw },
  { id: "stats", label: "Thống kê", icon: BarChart3 },
];

export default function App() {
  const [page, setPage] = useState("lesson");
  const [openWord, setOpenWord] = useState(null);

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif", background: PAPER, minHeight: "100vh", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Work+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');
      `}</style>

      <div style={{ width: 210, borderRight: `1px solid ${LINE}`, padding: "28px 0", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ padding: "0 22px 24px", fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: INK }}>Lexicon</div>
        {NAV.map(n => {
          const Icon = n.icon;
          const active = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "11px 22px", cursor: "pointer",
              border: "none", background: active ? PAPER_ALT : "transparent",
              borderLeft: `3px solid ${active ? TEAL : "transparent"}`,
              color: active ? INK : "#7A7461", fontSize: 14, textAlign: "left"
            }}>
              <Icon size={17} />
              {n.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, padding: "32px 40px", maxWidth: 960 }}>
        {page === "lesson" && <LessonPage onGoToReview={() => setPage("review")} />}
        {page === "vocab" && <VocabPage onOpen={setOpenWord} />}
        {page === "review" && <ReviewPage />}
        {page === "stats" && <StatsPage />}
      </div>

      <WordDetail w={openWord} onClose={() => setOpenWord(null)} />
    </div>
  );
}
