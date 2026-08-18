/**
 * LessonStudyScreen — "Học bài này": PAGE tua từng từ của bài (theo
 * lexicon-ui.jsx StudyView). Word card: Fraunces 36px + volume, IPA mono +
 * chip từ loại, 3 field (Anh-Anh / Anh-Việt / Ví dụ) có highlight, đ/trái
 * nghĩa tags, nút full-width tối. Hoàn tất → LessonDone (Bài mới/Học lại/Ôn tập).
 */
import { Field, HighlightEn, PosChip } from '../../components/ui';
import { speak } from '../../lib/tts';
import { lessonById } from '../../data/lessons';
import { useLessons } from '../home/useLessons';
import { useCourseStore } from '../../store/useCourseStore';

function lessonNum(id: string): number {
  const m = String(id || '').match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

export function LessonStudyScreen() {
  const store = useCourseStore();
  const course = store.course;
  const study = store.study;
  const lessons = useLessons();

  if (!study || !course) return null;
  const { lessonId, words, idx, done } = study;
  const meta = lessonById(lessonId);
  const total = words.length;
  const entry = words[Math.min(idx, total - 1)];

  /* ---- Học tiếp → qua bài kế tiếp (hoặc báo hết) ---- */
  const goNextLesson = async () => {
    const li = lessons.findIndex((m) => m.id === lessonId);
    const next = lessons[li + 1];
    if (next) {
      await store.startLessonStudy(next.id);
    } else {
      store.showToast('🎉 Bạn đã học hết các bài học!');
      store.closeStudy();
    }
  };

  /* ---- Học lại chính bài này ---- */
  const restart = () => void store.startLessonStudy(lessonId);

  /* ---- Ôn tập → mở games của bài này ---- */
  const goReview = () => {
    store.setGameLesson(lessonId);
    store.closeStudy();
    store.setTab('games');
  };

  const exit = () => {
    if (!done && idx < total - 1)
      store.showToast('Bạn đã dừng giữa chừng — từ của bài vẫn trong kho');
    store.closeStudy();
  };

  const last = idx >= total - 1;
  const pct = total > 1 ? Math.round((Math.min(idx + 1, total) / total) * 100) : 0;

  /* ================= MÀN HOÀN TẤT (LessonDone) ================= */
  if (done) {
    return (
      <div className="study-page">
        <header className="study-head">
          <button className="modal-x" onClick={() => store.closeStudy()} aria-label="Đóng">
            ✕
          </button>
          <span className="sw-title">{meta?.title || 'Bài học'}</span>
        </header>
        <div className="ld-wrap">
          <div className="ld-badge">🎉</div>
          <h3 className="ld-title">Hoàn thành bài {lessonNum(lessonId)}!</h3>
          <p className="ld-sub">
            Bạn đã học {total} từ trong "{meta?.title}". Từ của bài đã được thêm vào kho từ vựng.
          </p>
          <div className="study-actions">
            <button className="ld-btn primary" onClick={() => void goNextLesson()}>
              Bài mới →
            </button>
            <button className="ld-btn" onClick={restart}>
              Học lại
            </button>
            <button className="ld-btn" onClick={goReview}>
              🎮 Ôn tập
            </button>
          </div>
          <button className="ld-quit" onClick={() => store.closeStudy()}>
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  /* ================= MÀN TỪNG TỪ (StudyWord) ================= */
  const s0 = (entry.senses || [])[0];
  const m = s0?.meaning || {};
  const posList = (entry.senses || [])
    .map((s) => s.partOfSpeech)
    .filter((p, i, a) => p && a.indexOf(p) === i);

  return (
    <div className="study-page">
      <header className="study-head">
        <button className="modal-x" onClick={exit} aria-label="Đóng">
          ✕
        </button>
        <span className="sw-title">
          {meta?.title || 'Bài học'}
          {meta?.tag ? <small> · {meta.tag}</small> : null}
        </span>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="sw-counter">
          Từ {idx + 1}/{total}
        </span>
      </header>

      {/* progress — bar nhỏ bên phải (theo mẫu) */}
      <div className="sw-top">
        <div className="sw-progress">
          <div className="sw-progress-bar" style={{ width: pct + '%' }} />
        </div>
      </div>

      {/* chi tiết từ */}
      <div className="study-word" key={entry.id}>
        <div className="sw-head">
          <span className="sw-word">{entry.word}</span>
          <button
            className="sw-speak"
            onClick={() => speak(entry.word, course.source.code)}
            title="Nghe phát âm"
            aria-label="Nghe phát âm"
          >
            🔈
          </button>
          <div className="sw-flex" />
          <span className="sw-tag">Bài {lessonNum(lessonId)}</span>
        </div>

        <div className="sw-meta">
          {s0?.pronunciation ? <span className="lm-ipa">{s0.pronunciation}</span> : null}
          {posList.map((p) => (
            <PosChip key={p} pos={p} />
          ))}
        </div>

        <div className="sw-grid">
          <Field label="Anh - Anh" accent="teal">
            {m.en || '—'}
          </Field>
          <Field label="Anh - Việt" accent="amber">
            {m.vi || '—'}
          </Field>
        </div>

        {s0?.examples?.[0] ? (
          <Field label="Ví dụ" accent="rose">
            <em>
              "<HighlightEn text={s0.examples[0]} word={entry.word} />"
            </em>
          </Field>
        ) : null}

        {(entry.senses?.length ?? 0) > 1 ? (
          <div className="lm-senses">
            <div className="lex-field-label">Nghĩa khác · {entry.senses!.length - 1}</div>
            {entry.senses!.slice(1).map((s, i) => (
              <div className="lm-sense" key={i}>
                <PosChip pos={s.partOfSpeech} />
                <div className="lm-sense-txt">
                  <span className="lm-sense-en">{s.meaning?.en || ''}</span>
                  <span className="lm-sense-vi">{s.meaning?.vi || ''}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {entry.synonyms.length > 0 || entry.antonyms.length > 0 ? (
          <div className="lm-syn-row">
            {entry.synonyms.length > 0 ? (
              <div>
                <div className="lex-field-label">Đồng nghĩa</div>
                <div className="lex-tag-row">
                  {entry.synonyms.slice(0, 6).map((s) => (
                    <span key={s} className="lex-tag">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {entry.antonyms.length > 0 ? (
              <div>
                <div className="lex-field-label">Trái nghĩa</div>
                <div className="lex-tag-row">
                  {entry.antonyms.slice(0, 6).map((s) => (
                    <span key={s} className="lex-tag amber">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <button className="sw-next" onClick={() => store.nextStudyWord()}>
        {last ? '✓ Hoàn thành bài học' : 'Từ tiếp theo'} <span className="chev">→</span>
      </button>
    </div>
  );
}
