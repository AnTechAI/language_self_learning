/**
 * ui-home.js — Tab "Hôm nay": học từ mới mỗi ngày + ôn tập nhanh.
 * Mở app là thấy ngay từ chưa học (có bản dịch ở ngôn ngữ đích đang chọn).
 */
(function () {
  const VA = window.VocabApp;
  const { $, $$, escapeHtml } = VA;

  /** Đưa từ đã "Ôn lại sau" xuống cuối hàng đợi (nhớ thứ tự trong phiên) */
  function rotateNewQueue(id) {
    const learned = VA.learnedToday();
    const newWords = VA.state.entries.filter((e) => e.learningStatus === 'new' && !learned.includes(e.id) && VA.hasTarget(e));
    const idx = newWords.findIndex((x) => x.id === id);
    if (idx < 0) return;
    newWords.push(newWords.splice(idx, 1)[0]);
    sessionStorage.setItem('newQ', JSON.stringify(newWords.map((x) => x.id)));
  }

  VA.renderHome = function () {
    const learned = VA.learnedToday();
    const quota = VA.config.dailyQuota;
    const pct = Math.min(100, Math.round((learned.length / quota) * 100));
    const allNew = VA.state.entries.filter((e) => e.learningStatus === 'new' && !learned.includes(e.id));
    const newWords = allNew.filter(VA.hasTarget); // chỉ học từ có bản dịch ngôn ngữ đang chọn
    const missingTarget = allNew.length - newWords.length;
    const current = newWords[0] || null;
    const streak = VA.getStreak();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const course = VA.getCourse();
    const isEn = course.seed === 'en';
    const due = VA.state.entries.filter((e) => e.learningStatus !== 'new' && e.lastReviewDay !== VA.todayStr());
    const dueShow = due.slice(0, 5);

    // Bài học: chờ manifest (tải theo nhu cầu) rồi render lại để có panel chọn bài
    let lessonsReady = false;
    let lessonFocusId = null;
    if (isEn) {
      lessonsReady = !!(VA.lessons.manifest && VA.lessons.manifest.length);
      if (!lessonsReady) {
        VA.ensureLessonsManifest().then(() => VA.renderHome()).catch(() => {});
      }
    }

    let body = `
      <div class="hero">
        <h2>${greeting} ${course.icon} 👋</h2>
        <p>Hôm nay là ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}. Hãy học vài từ ${course.name.toLowerCase()} nhé!</p>
        <div class="row">
          <span class="stat">📖 Đã học hôm nay: <b>${learned.length}/${quota}</b> từ</span>
          ${streak > 0 ? `<span class="stat">🔥 ${streak} ngày liên tiếp</span>` : ''}
          <span class="stat">🗂️ Còn <b>${allNew.length}</b> từ mới trong kho</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>`;

    if (isEn && lessonsReady) {
      const lessons = VA.lessons.manifest;
      lessonFocusId = (VA.state.lessonFocus && VA.lessonById(VA.state.lessonFocus))
        ? VA.state.lessonFocus
        : (lessons[0] && lessons[0].id);
      body += `
      <div class="panel">
        <h3 style="margin-bottom:8px;">📚 Học từ mới theo bài học</h3>
        <div class="row">
          <select id="lessonSelect" class="grow">
            ${lessons.map((l) => `<option value="${escapeHtml(l.id)}" ${l.id === lessonFocusId ? 'selected' : ''}>${escapeHtml(l.title)} (${l.count} từ)</option>`).join('')}
          </select>
          <button class="btn" id="learnLessonBtn">Học bài này →</button>
        </div>
        <small class="help" style="margin-top:6px;">Chọn bài → ${lessonFocusId ? '20 từ mới của bài được tự thêm vào kho và hiện ngay bên dưới để học.' : 'Chưa có bài học — chạy node tools/build-lessons.js để tạo bài từ english-dictionary.jsonl.'}</small>
      </div>`;
    }

    if (current) {
      body += `<div class="panel"><h3>Từ mới tiếp theo</h3>` + VA.learnCard(current, 'learning') + `</div>`;
    } else if (newWords.length === 0 && learned.length > 0) {
      body += `
        <div class="panel">
          <div class="empty-state">
            <div class="big">🎉</div>
            <h2 style="margin:0 0 6px;">Hết từ mới cho hôm nay!</h2>
            <p>Bạn đã học ${learned.length} từ. Ngày mai quay lại để học tiếp nhé.</p>
            <div class="row" style="justify-content:center;margin-top:14px;">
              <button class="btn soft" id="goReviewBtn">🗂️ Ôn tập ngay</button>
              <button class="btn ghost" id="addMoreHomeBtn">＋ Thêm từ mới</button>
            </div>
          </div>
        </div>`;
    } else {
      body += `
        <div class="panel">
          <div class="empty-state">
            <div class="big">🌱</div>
            <h2 style="margin:0 0 6px;">Bắt đầu ngay hôm nay</h2>
            <p>Bấm nút bên dưới để xem từ mới đầu tiên.</p>
            <div class="row" style="justify-content:center;margin-top:14px;">
              <button class="btn" id="startLearnBtn">Học từ mới đầu tiên →</button>
              <button class="btn ghost" id="addMoreHomeBtn">＋ Thêm từ mới</button>
            </div>
          </div>
        </div>`;
    }

    if (missingTarget > 0) {
      body += `
        <div class="panel" style="background:var(--amber-soft);border-color:#f5dcae;padding:12px 16px;">
          <div style="font-size:13px;color:var(--amber);font-weight:600;">💡 Có <b>${missingTarget}</b> từ chưa có bản dịch ${course.target.label} — chỉ hiện từ đã có bản dịch đầy đủ.</div>
        </div>`;
    }

    body += `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h2 style="margin:0;">Ôn tập nhanh hôm nay</h2>
          ${due.length > 0 ? `<button class="btn sm ghost" id="reviewAllBtn">Ôn tất cả (${due.length})</button>` : ''}
        </div>
        ${dueShow.length === 0
          ? `<div class="empty-state" style="padding:20px;"><div class="big">✅</div>Hôm nay bạn đã ôn xong các từ đã học. Học từ mới lên nào!</div>`
          : `<ul class="word-list">${dueShow.map((e) => {
              const s0 = (e.senses && e.senses[0]) || {};
              const m = VA.meaning(s0);
              return `
                <li class="word-item" data-id="${e.id}">
                  <span class="status-dot ${e.learningStatus}"></span>
                  <div style="flex:1;">
                    <div class="w">${escapeHtml(e.word)}</div>
                    <div class="meta">${VA.posChips(e)} ${m.target ? '· ' + escapeHtml(m.target) : ''}</div>
                  </div>
                  <span class="chev">›</span>
                </li>`;
            }).join('')}</ul>`}
      </div>`;

    $('#app').innerHTML = body;

    // thẻ học từ
    $$('.learn-card').forEach((c) => {
      VA.bindCardActions(c);
      const knowBtn = c.querySelector('.know-btn');
      if (knowBtn) knowBtn.onclick = () => {
        const entry = VA.state.entries.find((x) => x.id === c.dataset.id);
        if (entry) { VA.markLearned(entry); VA.toast('✓ Đã học "' + c.dataset.word + '"'); }
        VA.renderHome();
      };
      const laterBtn = c.querySelector('.later-btn');
      if (laterBtn) laterBtn.onclick = () => { rotateNewQueue(c.dataset.id); VA.renderHome(); };
    });

    const rb = $('#reviewAllBtn');
    if (rb) rb.onclick = () => VA.startFlashcardWith(due.map((x) => x.id));
    const gr = $('#goReviewBtn');
    if (gr) gr.onclick = () => { VA.state.tab = 'games'; VA.state.gameScreen = 'menu'; VA.render(); };
    const am = $('#addMoreHomeBtn');
    if (am) am.onclick = () => VA.openModal('new');
    const sl = $('#startLearnBtn');
    if (sl) sl.onclick = VA.renderHome;

    // Học bài học: chọn bài → tự thêm từ vào kho → hiện từ mới đầu tiên
    const ls = $('#lessonSelect');
    if (ls) {
      if (lessonFocusId) ls.value = lessonFocusId;
      $('#learnLessonBtn').onclick = async () => {
        const id = ls.value;
        const added = await VA.ensureLessonInCourse(id);
        const meta = VA.lessonById(id);
        VA.state.lessonFocus = id;
        if (added > 0) VA.toast('✓ Đã thêm ' + added + ' từ của bài "' + (meta ? meta.title : '') + '" vào kho');
        else VA.toast('📘 Bài "' + (meta ? meta.title : '') + '" đã có sẵn trong kho');
        VA.renderHome();
      };
    }

    $$('.word-item').forEach((el) => {
      el.onclick = () => { VA.state.tab = 'vocab'; VA.state.detailId = el.dataset.id; VA.render(); };
    });
  };
})();
