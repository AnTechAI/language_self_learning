/**
 * GamesScreen — "Ôn tập": menu chọn game + 4 game (flashcard, dịch nghĩa,
 * đồng nghĩa, trái nghĩa) + màn tổng kết. Keyboard: Space lật thẻ · 1/2/3
 * flashcard · 1-4 chọn đáp án.
 */
import { useEffect, useState } from 'react';
import { Button, Card, Chip, PosChips } from '../../components/ui';
import { countRevealable, maskText, normalize, todayStr } from '../../lib/format';
import { stableSense } from '../../lib/games';
import type { LessonMeta } from '../../data/lessons';
import { ReviewScreen } from '../zh/ReviewScreen';
import { ToneQuizScreen } from '../zh/ToneQuizScreen';
import { WritingScreen } from '../zh/WritingScreen';
import { useCourseStore } from '../../store/useCourseStore';
import { useLessons } from '../home/useLessons';

export function GamesScreen() {
  const gameScreen = useCourseStore((s) => s.gameScreen);
  const session = useCourseStore((s) => s.session);
  const course = useCourseStore((s) => s.course);
  const zhView = useCourseStore((s) => s.zhView);

  // keyboard shortcuts — dùng getState() để luôn thấy session mới nhất
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useCourseStore.getState();
      const s = st.session;
      if (!s || st.gameScreen === 'menu') return;
      if (s.type === 'flashcard') {
        if (e.key === ' ') {
          e.preventDefault();
          st.flipFlashcard();
          return;
        }
        if (s.seenOnce) {
          if (e.key === '1') st.answerFlashcard(false);
          else if (e.key === '2') st.answerFlashcard(true);
          else if (e.key === '3') st.passFlashcard();
        }
        return;
      }
      if (s.type === 'synonym' || s.type === 'antonym') {
        if (s.current) {
          const i = ['1', '2', '3', '4'].indexOf(e.key);
          if (i >= 0 && i < s.current.options.length) st.answerChoice(s.current.options[i]);
        }
        return;
      }
      // Dịch nghĩa: sau khi trả lời, Enter → câu tiếp theo.
      // Bỏ qua Enter xuất phát từ INPUT (Enter = Kiểm tra) và BUTTON (Enter = click nút).
      if (s.type === 'translate-en' || s.type === 'translate-vi') {
        const t = e.target as HTMLElement;
        if (s.answered && e.key === 'Enter' && t.tagName !== 'INPUT' && t.tagName !== 'BUTTON') {
          e.preventDefault();
          st.advanceTranslate();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Khóa tiếng Trung: các chế độ ngay trong tab Ôn tập
  if (course?.seed === 'zh' && zhView !== 'hub' && !session) {
    const back = () => useCourseStore.getState().setZhView('hub');
    if (zhView === 'writing') return <WritingScreen onBack={back} />;
    if (zhView === 'tone') return <ToneQuizScreen onBack={back} />;
    if (zhView === 'srs') return <ReviewScreen onBack={back} />;
  }

  if (gameScreen === 'menu') return <GameMenu />;
  if (!session) return <GameMenu />;

  if (session.type === 'flashcard') return <FlashcardGame />;
  if (session.type === 'translate-en' || session.type === 'translate-vi') return <TranslateGame />;
  return <ChoiceGame />;
}

/* ================= Menu ================= */

/** Thẻ chế độ tiếng Trung trong tab Ôn tập */
function ZhModeCard({
  ico,
  title,
  desc,
  badge,
  onClick,
}: {
  ico: string;
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <Card>
      <div className="gi">{ico}</div>
      <h3 style={{ margin: '8px 0 4px' }}>{title}</h3>
      <p className="help" style={{ fontSize: 13, margin: 0 }}>
        {desc}
      </p>
      {badge ? <small className="badge">{badge}</small> : null}
      <Button size="sm" onClick={onClick} style={{ marginTop: 10 }}>
        Mở →
      </Button>
    </Card>
  );
}

function GameMenu() {
  const store = useCourseStore();
  const course = store.course;
  const lessons = useLessons();
  const entries = store.entries;
  const synCount = entries.filter((e) => (e.synonyms || []).length > 0).length;
  const antCount = entries.filter((e) => (e.antonyms || []).length > 0).length;
  const dueToday = entries.filter((e) => !e.srs || (e.srs.due ?? '') <= todayStr()).length;
  const writeCount = new Set(entries.flatMap((e) => [...(e.word || '')])).size;

  if (!course) return null;

  const games: {
    id: 'flashcard' | 'translate-en' | 'translate-vi' | 'synonym' | 'antonym';
    ico: string;
    title: string;
    desc: string;
    disabled?: boolean;
    badge?: string;
    full?: boolean;
  }[] = [
    {
      id: 'flashcard',
      ico: '🃏',
      title: 'Flashcard',
      desc: 'Nhìn mặt trước, đoán mặt sau. Tự lật để kiểm tra.',
    },
    {
      id: 'translate-vi',
      ico: '✍️',
      title: 'Dịch nghĩa ' + course.source.label + '–' + course.target.label,
      desc:
        'Xem từ ' +
        course.source.label.toLowerCase() +
        ', gõ nghĩa ' +
        course.target.label.toLowerCase() +
        '. Gợi ý dần từng chữ.',
    },
    ...(course.source.code === 'en'
      ? [
          {
            id: 'translate-en' as const,
            ico: '📖',
            title: 'Dịch nghĩa Anh–Anh',
            desc: 'Xem định nghĩa tiếng Anh, gõ từ vựng tương ứng.',
          },
        ]
      : []),
    {
      id: 'synonym',
      ico: '🔁',
      title: 'Đồng nghĩa',
      desc: 'Chọn từ có nghĩa gần nhất.',
      disabled: synCount < 4,
      badge: synCount > 0 ? `${synCount} từ` : undefined,
    },
    {
      id: 'antonym',
      ico: '↔️',
      title: 'Trái nghĩa',
      desc: 'Chọn từ trái nghĩa.',
      disabled: antCount < 4,
      badge: antCount > 0 ? `${antCount} từ` : undefined,
    },
  ];

  return (
    <>
      <div className="hero">
        <h2>🎮 Ôn tập</h2>
        <p>
          Chọn trò chơi để ghi nhớ từ vựng lâu hơn. Trả lời sai sẽ được xếp lại vào cuối để ôn lại.
        </p>
      </div>

      <Card>
        <h3 style={{ margin: '0 0 8px' }}>Cài đặt phiên ôn tập</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {lessons.length > 0 ? (
            <>
              <select
                className="input"
                style={{ flex: '1 1 200px' }}
                value={store.gameLessonId || ''}
                onChange={(e) => void store.setGameLesson(e.target.value || null)}
              >
                <option value="">📚 Toàn bộ từ vựng</option>
                {lessons.map((l: LessonMeta) => (
                  <option key={l.id} value={l.id}>
                    📘 {l.title}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <select
            className="input"
            style={{ flex: '1 1 150px' }}
            value={String(store.settings.gameQty || 0)}
            onChange={(e) => store.setGameQty(Number(e.target.value))}
          >
            <option value="0">Số từ: Tất cả</option>
            <option value="10">10 từ</option>
            <option value="20">20 từ</option>
            <option value="50">50 từ</option>
          </select>
        </div>
        <small className="help" style={{ display: 'block', marginTop: 8 }}>
          💡 Chọn bài học sẽ chỉ ôn trong phạm vi bài đó (từ chưa có sẽ tự thêm).
        </small>
      </Card>

      {course.seed === 'zh' ? (
        <div className="game-grid" style={{ marginBottom: 4 }}>
          <ZhModeCard
            ico="⭐"
            title="Ôn tập hôm nay"
            desc="Ôn theo lịch SM-2: thẻ nhớ → đánh giá Lại / Khó / Tốt / Dễ."
            badge={`${dueToday} từ đến hạn`}
            onClick={() => void store.setZhView('srs')}
          />
          <ZhModeCard
            ico="✍️"
            title="Luyện viết chữ"
            desc="Xem thứ tự nét của từng chữ rồi vẽ theo — chấm điểm từng nét."
            badge={`${writeCount} chữ có nét`}
            onClick={() => void store.setZhView('writing')}
          />
          <ZhModeCard
            ico="🎵"
            title="Nghe & thanh điệu"
            desc="Nghe phát âm → chọn đúng thanh điệu của từng chữ."
            badge="TTS tiếng Trung"
            onClick={() => void store.setZhView('tone')}
          />
        </div>
      ) : null}

      <div className="game-grid">
        {games.map((g) => (
          <Card key={g.id} className={g.disabled ? 'disabled' : ''}>
            <div className="gi">{g.ico}</div>
            <h3 style={{ margin: '8px 0 4px' }}>{g.title}</h3>
            <p className="help" style={{ fontSize: 13, margin: 0 }}>
              {g.desc}
            </p>
            {g.badge && !g.disabled ? <small className="badge">{g.badge}</small> : null}
            {g.disabled ? (
              <small className="help">Cần ít nhất 4 từ có dữ liệu {g.title.toLowerCase()}</small>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <Button
                disabled={g.disabled}
                style={{ width: '100%' }}
                onClick={() => store.startGame(g.id)}
              >
                Chơi →
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/* ================= Header chung ================= */

function GameHeader({ title, ico }: { title: string; ico: string }) {
  const store = useCourseStore();
  const session = useCourseStore((s) => s.session);
  const streak = session?.streakNow || 0;
  const pct = session ? Math.min(100, Math.round((session.idx / session.queue.length) * 100)) : 0;
  return (
    <div className="game-top">
      <Button variant="ghost" size="sm" onClick={() => store.exitGame()}>
        ← Thoát
      </Button>
      <span className="game-title">
        {ico} {title}
      </span>
      {streak > 1 ? <span className="streak-chip">🔥 {streak}</span> : null}
      <div className="game-progress">
        <div className="progress-track" style={{ flex: 1 }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <small className="help">
          {session ? `${session.idx}/${session.queue.length}` : ''} · Đúng {session?.correct || 0}
        </small>
      </div>
    </div>
  );
}

/* ================= Flashcard ================= */

function FlashcardGame() {
  const store = useCourseStore();
  const session = useCourseStore((s) => s.session);
  const course = useCourseStore((s) => s.course);
  if (!session || !course) return null;
  if (session.idx >= session.queue.length) return <Summary />;

  const entry = session.queue[session.idx];
  const s0 = stableSense(entry, session);
  const m = s0?.meaning || {};

  return (
    <>
      <GameHeader title="Flashcard" ico="🃏" />
      <div
        className={`flashcard ${session.revealed ? 'flipped' : ''}`}
        onClick={() => store.flipFlashcard()}
        role="button"
        tabIndex={0}
      >
        <div className="fc-inner">
          <div className="fc-face fc-front">
            <div className="fc-word">{entry.word}</div>
            {s0?.pronunciation ? <div className="ipa">{s0.pronunciation}</div> : null}
            <div style={{ marginTop: 6 }}>
              <PosChips entry={entry} />
            </div>
          </div>
          <div className="fc-face fc-back">
            <div className="fc-word" style={{ fontSize: 20 }}>
              {m[course.target.code] || ''}
            </div>
            {m[course.source.code] ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}>
                {m[course.source.code]}
              </div>
            ) : null}
            {s0?.examples?.[0] ? (
              <div
                style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 12.5, marginTop: 8 }}
              >
                ❝ {s0.examples[0]}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <p className="help" style={{ textAlign: 'center', margin: '10px 0 0' }}>
        👆 Bấm thẻ (hoặc phím <b>Space</b>) để lật
      </p>
      {session.seenOnce ? (
        <div className="row" style={{ marginTop: 14 }}>
          <Button
            variant="danger"
            style={{ flex: 1 }}
            onClick={() => store.answerFlashcard(false)}
            title="Phím 1"
          >
            ✗ Chưa nhớ
          </Button>
          <Button
            variant="soft"
            style={{ flex: 1 }}
            onClick={() => store.passFlashcard()}
            title="Phím 3"
          >
            ⏭ Bỏ qua
          </Button>
          <Button style={{ flex: 1 }} onClick={() => store.answerFlashcard(true)} title="Phím 2">
            ✓ Đã nhớ
          </Button>
        </div>
      ) : null}
    </>
  );
}

/* ================= Dịch nghĩa (2 game: nguồn→Anh / nguồn→Việt) ================= */

function TranslateGame() {
  const store = useCourseStore();
  const session = useCourseStore((s) => s.session);
  const course = useCourseStore((s) => s.course);
  const [answer, setAnswer] = useState('');

  if (!session || !course) return null;
  if (session.idx >= session.queue.length) return <Summary />;

  const entry = session.queue[session.idx];
  const isEn = session.type === 'translate-en';
  const s0 = stableSense(entry, session);
  const m = s0?.meaning || {};
  /* translate-en: HIỆN định nghĩa tiếng Anh → gõ TỪ VỰNG.
     translate-vi: HIỆN từ (+IPA) → gõ nghĩa tiếng Việt. */
  const target = isEn ? entry.word : m[course.target.code] || '';
  const prompt = isEn
    ? m['en'] || ''
    : `${entry.word}${s0?.pronunciation ? ' · ' + s0.pronunciation : ''}`;

  const totalChars = countRevealable(target);
  const allRevealed = (session.hints || 0) >= totalChars;
  const masked = allRevealed ? target : maskText(target, session.hints || 0);

  const submit = () => {
    if (!answer.trim()) return;
    store.answerTranslate(answer.trim());
    setAnswer('');
  };
  const next = () => {
    store.advanceTranslate();
    setAnswer('');
  };

  return (
    <>
      <GameHeader
        title={
          isEn
            ? 'Dịch nghĩa Anh–Anh'
            : 'Dịch nghĩa ' + course.source.label + '–' + course.target.label
        }
        ico={isEn ? '📖' : '✍️'}
      />
      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <small className="badge">
            {isEn
              ? 'Định nghĩa ' + course.source.label.toLowerCase() + ' → Từ'
              : course.source.label + ' → ' + course.target.label}
          </small>
        </div>
        <div
          style={{
            textAlign: 'center',
            fontSize: isEn ? 17 : 20,
            fontWeight: isEn ? 500 : 700,
            fontStyle: isEn ? 'italic' : 'normal',
            lineHeight: 1.5,
            margin: '10px 0',
          }}
        >
          {prompt}
        </div>
        <PosChips entry={entry} />
        <div style={{ textAlign: 'center', margin: '16px 0 4px' }}>
          <span className="masked">{masked}</span>
          {!allRevealed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => store.hintTranslate()}
              style={{ marginLeft: 8 }}
            >
              💡 Gợi ý
            </Button>
          ) : null}
        </div>
        {allRevealed ? (
          <div className="feedback good" style={{ marginTop: 8 }}>
            💡 Đã hiện hết đáp án!
          </div>
        ) : null}
        {isEn && !session.answered ? (
          <small className="help" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
            Đọc định nghĩa rồi gõ từ phù hợp — nhấn <b>Enter</b> kiểm tra.
          </small>
        ) : null}

        {!session.answered ? (
          <div className="row" style={{ marginTop: 14 }}>
            <input
              autoFocus
              className="input-answer"
              placeholder={
                isEn ? 'Gõ từ tiếng Anh…' : 'Gõ nghĩa ' + course.target.label.toLowerCase() + '…'
              }
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
            <Button onClick={submit}>Kiểm tra</Button>
          </div>
        ) : (
          <ResultCard
            word={session.lastAnswer?.word || entry.word}
            correctWord={session.lastAnswer?.correctWord || target}
            last={session.lastAnswer}
            onNext={next}
          />
        )}
      </Card>
    </>
  );
}

/* ================= Đồng nghĩa / Trái nghĩa ================= */

function ChoiceGame() {
  const store = useCourseStore();
  const session = useCourseStore((s) => s.session);
  const course = useCourseStore((s) => s.course);
  if (!session || !course) return null;
  if (session.idx >= session.queue.length) return <Summary />;
  const cur = session.current;
  if (!cur) return <Summary />;

  const title = session.type === 'synonym' ? 'Đồng nghĩa' : 'Trái nghĩa';
  const ico = session.type === 'synonym' ? '🔁' : '↔️';

  return (
    <>
      <GameHeader title={title} ico={ico} />
      <Card>
        <div style={{ textAlign: 'center' }}>
          <div className="big-word">{cur.entry.word}</div>
          <PosChips entry={cur.entry} />
          <p className="help" style={{ marginTop: 8 }}>
            {title === 'Đồng nghĩa'
              ? 'Chọn từ có nghĩa gần nhất với từ trên'
              : 'Chọn từ trái nghĩa với từ trên'}
          </p>
        </div>
        <div className="options">
          {cur.options.map((o, i) => {
            const isRight = session.answered && normalize(o) === normalize(cur.correctWord);
            const isWrong =
              session.answered &&
              !isRight &&
              normalize(o) === normalize(session.lastAnswer?.chosen || '');
            return (
              <button
                key={o}
                className={'option' + (isRight ? ' right' : '') + (isWrong ? ' wrong' : '')}
                disabled={session.answered}
                onClick={() => store.answerChoice(o)}
              >
                <span className="opt-key">{i + 1}</span> {o}
                {isRight ? <span className="opt-check">✓</span> : null}
                {isWrong ? <span className="opt-check">✗</span> : null}
              </button>
            );
          })}
        </div>
        {session.answered ? (
          <ResultCard
            word={cur.entry.word}
            correctWord={cur.correctWord}
            last={session.lastAnswer}
            onNext={() => store.nextChoice()}
          />
        ) : null}
      </Card>
    </>
  );
}

/* ================= Kết quả 1 câu ================= */

function ResultCard({
  word,
  correctWord,
  last,
  onNext,
}: {
  word: string;
  correctWord: string;
  last?: { chosen: string; correctWord: string; isCorrect: boolean };
  onNext: () => void;
}) {
  const correct = last?.isCorrect;
  return (
    <div style={{ marginTop: 16 }}>
      <div className={`feedback ${correct ? 'good' : 'bad'}`}>
        {correct ? '✅ Chính xác!' : '❌ Sai rồi!'}
        {!correct && last ? (
          <div style={{ marginTop: 6 }}>
            Đáp án: <b>{correctWord}</b> {correctWord !== word ? `(“${word}”)` : ''}
          </div>
        ) : null}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <Button variant="ghost" style={{ flex: 1 }} onClick={() => onNext()}>
          ⏭ Bỏ qua
        </Button>
        <Button style={{ flex: 2 }} onClick={() => onNext()}>
          Câu tiếp →
        </Button>
      </div>
    </div>
  );
}

/* ================= Tổng kết ================= */

function Summary() {
  const store = useCourseStore();
  const session = useCourseStore((s) => s.session);
  const course = useCourseStore((s) => s.course);
  if (!session || !course) return null;

  const total = session.queue.length;
  const correct = session.correct;
  const wrong = total - correct;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const missed = session.missed || [];

  return (
    <Card>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52 }}>{pct === 100 ? '🏆' : pct >= 60 ? '🎉' : '💪'}</div>
        <h2 style={{ margin: '6px 0' }}>
          {pct === 100 ? 'Hoàn hảo!' : pct >= 60 ? 'Tuyệt vời!' : 'Cố gắng thêm nhé!'}
        </h2>
        <p className="help">Phiên ôn tập kết thúc — kết quả đã lưu vào thống kê.</p>
        <div className="stats">
          <span className="stat">📋 {total} từ</span>
          <span className="stat">✅ {correct} đúng</span>
          <span className="stat">❌ {wrong} sai</span>
          <span className="stat">🎯 {pct}%</span>
        </div>
      </div>

      {missed.length ? (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15 }}>Ôn lại từ sai ({missed.length})</h3>
          <div className="chip-row" style={{ marginTop: 6 }}>
            {missed.map((id) => (
              <Chip key={id} onClick={() => store.openDetail(id)}>
                {store.entries.find((e) => e.id === id)?.word}
              </Chip>
            ))}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <Button variant="soft" style={{ flex: 1 }} onClick={() => store.replayGame()}>
              🔄 Chơi lại tất cả
            </Button>
            <Button style={{ flex: 2 }} onClick={() => store.startGame(session.type, missed)}>
              ✏️ Ôn lại từ sai
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <Button style={{ width: '100%' }} onClick={() => store.replayGame()}>
            🔄 Chơi lại
          </Button>
        </div>
      )}
      <Button
        variant="ghost"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => store.exitGame()}
      >
        ← Về menu ôn tập
      </Button>
    </Card>
  );
}
