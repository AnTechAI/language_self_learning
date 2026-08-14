/**
 * ui-stats.js — Tab "Thống kê": tổng quan, phân bố trạng thái,
 * số từ học mỗi ngày (14 ngày), tỷ lệ đúng theo game, streak.
 */
(function () {
  const VA = window.VocabApp;
  const { $, escapeHtml } = VA;

  VA.renderStatsTab = function () {
    const entries = VA.state.entries;
    const total = entries.length;
    const counts = { new: 0, learning: 0, mastered: 0 };
    entries.forEach((e) => (counts[e.learningStatus] = (counts[e.learningStatus] || 0) + 1));

    const history = VA.loadHistory();
    const byGame = {};
    history.forEach((h) => {
      byGame[h.game] = byGame[h.game] || { correct: 0, total: 0 };
      byGame[h.game].total++;
      if (h.correct) byGame[h.game].correct++;
    });
    const gameNames = { flashcard: 'Flashcard', translate: 'Dịch nghĩa', synonym: 'Đồng nghĩa', antonym: 'Trái nghĩa' };

    const daily = VA.loadDaily();
    const last14 = [];
    const cursor = new Date(VA.todayStr());
    for (let i = 0; i < 14; i++) {
      last14.unshift({ date: VA.fmtDate(cursor), n: (daily[VA.fmtDate(cursor)] || []).length });
      cursor.setDate(cursor.getDate() - 1);
    }
    const maxDaily = Math.max(1, ...last14.map((d) => d.n));
    const totalLearnedAll = Object.values(daily).reduce((a, b) => a + b.length, 0);
    const pctNew = total ? Math.round((counts.new / total) * 100) : 0;
    const pctLearning = total ? Math.round((counts.learning / total) * 100) : 0;
    const pctMastered = total ? Math.round((counts.mastered / total) * 100) : 0;

    $('#app').innerHTML = `
      <div class="panel">
        <h2>Tổng quan</h2>
        <div class="stat-grid">
          <div class="stat-box"><div class="num">${total}</div><div class="lbl">Tổng từ</div></div>
          <div class="stat-box"><div class="num" style="color:var(--new);">${counts.new || 0}</div><div class="lbl">Mới</div></div>
          <div class="stat-box"><div class="num" style="color:var(--learning);">${counts.learning || 0}</div><div class="lbl">Đang học</div></div>
          <div class="stat-box"><div class="num" style="color:var(--mastered);">${counts.mastered || 0}</div><div class="lbl">Đã thuộc</div></div>
          <div class="stat-box"><div class="num" style="color:var(--amber);">${VA.getStreak()}</div><div class="lbl">Streak 🔥</div></div>
          <div class="stat-box"><div class="num" style="color:var(--primary);">${totalLearnedAll}</div><div class="lbl">Lượt đã học</div></div>
        </div>
        <div class="status-stack">
          <div style="width:${pctNew}%;background:var(--new);"></div>
          <div style="width:${pctLearning}%;background:var(--learning);"></div>
          <div style="width:${pctMastered}%;background:var(--mastered);"></div>
        </div>
        <div class="legend">
          <span><i style="background:var(--new);"></i>Mới ${pctNew}%</span>
          <span><i style="background:var(--learning);"></i>Đang học ${pctLearning}%</span>
          <span><i style="background:var(--mastered);"></i>Đã thuộc ${pctMastered}%</span>
        </div>
      </div>

      <div class="panel">
        <h2>Từ học mỗi ngày (14 ngày gần nhất)</h2>
        ${totalLearnedAll === 0
          ? `<div class="empty-state">Chưa có dữ liệu. Vào tab "Hôm nay" để học từ đầu tiên!</div>`
          : last14.map((d) => `
              <div class="bar-row">
                <span class="lbl">${d.date.slice(5)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${(d.n / maxDaily * 100)}%;background:${d.n > 0 ? 'var(--primary)' : '#e8ebf0'};"></div></div>
                <span class="val">${d.n}</span>
              </div>`).join('')}
      </div>

      <div class="panel">
        <h2>Tỷ lệ đúng theo trò chơi</h2>
        ${Object.keys(byGame).length === 0
          ? `<div class="empty-state">Chưa có dữ liệu chơi game.</div>`
          : Object.entries(byGame).map(([g, v]) => {
              const p = v.total ? Math.round((v.correct / v.total) * 100) : 0;
              return `
                <div class="bar-row">
                  <span class="lbl">${gameNames[g] || g}</span>
                  <div class="bar-track"><div class="bar-fill" style="width:${p}%;background:${p >= 80 ? 'var(--mastered)' : p >= 50 ? 'var(--learning)' : 'var(--danger)'};"></div></div>
                  <span class="val">${p}%</span>
                </div>
                <div style="font-size:11px;color:var(--muted);margin:-3px 0 8px 98px;">${v.correct}/${v.total} câu đúng</div>`;
            }).join('')}
      </div>`;
  };
})();
