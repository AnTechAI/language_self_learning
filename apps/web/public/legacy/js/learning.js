/**
 * learning.js — Logic học tập:
 * đánh dấu đã học, trạng thái new → learning → mastered, streak, lịch sử game.
 */
(function () {
  const VA = window.VocabApp;

  /** Nhãn trạng thái */
  VA.statusLabel = function (s) {
    return s === 'new' ? 'Mới' : s === 'learning' ? 'Đang học' : 'Đã thuộc';
  };

  /**
   * Đánh dấu từ đã học hôm nay:
   *  - new → learning
   *  - ghi vào nhật ký daily (phục vụ quota + streak)
   */
  VA.markLearned = function (entry) {
    const changed = entry.learningStatus === 'new';
    if (changed) entry.learningStatus = 'learning';
    entry.lastReviewDay = VA.todayStr();
    const daily = VA.loadDaily();
    const t = VA.todayStr();
    daily[t] = daily[t] || [];
    if (!daily[t].includes(entry.id)) daily[t].push(entry.id);
    VA.saveDaily(daily);
    VA.saveEntries(VA.state.entries);
    return changed;
  };

  /**
   * Ghi nhận kết quả 1 câu trả lời (game):
   *  - đúng liên tiếp 3 lần → mastered
   *  - sai → reset streak, hạ từ mastered về learning
   *  - từ mới trả lời đúng → tự đánh dấu đã học hôm nay
   */
  VA.registerResult = function (entry, wasCorrect) {
    entry.correctStreak = entry.correctStreak || 0;
    if (wasCorrect) {
      entry.correctStreak += 1;
      if (entry.learningStatus === 'new') {
        VA.markLearned(entry);
      } else {
        entry.lastReviewDay = VA.todayStr();
      }
    } else {
      entry.correctStreak = 0;
      if (entry.learningStatus === 'mastered') entry.learningStatus = 'learning';
      entry.lastReviewDay = VA.todayStr();
    }
    if (entry.correctStreak >= 3 && entry.learningStatus !== 'mastered') {
      entry.learningStatus = 'mastered';
      VA.toast('🎉 Đã thuộc: "' + entry.word + '"!');
    }
    VA.saveEntries(VA.state.entries);
  };

  /** Ghi lịch sử chơi game (giữ tối đa 800 bản ghi) */
  VA.recordHistory = function (gameType, wordId, wasCorrect) {
    const h = VA.loadHistory();
    h.push({ ts: new Date().toISOString(), game: gameType, wordId, correct: wasCorrect });
    VA.saveHistory(h);
  };

  /** Số ngày học liên tiếp tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa học) */
  VA.getStreak = function () {
    const daily = VA.loadDaily();
    const cursor = new Date(VA.todayStr());
    if (!(daily[VA.fmtDate(cursor)] || []).length) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (daily[VA.fmtDate(cursor)] && daily[VA.fmtDate(cursor)].length > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  };

  /** Như trên, nhưng tính cho 1 khóa học cụ thể (dùng ở màn hình chọn khóa) */
  VA.getStreakFor = function (courseId) {
    const daily = VA.loadDailyFor(courseId);
    const cursor = new Date(VA.todayStr());
    if (!(daily[VA.fmtDate(cursor)] || []).length) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (daily[VA.fmtDate(cursor)] && daily[VA.fmtDate(cursor)].length > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  };

  /** Danh sách id từ đã học hôm nay */
  VA.learnedToday = function () {
    const daily = VA.loadDaily();
    return daily[VA.todayStr()] || [];
  };
})();
