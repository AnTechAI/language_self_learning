/**
 * LessonStudyScreen — "Học bài này": PAGE tua từng từ của bài.
 *   - Từng từ hiện chi tiết (từ, IPA, loại từ, nghĩa Việt, ví dụ, đồng nghĩa/trái nghĩa) + nút "Từ tiếp theo →".
 *   - Từ cuối → nút "✓ Hoàn tất bài học".
 *   - Hoàn tất / thoát giữa chừng → hiện 2 nút "Học tiếp" (bài sau) và "Ôn tập" (games bài này).
 */
import { Button } from '../../components/ui';
import { speak } from '../../lib/tts';
import { lessonById } from '../../data/lessons';
import { useLessons } from '../home/useLessons';
import { useCourseStore } from '../../store/useCourseStore';

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

  /* ================= MÀN HOÀN TẤT ================= */
  if (done) {
    return (
      <div className="study-page">
        <header className="study-head">
          <button className="modal-x" onClick={() => store.closeStudy()} aria-label="Đóng">
            ✕
          </button>
          <h2>📚 {meta?.title || 'Bài học'}</h2>
        </header>
        <div className="study-done">
          <div className="big">🎉</div>
          <h3>Đã xem hết {total} từ của bài</h3>
          <p className="help">Từ của bài đã được thêm vào kho từ vựng của bạn. Hãy chọn:</p>
          <div className="study-actions">
            <Button variant="primary" size="lg" onClick={() => void goNextLesson()}>
              Học tiếp →
            </Button>
            <Button variant="ghost" size="lg" onClick={goReview}>
              🎮 Ôn tập
            </Button>
          </div>
          <Button variant="ghost" style={{ marginTop: 12 }} onClick={() => store.closeStudy()}>
            Quay lại Hôm nay
          </Button>
        </div>
      </div>
    );
  }

  /* ================= MÀN TỪNG TỪ ================= */
  const s0 = (entry.senses || [])[0];
  return (
    <div className="study-page">
      <header className="study-head">
        <button className="modal-x" onClick={exit} aria-label="Đóng">
          ✕
        </button>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="help">
          Bài {meta?.tag ? '· ' + meta.tag : ''} · Từ {idx + 1}/{total}
        </span>
      </header>

      {/* progress */}
      <div className="study-progress">
        <div className="study-progress-bar" style={{ width: pct + '%' }} />
      </div>

      {/* chi tiết từ */}
      <div className="study-word" key={entry.id}>
        <div className="study-word-word">
          {entry.word}
          <button
            className="speak-btn"
            onClick={(e) => {
              e.stopPropagation();
              speak(entry.word, course.source.code);
            }}
            title="Nghe phát âm"
          >
            🔈
          </button>
        </div>
        {s0?.pronunciation ? <div className="ipa">{s0.pronunciation}</div> : null}
        <div className="study-pos">
          {(entry.senses || [])
            .map((s) => s.partOfSpeech)
            .filter((p, i, a) => p && a.indexOf(p) === i)
            .join(' · ')}
        </div>

        {/* nghĩa */}
        {(entry.senses || []).map((s, i) => {
          const m = s.meaning || {};
          const vi = m[course.target.code];
          const en = m[course.source.code];
          return (
            <div key={i} className="study-sense">
              {s.partOfSpeech ? <span className="pos-chip">{s.partOfSpeech}</span> : null}
              {vi ? <div className="study-vi">{vi}</div> : null}
              {en && en !== vi ? <div className="study-en">{en}</div> : null}
              {s.examples && s.examples[0] ? (
                <div className="study-ex">💬 {s.examples[0]}</div>
              ) : null}
            </div>
          );
        })}

        {/* đ/trái nghĩa */}
        {entry.synonyms.length > 0 || entry.antonyms.length > 0 ? (
          <div className="study-syn">
            {entry.synonyms.length > 0 ? (
              <div>🔁 Đồng nghĩa: {entry.synonyms.slice(0, 5).join(', ')}</div>
            ) : null}
            {entry.antonyms.length > 0 ? (
              <div>🚫 Trái nghĩa: {entry.antonyms.slice(0, 5).join(', ')}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="study-footer">
        <Button
          variant="primary"
          size="lg"
          style={{ width: '100%' }}
          onClick={() => store.nextStudyWord()}
        >
          {last ? '✓ Hoàn tất bài học' : 'Từ tiếp theo →'}
        </Button>
      </div>
    </div>
  );
}
