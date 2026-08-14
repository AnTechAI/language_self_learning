/**
 * state.js — Trạng thái toàn cục của app.
 * entries: kho từ của KHÓA ĐANG MỞ (nạp khi vào khóa học — mỗi khóa có database riêng).
 * tab / bộ lọc / chi tiết / màn game / modal draft / session game.
 */
(function () {
  const VA = window.VocabApp;

  VA.state = {
    entries: [],                        // kho từ của khóa đang mở (load khi VA.enterCourse)
    tab: 'home',                        // home | vocab | games | stats
    vocabFilter: { search: '', status: 'all', tag: 'all' },
    detailId: null,                     // id từ đang xem chi tiết
    gameScreen: 'menu',                 // menu | flashcard | translate | synonym | antonym
    vocabLessonId: null,                // bài học đang mở trong tab Từ vựng (null = tất cả từ)
    gameLessonId: null,                 // phạm vi game: null = tất cả, còn lại = id bài học
    lessonFocus: null,                  // bài học vừa chọn để học (home dùng để tô select)
  };

  VA.modalDraft = null;   // dữ liệu đang sửa trong modal
  VA.session = null;      // session game đang chạy
})();
