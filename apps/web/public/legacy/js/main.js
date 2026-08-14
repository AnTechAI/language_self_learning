/**
 * main.js — Khởi động app + điều hướng chung.
 * Luồng chạy:
 *   1) Mở app → màn hình CHỌN KHÓA HỌC (hoặc tự vào khóa đã chọn lần trước).
 *   2) VA.enterCourse(id): nạp database riêng của khóa (migrate dữ liệu cũ + merge seed).
 *   3) Render 4 tab scoped theo khóa đang mở.
 *   4) Logo / nút "⇄ Khóa học" → về màn chọn khóa.
 */
(function () {
  const VA = window.VocabApp;
  const { $, $$, escapeHtml } = VA;

  /* ============ Vào / ra khóa học ============ */

  /** Vào 1 khóa học: nạp database riêng + merge seed + render */
  VA.enterCourse = function (id) {
    const course = VA.courseById(id);
    if (!course) return;
    VA.course.current = id;
    const s = VA.loadSettings();
    s.courseId = id;
    VA.saveSettings(s);
    document.body.dataset.course = id;
    document.body.classList.remove('picker');

    // Nạp database của khóa (copy dữ liệu cũ nếu lần đầu mở) → chuẩn hóa → merge seed
    let entries = VA.importLegacy(id);
    const { entries: fixed, changed } = VA.migrate(entries);
    const added = course.seed === 'zh' ? VA.mergeZhSeeds(fixed) : VA.mergeSeeds(fixed);
    // Nâng cấp seed (đa nghĩa…) cho người dùng đã có dữ liệu — chạy 1 lần theo phiên bản
    let upgraded = 0;
    if (course.seed !== 'zh' && (s.seedVersion || 0) < (VA.SEED_VERSION || 2)) {
      upgraded = VA.applySeedUpgrade(fixed);
      s.seedVersion = VA.SEED_VERSION;
      VA.saveSettings(s);
    }
    if (changed || added > 0 || upgraded > 0) VA.saveEntriesFor(id, fixed);
    VA.state.entries = fixed;

    // Reset trạng thái UI của khóa mới
    VA.state.tab = 'home';
    VA.state.detailId = null;
    VA.state.gameScreen = 'menu';
    VA.state.vocabLessonId = null;
    VA.state.gameLessonId = null;
    VA.state.lessonFocus = null;
    VA.session = null;

    VA.render();
  };

  /** Ra khỏi khóa học → màn hình chọn khóa */
  VA.exitCourse = function () {
    VA.course.current = null;
    const s = VA.loadSettings();
    delete s.courseId;
    VA.saveSettings(s);
    VA.state.entries = [];
    VA.state.detailId = null;
    VA.state.gameScreen = 'menu';
    VA.session = null;
    delete document.body.dataset.course;
    document.body.classList.add('picker');
    VA.render();
  };

  /* ============ Render root ============ */
  VA.render = function () {
    // Màn chọn khóa học (chưa vào khóa nào)
    if (!VA.course.current) {
      document.body.classList.add('picker');
      VA.renderPicker();
      return;
    }
    document.body.classList.remove('picker');

    const course = VA.getCourse();
    $$('#mainNav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === VA.state.tab));
    const streakNum = $('#streakNum');
    if (streakNum) streakNum.textContent = VA.getStreak();
    const chip = $('#courseChip');
    if (chip) chip.innerHTML = course.icon + ' ' + escapeHtml(course.name);

    if (VA.state.tab === 'home') VA.renderHome();
    else if (VA.state.tab === 'vocab') VA.renderVocabTab();
    else if (VA.state.tab === 'games') VA.renderGamesTab();
    else VA.renderStatsTab();
    window.scrollTo({ top: 0 });
  };

  /* ============ Khởi động ============ */
  function boot() {
    // Migrate cài đặt cũ: pairId (Anh→Việt / Anh→Trung) → courseId (en / zh)
    const s = VA.loadSettings();
    if (s.courseId === undefined && s.pairId) {
      s.courseId = ({ 'en-vi': 'en', 'en-zh': 'zh' })[s.pairId] || 'en';
      delete s.pairId;
      VA.saveSettings(s);
    }

    // Vào khóa đã chọn lần trước, hoặc hiện màn hình chọn khóa
    if (s.courseId && VA.courseById(s.courseId)) {
      VA.enterCourse(s.courseId);
    } else {
      document.body.classList.add('picker');
      VA.render();
    }

    // Logo → về màn chọn khóa học
    const logo = $('#logoBtn');
    if (logo) logo.onclick = () => VA.exitCourse();

    // Nút đổi khóa học
    const sw = $('#switchCourseBtn');
    if (sw) sw.onclick = () => VA.exitCourse();

    // Điều hướng tab (chỉ hoạt động khi đã vào khóa)
    $('#mainNav').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      VA.state.tab = btn.dataset.tab;
      VA.state.detailId = null;
      VA.state.gameScreen = 'menu';
      VA.session = null;
      VA.render();
    });
  }

  boot();
})();
