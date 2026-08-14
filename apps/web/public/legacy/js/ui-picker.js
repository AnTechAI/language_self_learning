/**
 * ui-picker.js — Màn hình CHỌN KHÓA HỌC (hiện ngay khi mở app).
 * Mỗi thẻ khóa học hiện thống kê riêng (tổng từ, đã thuộc, từ mới, streak, tiến độ hôm nay)
 * đọc từ DATABASE RIÊNG của từng khóa — không trộn lẫn.
 */
(function () {
  const VA = window.VocabApp;
  const { $, $$, escapeHtml } = VA;

  /** Thống kê riêng của 1 khóa học (đọc thẳng localStorage theo course id) */
  function courseStats(cid) {
    const entries = VA.loadEntriesFor(cid);
    const mastered = entries.filter((e) => e.learningStatus === 'mastered').length;
    const remaining = entries.filter((e) => e.learningStatus === 'new').length;
    const daily = VA.loadDailyFor(cid);
    const today = (daily[VA.todayStr()] || []).length;
    const streak = VA.getStreakFor(cid);
    return { total: entries.length, mastered, remaining, today, streak };
  }

  VA.renderPicker = function () {
    const courses = VA.courses();
    $('#app').innerHTML = `
      <div class="hero picker-hero">
        <h2>Chọn khóa học 📚</h2>
        <p>Mỗi khóa có kho từ vựng, tiến độ học và thống kê riêng. Hôm nay bạn muốn học gì?</p>
      </div>
      <div class="course-grid">
        ${courses.map((c) => {
          const st = courseStats(c.id);
          return `
          <div class="course-card" data-course="${c.id}" style="--cc:${c.color}">
            <div class="cc-top">
              <div class="cc-icon">${c.icon}</div>
              <div class="cc-badges">
                ${st.streak > 0 ? `<span class="cc-badge flame">🔥 ${st.streak} ngày</span>` : ''}
                ${st.today > 0 ? `<span class="cc-badge">✅ ${st.today}/${VA.config.dailyQuota} hôm nay</span>` : ''}
              </div>
            </div>
            <h3>${escapeHtml(c.name)}</h3>
            <p class="cc-tagline">${escapeHtml(c.tagline)}</p>
            <div class="cc-stats">
              <span>📖 ${st.total} từ</span>
              <span>⭐ ${st.mastered} thuộc</span>
              <span>🌱 ${st.remaining} mới</span>
            </div>
            <button class="btn cc-enter">Vào học →</button>
          </div>`;
        }).join('')}
      </div>
      <div class="panel" style="padding:14px 18px;background:var(--primary-soft);border-color:var(--border);">
        <small class="help" style="margin:0;color:var(--text);">
          💡 Muốn học thêm ngôn ngữ khác (Nhật, Hàn…)? Thêm 1 khóa học vào <code>js/config.js</code>
          và bộ từ tương ứng vào <code>js/seed-data.js</code> — dropdown trên màn này tự sinh.
        </small>
      </div>`;

    $$('.course-card').forEach((card) => {
      card.onclick = () => VA.enterCourse(card.dataset.course);
    });
  };
})();
