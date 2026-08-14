/**
 * ui-shared.js — Component dùng chung giữa các tab:
 * thẻ học từ (learnCard), chips loại từ, nút xem thêm (collapse),
 * khung game (gameShell, summaryPanel), thẻ kết quả.
 */
(function () {
  const VA = window.VocabApp;
  const { $, $$, escapeHtml } = VA;

  /** Chuỗi chip loại từ của 1 entry */
  VA.posChips = function (entry) {
    const pos = Array.from(new Set((entry.senses || []).map((s) => s.partOfSpeech).filter(Boolean)));
    return pos.map((p) => `<span class="pos-chip">${escapeHtml(p)}</span>`).join('');
  };

  /**
   * Chọn 1 nghĩa (sense) để ôn — từ đa nghĩa thì ngẫu nhiên giữa các nghĩa
   * để người học luyện đều cả mặt nghĩa.
   */
  VA.pickSense = function (entry) {
    const arr = (entry && entry.senses) || [];
    if (!arr.length) return {};
    if (arr.length === 1) return arr[0];
    return arr[Math.floor(Math.random() * arr.length)];
  };

  /** Khối nghĩa: dòng nguồn (nếu có) + dòng đích tiếng Việt theo khóa đang mở */
  VA.defLine = function (sense) {
    const m = VA.meaning(sense);
    return `
      <div class="def-line">
        ${m.source ? `<div class="en">${escapeHtml(m.source)}</div>` : ''}
        <div class="vi">${escapeHtml(m.target)}</div>
      </div>`;
  };

  /** Khối ví dụ */
  VA.examplesBox = function (examples) {
    if (!examples || !examples.length) return '';
    return examples.map((ex) => `<div class="example-box"><span class="q">❝ </span>${escapeHtml(ex)}</div>`).join('');
  };

  /**
   * Thẻ học từ — dùng ở tab Hôm nay (mode 'learning' có nút hành động)
   * và có thể tái dùng ở nơi khác.
   */
  VA.learnCard = function (entry, mode) {
    const s0 = (entry.senses && entry.senses[0]) || {};
    const syn = entry.synonyms || [];
    const ant = entry.antonyms || [];
    const tags = entry.tags || [];
    const m = VA.meaning(s0);
    const course = VA.getCourse();
    return `
    <div class="learn-card" data-id="${entry.id}" data-word="${escapeHtml(entry.word)}">
      <div class="learn-word-row">
        <div class="learn-word">${escapeHtml(entry.word)}</div>
        <button class="speak-btn" data-speak="${escapeHtml(entry.word)}" data-lang="${course.source.code}" title="Nghe phát âm">🔈</button>
        ${s0.pronunciation ? `<span class="ipa-chip">${escapeHtml(s0.pronunciation)}</span>` : ''}
        ${VA.posChips(entry)}
      </div>
      <div class="def-line">
        ${m.source ? `<div class="en">${escapeHtml(m.source)}</div>` : ''}
        <div class="vi">${escapeHtml(m.target)}</div>
      </div>
      ${m.target && course.target.code !== course.source.code
        ? `<div style="text-align:right;margin-top:6px;"><button class="speak-btn" data-speak="${escapeHtml(m.target)}" data-lang="${course.target.code}" title="Nghe nghĩa ${course.target.label}">🔈</button></div>` : ''}
      ${VA.examplesBox(s0.examples)}
      <div class="row" style="margin-top:14px;">
        ${syn.length ? `<button class="collapse-btn" data-toggle="syn">🔁 Đồng nghĩa <span class="cnt">${syn.length}</span></button>` : ''}
        ${ant.length ? `<button class="collapse-btn" data-toggle="ant">↔️ Trái nghĩa <span class="cnt">${ant.length}</span></button>` : ''}
        ${tags.length ? `<button class="collapse-btn" data-toggle="tag">🏷️ Chủ đề <span class="cnt">${tags.length}</span></button>` : ''}
        ${entry.wordRoot ? `<button class="collapse-btn" data-toggle="root">🌿 Gốc từ</button>` : ''}
      </div>
      <div class="collapse-body" data-body="syn">${syn.map((s) => `<span class="tag syn-chip" style="margin:3px;">${escapeHtml(s)}</span>`).join('')}</div>
      <div class="collapse-body" data-body="ant">${ant.map((s) => `<span class="tag ant-chip" style="margin:3px;">${escapeHtml(s)}</span>`).join('')}</div>
      <div class="collapse-body" data-body="tag">${tags.map((s) => `<span class="tag" style="margin:3px;">${escapeHtml(s)}</span>`).join('')}</div>
      <div class="collapse-body" data-body="root">${escapeHtml(entry.wordRoot || '')}</div>
      ${mode === 'learning' ? `
        <div class="row" style="margin-top:16px;">
          <button class="btn ghost later-btn" style="flex:1;">🔄 Ôn lại sau</button>
          <button class="btn know-btn" style="flex:2;">✓ Tôi đã hiểu từ này</button>
        </div>` : ''}
    </div>`;
  };

  /** Bật/tắt panel "xem thêm" — tìm theo nút trong cùng .learn-card hoặc .panel */
  VA.toggleCollapse = function (btn) {
    const key = btn.dataset.toggle;
    const root = btn.closest('.learn-card, .panel') || document;
    const body = root.querySelector('[data-body="' + key + '"]');
    if (!body) return;
    const open = body.classList.toggle('open');
    btn.style.borderColor = open ? 'var(--primary)' : '';
    btn.style.color = open ? 'var(--primary-dark)' : '';
    btn.style.background = open ? 'var(--primary-soft)' : '';
  };

  /** Gắn sự kiện cho mọi .collapse-btn + nút speak trong 1 root */
  VA.bindCardActions = function (root) {
    if (!root) return;
    root.querySelectorAll('.collapse-btn').forEach((b) => (b.onclick = () => VA.toggleCollapse(b)));
    root.querySelectorAll('.speak-btn').forEach((b) => {
      b.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation(); // không để bấm nút này kích hoạt thẻ/đáp án phía sau
        VA.speak(b.dataset.speak, b.dataset.lang || 'en');
      };
    });
  };

  /* ============ Khung game dùng chung ============ */

  /** Shell game: tiêu đề + thoát + thanh tiến độ + điểm + streak liên tiếp */
  VA.gameShell = function (title, subtitle) {
    const s = VA.session;
    const pct = s.queue.length ? Math.round((s.idx / s.queue.length) * 100) : 0;
    const streakNow = s.streakNow || 0;
    return `
      <div class="panel" style="padding:16px 20px;">
        <div class="game-toolbar">
          <div>
            <h2 style="margin:0;">${title}</h2>
            ${subtitle ? `<small class="muted">${subtitle}</small>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${streakNow > 1 ? `<span class="game-streak" title="Trả lời đúng liên tiếp">🔥 ${streakNow}</span>` : ''}
            <button class="btn sm ghost" id="exitGameBtn">✕ Thoát</button>
          </div>
        </div>
        <div class="game-progress"><div class="fill" style="width:${pct}%"></div></div>
        <div class="muted" style="font-size:12.5px;">Từ ${Math.min(s.idx + 1, s.queue.length)}/${s.queue.length} · Đúng <b style="color:var(--primary-dark);">${s.correct}</b>/${s.total}</div>
      </div>`;
  };

  VA.bindExit = function () {
    const el = $('#exitGameBtn');
    if (el) el.onclick = () => { VA.state.gameScreen = 'menu'; VA.session = null; VA.renderGamesTab(); };
  };

  /** Panel tổng kết khi hết bài — hiện Đúng/Sai/Tỷ lệ + danh sách từ sai + nút ôn lại từ sai */
  VA.summaryPanel = function () {
    const s = VA.session;
    const wrong = Math.max(0, s.total - s.correct);
    const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
    const missedEntries = (s.missed || []).map((id) => VA.state.entries.find((e) => e.id === id)).filter(Boolean);
    const missedShow = missedEntries.slice(0, 8);
    return `
      <div class="panel" style="text-align:center;">
        <h2>Hoàn thành! 🎉</h2>
        <div class="stat-grid" style="max-width:480px;margin:14px auto;">
          <div class="stat-box"><div class="num">${s.total}</div><div class="lbl">Số câu</div></div>
          <div class="stat-box"><div class="num" style="color:var(--primary);">${s.correct}</div><div class="lbl">Đúng</div></div>
          <div class="stat-box"><div class="num" style="color:var(--danger);">${wrong}</div><div class="lbl">Sai</div></div>
          <div class="stat-box"><div class="num" style="color:var(--amber);">${pct}%</div><div class="lbl">Tỷ lệ</div></div>
        </div>
        ${missedEntries.length ? `
        <div class="missed-box">
          <div class="missed-title">🔁 Còn <b>${missedEntries.length}</b> từ chưa nhớ — bấm vào từ để xem chi tiết:</div>
          <div class="missed-list">
            ${missedShow.map((e) => {
              const m = VA.meaning((e.senses && e.senses[0]) || {});
              return `<div class="missed-item" data-id="${e.id}"><b>${escapeHtml(e.word)}</b><span>${escapeHtml(m.target)}</span></div>`;
            }).join('')}
            ${missedEntries.length > missedShow.length ? `<div class="missed-more">+ ${missedEntries.length - missedShow.length} từ nữa…</div>` : ''}
          </div>
        </div>
        <div class="row" style="max-width:480px;margin:14px auto 0;">
          <button class="btn ghost" id="backToMenuBtn2">← Menu</button>
          <button class="btn ghost" id="replayBtn">↺ Chơi lại</button>
          <button class="btn" id="retryMissedBtn">🔁 Ôn lại từ sai (${missedEntries.length})</button>
        </div>`
        : `<div class="row" style="max-width:420px;margin:14px auto 0;">
          <button class="btn ghost" id="backToMenuBtn2">← Menu</button>
          <button class="btn" id="replayBtn">↺ Chơi lại</button>
        </div>`}
      </div>`;
  };

  VA.bindReplay = function (type) {
    const back = $('#backToMenuBtn2');
    if (back) back.onclick = () => { VA.state.gameScreen = 'menu'; VA.session = null; VA.renderGamesTab(); };
    const replay = $('#replayBtn');
    if (replay) replay.onclick = () => VA.startGame(type);
    const retry = $('#retryMissedBtn');
    if (retry) {
      const ids = (VA.session.missed || []).slice(); // chụp trước vì startGame sẽ thay session
      retry.onclick = () => { if (ids.length) VA.startGame(type, ids); };
    }
    $$('.missed-item').forEach((el) => {
      el.onclick = () => { VA.state.tab = 'vocab'; VA.state.detailId = el.dataset.id; VA.render(); };
    });
  };

  /** Thẻ kết quả đầy đủ sau khi trả lời (dịch nghĩa, flashcard…) */
  VA.resultCard = function (entry, sense) {
    const m = VA.meaning(sense);
    const course = VA.getCourse();
    return `
      <div class="result-card">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:20px;font-weight:800;">${escapeHtml(entry.word)}</span>
          <button class="speak-btn" data-speak="${escapeHtml(entry.word)}" data-lang="${course.source.code}">🔈</button>
          ${sense.pronunciation ? `<span class="ipa-chip">${escapeHtml(sense.pronunciation)}</span>` : ''}
          <span class="pos-chip">${escapeHtml(sense.partOfSpeech || '')}</span>
        </div>
        <div style="margin-top:8px;font-size:14px;">${m.source ? escapeHtml(m.source) : ''}</div>
        <div style="font-weight:700;margin-top:2px;">${escapeHtml(m.target)}</div>
        ${VA.examplesBox(sense.examples)}
      </div>`;
  };

  /** Màn báo thiếu dữ liệu để chơi game */
  VA.showNotEnough = function (need, minCount) {
    $('#app').innerHTML = `
      <div class="panel"><div class="empty-state">
        <div class="big">🙈</div>
        Chưa đủ dữ liệu chơi trò này.<br> Cần ít nhất ${minCount} từ có <b>${need}</b> trong kho từ vựng.
        <div class="row" style="justify-content:center;margin-top:16px;">
          <button class="btn ghost" id="backToMenu2">← Quay lại</button>
          <button class="btn" id="addMoreGameBtn">＋ Thêm từ mới</button>
        </div>
      </div></div>`;
    $('#backToMenu2').onclick = () => { VA.state.gameScreen = 'menu'; VA.renderGamesTab(); };
    $('#addMoreGameBtn').onclick = () => VA.openModal('new');
  };
})();
