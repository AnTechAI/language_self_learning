/**
 * PickerScreen — Màn hình chọn khóa học (redesign).
 */
import { COURSES } from '../../data/courses';
import { useCourseStore } from '../../store/useCourseStore';

export function PickerScreen() {
  const enterCourse = useCourseStore((s) => s.enterCourse);

  return (
    <div className="picker-screen">
      <div className="logo">🎓</div>
      <h1>English Learning</h1>
      <p className="sub">Chọn ngôn ngữ bạn muốn học — bản dịch luôn là tiếng Việt 🇻🇳</p>
      {COURSES.map((c) => (
        <button key={c.id} className="course-card" onClick={() => void enterCourse(c.id)}>
          <span className="cico">{c.icon}</span>
          <span>
            <span className="cn">{c.name}</span>
            <br />
            <span className="ct">{c.tagline}</span>
          </span>
          <span className="chev">›</span>
        </button>
      ))}
      <div className="picker-features">
        <span className="ft">📚 Bài học theo chủ đề</span>
        <span className="ft">🎮 Trò chơi ôn tập</span>
        <span className="ft">📖 Từ điển 207k từ</span>
        <span className="ft">📴 Học ngoại tuyến</span>
      </div>
    </div>
  );
}
