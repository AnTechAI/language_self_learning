/**
 * ui-games.js — Tab "Ôn tập": menu game + 4 game.
 * Dịch nghĩa có gợi ý lộ dần kí tự (hỗ trợ mọi ngôn ngữ, kể cả chữ Trung),
 * ngôn ngữ đích thay đổi theo cặp ngôn ngữ đang chọn.
 */
(function () {
  const VA = window.VocabApp;
  const { $, $$, escapeHtml } = VA;

  VA.renderGamesTab = function () {
    if (VA.state.gameScreen !== 'menu') return; // game đang chạy tự render
    // Bài học: chờ manifest rồi render lại để có bộ chọn phạm vi
    const isEn = VA.getCourse().seed === 'en';
    if (isEn && !(VA.lessons.manifest && VA.lessons.manifest.length)) {
      VA.ensureLessonsManifest().then(() => VA.renderGamesTab()).catch(() => {});
    }
    const scopeLesson = VA.state.gameLessonId ? VA.lessonById(VA.state.gameLessonId) : null;
    const pool = VA.state.entries.filter((e) => e.senses && VA.hasTarget(e)
      && (!VA.state.gameLessonId || e.lessonId === VA.state.gameLessonId));
    const synPool = pool.filter((e) => (e.synonyms || []).length > 0);
    const antPool = pool.filter((e) => (e.antonyms || []).length > 0);
    const qty = parseInt(VA.loadSettings().gameQty, 10) || 0;
    const lessons = (isEn && VA.lessons.manifest) ? VA.lessons.manifest : [];
    $('#app').innerHTML = `
      <div class="panel">
        <h2>Chọn hình thức ôn tập</h2>
        <div class="game-options">
          <span class="lbl">Phạm vi:</span>
          <select id="scopeSelect">
            <option value="">Tất cả từ trong kho (${VA.state.entries.length})</option>
            ${lessons.map((l) => `<option value="${escapeHtml(l.id)}" ${VA.state.gameLessonId === l.id ? 'selected' : ''}>📘 ${escapeHtml(l.title)}</option>`).join('')}
          </select>
          <span class="lbl">Số câu mỗi lượt:</span>
          <select id="qtySelect">
            <option value="10">10 câu</option>
            <option value="20">20 câu</option>
            <option value="50">50 câu</option>
            <option value="0">Tất cả (${pool.length})</option>
          </select>
          <small class="help" style="margin:0;">Trả lời sai sẽ được hỏi lại cuối phiên 🔁 ${scopeLesson ? '· Đang ôn bài: ' + escapeHtml(scopeLesson.title) : ''}</small>
        </div>
        <div class="game-menu">
          <button class="game-card" data-game="flashcard">
            <div class="gi">🗂️</div>
            <h3>Flashcard</h3>
            <p>Bấm lật thẻ xem nghĩa, tự đánh giá nhớ hay chưa.</p>
            <div class="game-count">📖 ${pool.length} từ</div>
          </button>
          <button class="game-card" data-game="translate">
            <div class="gi">✍️</div>
            <h3>Dịch nghĩa <span class="pos-chip" style="vertical-align:middle;">💡 có hint</span></h3>
            <p>Đoán từ theo nghĩa + loại từ. Bấm gợi ý để lộ dần từng kí tự.</p>
            <div class="game-count">📖 ${pool.length} từ</div>
          </button>
          ${synPool.length ? `<button class="game-card" data-game="synonym">
            <div class="gi">🔁</div>
            <h3>Chọn từ đồng nghĩa</h3>
            <p>Trắc nghiệm 4 lựa chọn.</p>
            <div class="game-count">📖 ${synPool.length} từ</div>
          </button>` : ''}
          ${antPool.length ? `<button class="game-card" data-game="antonym">
            <div class="gi">↔️</div>
            <h3>Chọn từ trái nghĩa</h3>
            <p>Trắc nghiệm 4 lựa chọn.</p>
            <div class="game-count">📖 ${antPool.length} từ</div>
          </button>` : ''}
        </div>
        ${!synPool.length && !antPool.length ? `<small class="help">💡 Trò "Chọn từ đồng nghĩa / trái nghĩa" cần kho từ có dữ liệu đồng nghĩa — khóa học này chưa có. Bạn có thể thêm đồng nghĩa khi sửa một từ.</small>` : ''}
      </div>`;
    $('#qtySelect').value = String(qty);
    $('#qtySelect').onchange = (e) => {
      const s = VA.loadSettings();
      s.gameQty = parseInt(e.target.value, 10) || 0;
      VA.saveSettings(s);
    };
    $('#scopeSelect').onchange = async (e) => {
      VA.state.gameLessonId = e.target.value || null;
      if (VA.state.gameLessonId) {
        const added = await VA.ensureLessonInCourse(VA.state.gameLessonId);
        if (added) VA.toast('✓ Đã thêm ' + added + ' từ của bài vào kho');
      }
      VA.renderGamesTab();
    };
    $$('.game-card').forEach((el) => {
      el.onclick = () => { VA.state.gameScreen = el.dataset.game; VA.startGame(el.dataset.game); };
    });
  };

  /** Đánh dấu từ sai (thêm vào danh sách ôn lại cuối phiên) */
  function markMissed(s, id) {
    if (!s.missed.includes(id)) s.missed.push(id);
  }

  /** Trả lời sai → đưa từ vào CUỐI hàng đợi để hỏi lại (tối đa 1 lần lặp/từ) */
  function requeueIfWrong(s, entry) {
    const c = s.repeated[entry.id] || 0;
    if (c < 1) {
      s.queue.push(entry);
      s.repeated[entry.id] = c + 1;
    }
  }

  /** Trả lời ĐÚNG → gỡ từ khỏi danh sách "chưa nhớ" (đã nhớ sau khi hỏi lại) */
  function unmarkMissed(s, id) {
    s.missed = s.missed.filter((x) => x !== id);
  }

  /**
   * Bắt đầu 1 game.
   * @param {string} type - flashcard | translate | synonym | antonym
   * @param {string[]} [onlyIds] - (tuỳ chọn) chỉ chơi với bộ id này (nút "Ôn lại từ sai")
   * Áp dụng cài đặt "Số câu mỗi lượt" (settings.gameQty).
   */
  VA.startGame = function (type, onlyIds) {
    const qty = parseInt(VA.loadSettings().gameQty, 10) || 0;
    let pool = VA.state.entries.filter((e) => e.senses && VA.hasTarget(e)
      && (!onlyIds || onlyIds.includes(e.id))
      && (!VA.state.gameLessonId || e.lessonId === VA.state.gameLessonId));
    const sessionBase = { type, idx: 0, correct: 0, total: 0, streakNow: 0, repeated: {}, missed: [] };

    if (type === 'synonym' || type === 'antonym') {
      const key = type === 'synonym' ? 'synonyms' : 'antonyms';
      const eligible = pool.filter((e) => (e[key] || []).length > 0);
      if (onlyIds) {
        if (!eligible.length) { VA.toast('Không có từ nào cần ôn lại'); VA.state.gameScreen = 'menu'; VA.renderGamesTab(); return; }
        VA.session = { ...sessionBase, key, queue: eligible.slice(0, qty > 0 ? qty : eligible.length) };
        nextChoice();
        return;
      }
      if (eligible.length < 1 || pool.length < 4) {
        VA.showNotEnough(type === 'synonym' ? 'từ đồng nghĩa' : 'từ trái nghĩa', 4);
        return;
      }
      pool = VA.shuffle(eligible);
      if (qty > 0 && pool.length > qty) pool = pool.slice(0, qty);
      VA.session = { ...sessionBase, key, queue: pool };
      nextChoice();
      return;
    }

    if (onlyIds && !pool.length) { VA.toast('Không có từ nào cần ôn lại'); VA.state.gameScreen = 'menu'; VA.renderGamesTab(); return; }
    if (pool.length < 1) { VA.showNotEnough('nghĩa ' + VA.getCourse().target.label, 1); return; }
    pool = VA.shuffle(pool);
    if (qty > 0 && pool.length > qty) pool = pool.slice(0, qty);

    if (type === 'flashcard') {
      VA.session = { ...sessionBase, queue: pool, revealed: false, seenOnce: false };
      renderFlashcard();
    } else if (type === 'translate') {
      VA.session = { ...sessionBase, queue: pool, dir: 't2s', hints: 0 };
      renderTranslate();
    }
  };

  /** Mở flashcard với 1 bộ id cụ thể (nút "Ôn tất cả" ở tab Hôm nay) */
  VA.startFlashcardWith = function (ids) {
    const pool = VA.state.entries.filter((e) => ids.includes(e.id) && e.senses && VA.hasTarget(e));
    if (pool.length === 0) { VA.toast('Không có từ nào để ôn'); return; }
    VA.state.tab = 'games';
    VA.state.gameScreen = 'flashcard';
    VA.session = { type: 'flashcard', queue: pool, idx: 0, correct: 0, total: 0, streakNow: 0, revealed: false, seenOnce: false, repeated: {}, missed: [] };
    VA.render();
  };

  /* ================= Flashcard (lật qua lại thoải mái) ================= */
  function renderFlashcard() {
    const s = VA.session;
    if (s.idx >= s.queue.length) {
      $('#app').innerHTML = VA.gameShell('Flashcard') + VA.summaryPanel();
      VA.bindExit(); VA.bindReplay('flashcard');
      return;
    }
    const entry = s.queue[s.idx];
    const sense = VA.pickSense(entry); // từ đa nghĩa → luyện ngẫu nhiên các nghĩa
    const m = VA.meaning(sense);
    const course = VA.getCourse();
    const sub = s.revealed
      ? 'Bấm thẻ (hoặc Space) để quay lại mặt trước'
      : 'Bấm thẻ (hoặc Space) để xem nghĩa — lật qua lại thoải mái';
    $('#app').innerHTML = VA.gameShell('Flashcard', sub) + `
      <div class="flashcard-wrap">
        <div class="flashcard ${s.revealed ? 'flipped' : ''}" id="cardEl" style="min-height:280px;">
          <div class="face">
            <div class="fc-word">${escapeHtml(entry.word)}</div>
            ${sense.pronunciation ? `<div class="fc-ipa">${escapeHtml(sense.pronunciation)}</div>` : ''}
            <button class="speak-btn fc-speak" data-speak="${escapeHtml(entry.word)}" data-lang="${course.source.code}" title="Nghe phát âm">🔈</button>
            <div class="fc-hint">Bấm vào thẻ hoặc Space để lật qua lại</div>
          </div>
          <div class="face back">
            <div class="fc-vi">${escapeHtml(m.target)}</div>
            ${m.target ? `<button class="speak-btn fc-speak" data-speak="${escapeHtml(m.target)}" data-lang="${course.target.code}" title="Nghe nghĩa ${course.target.label}">🔈</button>` : ''}
            ${m.source ? `<div class="fc-en">${escapeHtml(m.source)}</div>` : ''}
            ${(sense.examples && sense.examples[0]) ? `<div class="fc-en">❝ ${escapeHtml(sense.examples[0])}</div>` : ''}
            <div class="fc-hint">Bấm thẻ hoặc Space để quay lại mặt trước</div>
          </div>
        </div>
      </div>
      ${s.seenOnce ? `
        <div class="fc-actions">
          <button class="btn ghost sm" id="passBtn" title="Bỏ qua từ này, không tính điểm">⏭️ Bỏ qua</button>
          <button class="btn ghost" id="dontKnowBtn">😕 Chưa nhớ</button>
          <button class="btn" id="knowBtn">😎 Đã nhớ</button>
        </div>
        <div class="game-hint"><span class="kbd">Space</span> lật qua lại · <span class="kbd">1</span> chưa nhớ · <span class="kbd">2</span> đã nhớ · <span class="kbd">3</span> bỏ qua</div>` : ''}
    `;
    VA.bindExit();
    VA.bindCardActions($('#app'));
    const card = $('#cardEl');
    card.onclick = () => flipFlashcard();
    const dk = $('#dontKnowBtn'), kb = $('#knowBtn'), pb = $('#passBtn');
    if (dk) dk.onclick = () => answerFlashcard(entry, false);
    if (kb) kb.onclick = () => answerFlashcard(entry, true);
    if (pb) pb.onclick = () => passFlashcard();
  }
  /** Lật qua / lật lại thẻ (bấm thẻ hoặc Space) */
  function flipFlashcard() {
    const s = VA.session;
    if (!s) return;
    if (!s.revealed && !s.seenOnce) s.seenOnce = true; // đã xem nghĩa lần đầu → hiện nút đánh giá
    s.revealed = !s.revealed;
    renderFlashcard();
  }
  /** Bỏ qua từ này: sang thẻ sau, KHÔNG tính điểm, không ghi lịch sử */
  function passFlashcard() {
    const s = VA.session;
    s.idx++;
    s.revealed = false;
    s.seenOnce = false;
    renderFlashcard();
  }
  function answerFlashcard(entry, known) {
    VA.registerResult(entry, known);
    VA.recordHistory('flashcard', entry.id, known);
    const s = VA.session;
    s.total++;
    s.streakNow = known ? (s.streakNow || 0) + 1 : 0;
    if (known) { s.correct++; unmarkMissed(s, entry.id); }
    else {
      markMissed(s, entry.id);
      requeueIfWrong(s, entry);
    }
    s.idx++;
    s.revealed = false;
    s.seenOnce = false;
    renderFlashcard();
  }

  /* ================= Dịch nghĩa (2 chiều, có hint) ================= */
  function renderTranslate() {
    const s = VA.session;
    if (s.idx >= s.queue.length) {
      $('#app').innerHTML = VA.gameShell('Dịch nghĩa') + VA.summaryPanel();
      VA.bindExit(); VA.bindReplay('translate');
      return;
    }
    const entry = s.queue[s.idx];
    const sense = VA.pickSense(entry); // từ đa nghĩa → luyện ngẫu nhiên các nghĩa
    const m = VA.meaning(sense);
    const course = VA.getCourse();
    const dir = s.dir; // 't2s': đích→nguồn (nhìn nghĩa Việt đoán từ), 's2t': ngược lại
    const target = dir === 't2s' ? entry.word : m.target;
    const masked = VA.maskText(target, s.hints);
    const totalChars = VA.countRevealable(target);
    const allRevealed = s.hints >= totalChars;
    const dirLabel = VA.directionLabel(dir === 't2s');

    const promptHtml = dir === 't2s'
      ? `<div class="prompt-card">
           <span class="pos-chip">${escapeHtml(sense.partOfSpeech || '')}</span>
           <div class="p-vi" style="margin-top:8px;">${escapeHtml(m.target)}</div>
           ${m.source ? `<div class="p-en" style="margin-top:4px;">${escapeHtml(m.source)}</div>` : ''}
         </div>`
      : `<div class="prompt-card">
           <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
             <span style="font-size:26px;font-weight:800;">${escapeHtml(entry.word)}</span>
             <button class="speak-btn" data-speak="${escapeHtml(entry.word)}" data-lang="${course.source.code}">🔈</button>
           </div>
           ${sense.pronunciation ? `<div class="muted" style="font-size:13px;">${escapeHtml(sense.pronunciation)}</div>` : ''}
           <span class="pos-chip">${escapeHtml(sense.partOfSpeech || '')}</span>
         </div>`;

    $('#app').innerHTML = VA.gameShell('Dịch nghĩa (' + dirLabel + ')', 'Nhìn nghĩa + loại từ, đoán từ. Dùng 💡 để lộ dần kí tự.') + `
      <div class="panel">
        ${promptHtml}
        <div style="text-align:center;margin:16px 0 4px;">
          <small class="muted" style="font-size:12px;">${dir === 't2s' ? 'Từ ' + course.source.label + ' là:' : 'Nghĩa ' + course.target.label + ' là:'}</small>
          <div class="guess-word" style="margin-top:6px;">${masked.split('').map((c) => c === '_' ? '<span style="color:#c2cad4;">_</span>' : escapeHtml(c)).join('')}</div>
        </div>
        <label>${dir === 't2s' ? 'Gõ từ ' + course.source.label + (course.usesPinyin ? ' (chữ Hán hoặc pinyin):' : ':') : 'Gõ nghĩa ' + course.target.label + ':'}</label>
        <input type="text" id="answerInput" autocomplete="off" placeholder="${dir === 't2s' ? (course.usesPinyin ? 'nǐ hǎo / 你好' : 'approve') : 'đồng ý…'}">
        <div class="row" style="margin-top:12px;">
          <button class="btn ghost sm" id="hintBtn" ${allRevealed ? 'disabled' : ''}>💡 Gợi ý (${s.hints}/${totalChars})</button>
          <button class="btn" id="submitAnswerBtn" style="flex:1;">Kiểm tra</button>
        </div>
        <div id="feedbackArea"></div>
      </div>`;
    VA.bindExit();
    const input = $('#answerInput');
    input.value = s.tempAnswer || '';
    input.focus();
    $('#hintBtn').onclick = () => {
      if (s.hints < totalChars) {
        s.tempAnswer = input.value;
        s.hints++;
        renderTranslate();
      }
    };
    const submit = () => {
      const userAns = input.value;
      const answers = dir === 't2s' ? [entry.word] : entry.senses.map((x) => VA.meaning(x).target);
      const isCorrect = answers.some((a) => VA.normalize(userAns) === VA.normalize(a))
        || (dir === 't2s' && course.usesPinyin && VA.normPinyin(userAns) === VA.normPinyin(sense.pronunciation));
      input.disabled = true;
      $('#submitAnswerBtn').disabled = true;
      $('#hintBtn').disabled = true;
      VA.registerResult(entry, isCorrect);
      VA.recordHistory('translate', entry.id, isCorrect);
      VA.session.total++;
      VA.session.streakNow = isCorrect ? (VA.session.streakNow || 0) + 1 : 0;
      if (isCorrect) { VA.session.correct++; unmarkMissed(VA.session, entry.id); }
      else {
        markMissed(VA.session, entry.id);
        requeueIfWrong(VA.session, entry);
      }
      $('#feedbackArea').innerHTML = `
        <div class="feedback ${isCorrect ? 'ok' : 'no'}">${isCorrect ? '✓ Chính xác! 🎉' : '✗ Chưa đúng.'}</div>
        ${!isCorrect ? '<div class="retry-note">🔁 Từ này sẽ được hỏi lại cuối phiên.</div>' : ''}
        ${VA.resultCard(entry, sense)}
        ${m.target && course.target.code !== course.source.code
          ? `<div style="text-align:right;margin-top:6px;"><button class="speak-btn" data-speak="${escapeHtml(m.target)}" data-lang="${course.target.code}" title="Nghe nghĩa ${course.target.label}">🔈</button></div>` : ''}
        <div class="row" style="margin-top:12px;">
          <button class="btn" id="nextQBtn" style="flex:1;">Câu tiếp →</button>
        </div>`;
      $('#nextQBtn').onclick = () => {
        VA.session.idx++;
        VA.session.dir = Math.random() < 0.5 ? 't2s' : 's2t';
        VA.session.hints = 0;
        VA.session.tempAnswer = '';
        renderTranslate();
      };
      VA.bindCardActions(document.getElementById('feedbackArea'));
    };
    $('#submitAnswerBtn').onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    VA.bindCardActions(document.querySelector('.prompt-card'));
  }

  /* ================= Đồng nghĩa / Trái nghĩa ================= */
  function nextChoice() {
    const s = VA.session;
    if (s.idx >= s.queue.length) { renderChoiceDone(); return; }
    const entry = s.queue[s.idx];
    const correctWord = VA.shuffle(entry[s.key])[0];
    const entryPos = (entry.senses && entry.senses[0] && entry.senses[0].partOfSpeech) || '';
    const others = VA.state.entries.filter((e) => e.word.toLowerCase() !== entry.word.toLowerCase() && e.word.toLowerCase() !== correctWord.toLowerCase());
    let distractorPool = others.filter((e) => (e.senses && e.senses[0] && e.senses[0].partOfSpeech) === entryPos);
    if (distractorPool.length < 3) distractorPool = others;
    const distractorWords = VA.shuffle(Array.from(new Set(distractorPool.map((e) => e.word)))).slice(0, 3);
    const options = VA.shuffle([correctWord, ...distractorWords]);
    s.current = { entry, correctWord, options };
    renderChoice();
  }
  function renderChoice() {
    const s = VA.session;
    const title = s.type === 'synonym' ? 'Chọn từ đồng nghĩa' : 'Chọn từ trái nghĩa';
    const { entry, options } = s.current;
    const course = VA.getCourse();
    $('#app').innerHTML = VA.gameShell(title, 'Từ nào ' + (s.type === 'synonym' ? 'đồng nghĩa' : 'trái nghĩa') + ' với từ bên dưới?') + `
      <div class="panel">
        <div style="text-align:center;padding:8px 0 18px;">
          <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
            <div style="font-size:26px;font-weight:800;">${escapeHtml(entry.word)}</div>
            <button class="speak-btn" data-speak="${escapeHtml(entry.word)}" data-lang="${course.source.code}" title="Nghe phát âm">🔈</button>
          </div>
          ${(entry.senses && entry.senses[0] && entry.senses[0].pronunciation) ? `<div class="muted" style="font-size:13px;">${escapeHtml(entry.senses[0].pronunciation)}</div>` : ''}
          ${VA.posChips(entry)}
        </div>
        <div id="choicesArea">
          ${options.map((o, i) => `<button class="choice-btn" data-word="${escapeHtml(o)}">
            <span class="choice-key">${i + 1}</span>
            <span class="choice-text">${escapeHtml(o)}</span>
            <span class="speak-btn" data-speak="${escapeHtml(o)}" data-lang="${course.source.code}" title="Nghe phát âm">🔈</span>
          </button>`).join('')}
        </div>
        <div class="game-hint"><span class="kbd">1</span>–<span class="kbd">4</span> chọn đáp án nhanh</div>
        <div id="feedbackArea"></div>
      </div>`;
    VA.bindExit();
    VA.bindCardActions($('#app'));
    $$('.choice-btn').forEach((btn) => (btn.onclick = () => answerChoice(btn.dataset.word)));
  }
  function answerChoice(chosen) {
    const s = VA.session;
    const { entry, correctWord } = s.current;
    const isCorrect = VA.normalize(chosen) === VA.normalize(correctWord);
    $$('.choice-btn').forEach((btn) => {
      btn.disabled = true;
      if (VA.normalize(btn.dataset.word) === VA.normalize(correctWord)) btn.classList.add('correct');
      else if (btn.dataset.word === chosen) btn.classList.add('wrong');
    });
    VA.registerResult(entry, isCorrect);
    VA.recordHistory(s.type, entry.id, isCorrect);
    s.total++;
    s.streakNow = isCorrect ? (s.streakNow || 0) + 1 : 0;
    if (isCorrect) { s.correct++; unmarkMissed(s, entry.id); }
    else {
      markMissed(s, entry.id);
      requeueIfWrong(s, entry);
    }
    $('#feedbackArea').innerHTML = `
      <div class="feedback ${isCorrect ? 'ok' : 'no'}">
        ${isCorrect ? '✓ Chính xác!' : `✗ Chưa đúng. Đáp án: <b>${escapeHtml(correctWord)}</b>`}
      </div>
      ${!isCorrect ? '<div class="retry-note">🔁 Từ này sẽ được hỏi lại cuối phiên.</div>' : ''}
      <div class="row" style="margin-top:12px;"><button class="btn" id="nextQBtn" style="flex:1;">Câu tiếp →</button></div>`;
    $('#nextQBtn').onclick = () => { s.idx++; nextChoice(); };
  }
  function renderChoiceDone() {
    const title = VA.session.type === 'synonym' ? 'Chọn từ đồng nghĩa' : 'Chọn từ trái nghĩa';
    $('#app').innerHTML = VA.gameShell(title) + VA.summaryPanel();
    VA.bindExit();
    VA.bindReplay(VA.session.type);
  }

  // Phím tắt toàn cục: Space lật thẻ · 1/2/3 flashcard · 1-4 chọn đáp án
  document.addEventListener('keydown', (e) => {
    const s = VA.session;
    if (!s || VA.state.tab !== 'games' || VA.state.gameScreen === 'menu') return;
    if (s.type === 'flashcard') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!s.revealed) flipFlashcard();
        else if (e.key === ' ') flipFlashcard(); // Space lật QUA LẠI thoải mái
        else if (e.key === 'Enter') answerFlashcard(s.queue[s.idx], true); // Enter xác nhận "đã nhớ"
        return;
      }
      if (s.seenOnce && e.key === '1') answerFlashcard(s.queue[s.idx], false);
      else if (s.seenOnce && e.key === '2') answerFlashcard(s.queue[s.idx], true);
      else if (s.seenOnce && e.key === '3') passFlashcard();
    } else if (s.type === 'synonym' || s.type === 'antonym') {
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0 && s.current && i < s.current.options.length) {
        const btn = $$('.choice-btn')[i];
        if (btn && !btn.disabled) answerChoice(s.current.options[i]);
      }
    }
  });

  // Expose để kiểm thử / gỡ lỗi
  VA.renderFlashcard = renderFlashcard;
  VA.answerFlashcard = answerFlashcard;
  VA.flipFlashcard = flipFlashcard;
  VA.passFlashcard = passFlashcard;
  VA.renderTranslate = renderTranslate;
  VA.answerChoice = answerChoice;
})();
