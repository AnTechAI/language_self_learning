/**
 * ui-vocab.js — Tab "Từ vựng": chia theo BÀI HỌC (lesson) + danh sách tất cả từ.
 * - Khóa Tiếng Anh: chip chọn [Tất cả từ] / [Bài 1 · chủ đề] … Mở bài học nào
 *   thì 20 từ của bài được TỰ THÊM vào kho (truy xuất theo nhu cầu).
 * - Chi tiết từ: chỉ hiện cốt lõi; thuộc tính phụ trong nút "xem thêm".
 */
(function () {
  const VA = window.VocabApp;
  const { $, $$, escapeHtml } = VA;

  /* ================= Render chính ================= */
  VA.renderVocabTab = function () {
    if (VA.state.detailId) { renderDetail(VA.state.detailId); return; }
    if (VA.getCourse().seed !== 'en') { renderAllWords(false); return; } // khóa khác: danh sách thường
    const had = !!(VA.lessons.manifest && VA.lessons.manifest.length);
    if (!had) {
      VA.ensureLessonsManifest().then(() => VA.renderVocabTab()).catch(() => {});
    }
    if ((VA.lessons.manifest || []).length === 0) { renderAllWords(true); return; }
    if (VA.state.vocabLessonId) { renderLessonView(); return; }
    renderLessonList();
  };

  /* ================= Chip điều hướng bài học ================= */
  function chipsRow(activeId) {
    const lessons = VA.lessons.manifest || [];
    return `
      <div class="chips-row">
        <button class="chip ${!activeId ? 'chip-active' : ''}" data-lesson="">📚 Tất cả từ</button>
        ${lessons.map((l) => `
          <button class="chip ${activeId === l.id ? 'chip-active' : ''}" data-lesson="${escapeHtml(l.id)}">📘 ${escapeHtml(l.title)}</button>`).join('')}
      </div>`;
  }

  function bindChips() {
    $$('.chips-row .chip').forEach((c) => {
      c.onclick = () => {
        VA.state.vocabLessonId = c.dataset.lesson || null;
        VA.state.detailId = null;
        VA.renderVocabTab();
      };
    });
  }

  /* ================= Danh sách BÀI HỌC ================= */
  function renderLessonList() {
    const lessons = VA.lessons.manifest || [];
    const inCourse = new Set(VA.state.entries.filter((e) => e.lessonId).map((e) => e.lessonId));
    $('#app').innerHTML = `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <h2 style="margin:0;">📚 Kho từ vựng theo bài học</h2>
          <button class="btn sm" id="addWordBtn">＋ Thêm từ mới</button>
        </div>
        ${chipsRow(null)}
        <small class="help" style="margin-top:8px;">💡 Mỗi bài học 20 từ. Bấm "Học bài này" để tự thêm từ của bài vào kho rồi học ngay.</small>
      </div>
      <div class="panel" style="padding:10px;">
        <div class="lesson-grid">
          ${lessons.map((l) => {
            const inKho = (VA.state.entries.filter((e) => e.lessonId === l.id)).length;
            const learned = VA.state.entries.filter((e) => e.lessonId === l.id && e.learningStatus !== 'new').length;
            const pct = Math.round((learned / l.count) * 100);
            return `
            <div class="lesson-card">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;">📘 ${escapeHtml(l.title)}</h3>
                <span class="badge new">${l.count} từ</span>
              </div>
              <div class="meta" style="margin-top:6px;">
                ${inKho > 0
                  ? `Đã thêm <b>${inKho}/${l.count}</b> · đã học <b>${learned}</b> từ`
                  : inCourse.has(l.id) ? 'Đã thêm vào kho' : 'Chưa thêm vào kho'}
              </div>
              ${inKho > 0 ? `<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>` : ''}
              <div class="row" style="margin-top:10px;">
                <button class="btn sm" data-learn="${escapeHtml(l.id)}">📖 Học bài này</button>
                <button class="btn sm ghost" data-open="${escapeHtml(l.id)}">Xem từ</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    $('#addWordBtn').onclick = () => VA.openModal('new');
    bindChips();
    $$('[data-learn]').forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.learn;
        const added = await VA.ensureLessonInCourse(id);
        VA.state.tab = 'home';
        VA.state.lessonFocus = id;
        if (added) VA.toast(`✓ Đã thêm ${added} từ của bài vào kho`);
        VA.render();
      };
    });
    $$('[data-open]').forEach((b) => {
      b.onclick = async () => {
        VA.state.vocabLessonId = b.dataset.open;
        const added = await VA.ensureLessonInCourse(b.dataset.open);
        if (added) VA.toast(`✓ Đã thêm ${added} từ của bài vào kho`);
        VA.renderVocabTab();
      };
    });
  }

  /* ================= Xem từ của 1 BÀI HỌC ================= */
  async function renderLessonView() {
    const id = VA.state.vocabLessonId;
    const meta = VA.lessonById(id);
    const lesson = await VA.loadLesson(id);
    if (!lesson || !meta) { VA.state.vocabLessonId = null; VA.renderVocabTab(); return; }
    const added = await VA.ensureLessonInCourse(id);
    const entries = VA.state.entries.filter((e) => e.lessonId === id);
    const learned = entries.filter((e) => e.learningStatus !== 'new').length;
    const pct = Math.round((learned / meta.count) * 100);

    $('#app').innerHTML = `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <h2 style="margin:0;">📘 ${escapeHtml(meta.title)}</h2>
          <div class="row">
            <button class="btn sm" id="learnThisBtn">📖 Học bài này</button>
            <button class="btn sm ghost" id="backLessonsBtn">← Về danh sách bài</button>
          </div>
        </div>
        <div class="meta" style="margin-top:8px;">🏷️ Chủ đề: ${escapeHtml(meta.tag)} · ${entries.length}/${meta.count} từ đã thêm · đã học <b>${learned}</b></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        ${chipsRow(id)}
      </div>
      <div class="panel" style="padding:10px;">
        <ul class="word-list">
          ${entries.map((e) => wordItemHTML(e)).join('')}
        </ul>
      </div>`;

    if (added > 0) VA.toast(`✓ Tự thêm ${added} từ của bài vào kho`);
    bindChips();
    $('#backLessonsBtn').onclick = () => { VA.state.vocabLessonId = null; VA.renderVocabTab(); };
    $('#learnThisBtn').onclick = () => { VA.state.tab = 'home'; VA.state.lessonFocus = id; VA.render(); };
    bindWordItems();
  }

  /* ================= TẤT CẢ TỪ (tìm kiếm/lọc) ================= */
  function renderAllWords(noLessonsBanner) {
    const entries = VA.state.entries;
    const f = VA.state.vocabFilter;
    const allTags = Array.from(new Set(entries.flatMap((e) => e.tags || []))).sort();

    let filtered = entries.filter((e) => {
      if (f.status !== 'all' && e.learningStatus !== f.status) return false;
      if (f.tag !== 'all' && !(e.tags || []).includes(f.tag)) return false;
      if (f.search) {
        const s = f.search.toLowerCase();
        const hay = [e.word, ...(e.senses || []).map((sn) => Object.values((sn.meaning || {}))).flat(), ...(e.senses || []).map((sn) => sn.pronunciation || '')].join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });

    $('#app').innerHTML = `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <h2 style="margin:0;">Kho từ vựng <span class="muted" style="font-size:13px;">(${entries.length} từ)</span></h2>
          <button class="btn sm" id="addWordBtn">＋ Thêm từ mới</button>
        </div>
        ${VA.getCourse().seed === 'en' ? chipsRow(null) : ''}
        ${noLessonsBanner ? `<small class="help" style="margin-top:8px;">💡 Chưa có bài học — chạy <code>node tools/build-lessons.js</code> để tạo các bài 20 từ từ english-dictionary.jsonl.</small>` : ''}
        <div class="row" style="margin-top:12px;">
          <input type="search" id="searchInput" placeholder="Tìm từ hoặc nghĩa..." value="${escapeHtml(f.search)}" class="grow">
          <select id="statusFilter" style="width:auto;">
            <option value="all">Mọi trạng thái</option>
            <option value="new">Mới</option>
            <option value="learning">Đang học</option>
            <option value="mastered">Đã thuộc</option>
          </select>
          <select id="tagFilter" style="width:auto;">
            <option value="all">Mọi chủ đề</option>
            ${allTags.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
          </select>
        </div>
        <small class="help" style="margin-top:8px;">💡 Bấm vào một từ để xem chi tiết. Thuộc tính phụ (đồng nghĩa, trái nghĩa, chủ đề…) nằm trong các nút "xem thêm".</small>
      </div>
      <div class="panel" style="padding:10px;">
        ${filtered.length === 0
          ? `<div class="empty-state"><div class="big">📭</div>Chưa có từ nào phù hợp. Bấm "Thêm từ mới" hoặc mở một bài học để bắt đầu.</div>`
          : `<ul class="word-list">${filtered.map((e) => wordItemHTML(e)).join('')}</ul>`}
      </div>`;

    $('#statusFilter').value = f.status;
    $('#tagFilter').value = f.tag;
    $('#addWordBtn').onclick = () => VA.openModal('new');
    if (VA.getCourse().seed === 'en') bindChips();
    $('#searchInput').oninput = (e) => { f.search = e.target.value; VA.renderVocabTab(); };
    $('#statusFilter').onchange = (e) => { f.status = e.target.value; VA.renderVocabTab(); };
    $('#tagFilter').onchange = (e) => { f.tag = e.target.value; VA.renderVocabTab(); };
    bindWordItems();
  }

  /** 1 dòng từ trong danh sách (dùng chung cho bài học + tất cả từ) */
  function wordItemHTML(e) {
    const s0 = (e.senses && e.senses[0]) || {};
    const m = VA.meaning(s0);
    return `
      <li class="word-item" data-id="${e.id}">
        <span class="status-dot ${e.learningStatus}" title="${VA.statusLabel(e.learningStatus)}"></span>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="w">${escapeHtml(e.word)}</span>
            ${VA.posChips(e)}
          </div>
          <div class="meta">
            ${s0.pronunciation ? `<span>${escapeHtml(s0.pronunciation)}</span>` : ''}
            ${m.target ? `<span>— ${escapeHtml(m.target)}</span>` : `<span class="muted">— chưa có bản dịch ${VA.getCourse().target.label}</span>`}
          </div>
        </div>
        <span class="badge ${e.learningStatus}">${VA.statusLabel(e.learningStatus)}</span>
        <span class="chev">›</span>
      </li>`;
  }

  function bindWordItems() {
    $$('.word-item').forEach((el) => {
      el.onclick = () => { VA.state.detailId = el.dataset.id; VA.renderVocabTab(); };
    });
  }

  /* ---------- Chi tiết từ ---------- */
  function renderDetail(id) {
    const e = VA.state.entries.find((x) => x.id === id);
    if (!e) { VA.state.detailId = null; VA.renderVocabTab(); return; }
    const syn = e.synonyms || [];
    const ant = e.antonyms || [];
    const tags = e.tags || [];
    const s0 = (e.senses && e.senses[0]) || {};
    const m = VA.meaning(s0);
    const course = VA.getCourse();
    const lessonMeta = e.lessonId ? VA.lessonById(e.lessonId) : null;

    $('#app').innerHTML = `
      <button class="btn sm ghost" id="backToListBtn" style="margin-bottom:12px;">← Quay lại danh sách</button>
      <div class="panel">
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div class="detail-word">${escapeHtml(e.word)}</div>
            <div class="row" style="margin-top:8px;">
              ${s0.pronunciation ? `<span class="ipa-chip">${escapeHtml(s0.pronunciation)}</span>` : ''}
              ${VA.posChips(e)}
              <span class="badge ${e.learningStatus}">${VA.statusLabel(e.learningStatus)}</span>
            </div>
          </div>
          <button class="speak-btn" id="detailSpeak" data-speak="${escapeHtml(e.word)}" data-lang="${course.source.code}" style="width:44px;height:44px;font-size:20px;">🔈</button>
        </div>

        <div class="section-title"><span class="bar"></span>Nghĩa</div>
        ${m.source ? `<div class="kv"><span class="k">${course.source.label}</span><span>${escapeHtml(m.source)}</span></div>` : ''}
        <div class="kv" style="margin-top:8px;"><span class="k">${course.target.label}</span><span style="font-weight:600;">${escapeHtml(m.target) || '<span class="muted">Chưa có bản dịch — bấm "Sửa" để thêm</span>'}</span></div>
        ${m.target ? `<div style="text-align:right;margin-top:4px;"><button class="speak-btn" data-speak="${escapeHtml(m.target)}" data-lang="${course.target.code}" title="Nghe nghĩa ${course.target.label}">🔈</button></div>` : ''}

        <div class="section-title"><span class="bar"></span>Ví dụ</div>
        ${VA.examplesBox(s0.examples) || `<div class="muted" style="font-size:13px;">Chưa có ví dụ.</div>`}

        ${(e.senses && e.senses.length > 1) ? `
          <div class="section-title"><span class="bar"></span>Các nghĩa khác (${e.senses.length - 1})</div>
          <button class="collapse-btn" data-toggle="senses">📚 Xem thêm ${e.senses.length - 1} nghĩa khác</button>
          <div class="collapse-body" data-body="senses">
            ${e.senses.slice(1).map((s) => {
              const mm = VA.meaning(s);
              return `
                <div style="border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;">
                  <div class="row"><span class="pos-chip">${escapeHtml(s.partOfSpeech || '')}</span> ${s.pronunciation ? `<span class="ipa-chip">${escapeHtml(s.pronunciation)}</span>` : ''}</div>
                  <div style="font-size:13.5px;margin-top:6px;">${escapeHtml(mm.source)}</div>
                  <div style="font-weight:600;margin-top:2px;">${escapeHtml(mm.target)}</div>
                </div>`;
            }).join('')}
          </div>` : ''}

        <div class="section-title"><span class="bar"></span>Thuộc tính khác — bấm để xem thêm</div>
        <div class="row" style="gap:8px;flex-wrap:wrap;">
          ${lessonMeta ? `<button class="collapse-btn" data-toggle="lesson">📘 Bài học <span class="cnt">${escapeHtml(lessonMeta.title)}</span></button>` : ''}
          ${syn.length ? `<button class="collapse-btn" data-toggle="syn">🔁 Đồng nghĩa <span class="cnt">${syn.length}</span></button>` : ''}
          ${ant.length ? `<button class="collapse-btn" data-toggle="ant">↔️ Trái nghĩa <span class="cnt">${ant.length}</span></button>` : ''}
          ${tags.length ? `<button class="collapse-btn" data-toggle="tag">🏷️ Chủ đề <span class="cnt">${tags.length}</span></button>` : ''}
          ${e.wordRoot ? `<button class="collapse-btn" data-toggle="root">🌿 Gốc từ</button>` : ''}
          ${e.dateAdded ? `<button class="collapse-btn" data-toggle="date">🗓️ Ngày thêm</button>` : ''}
        </div>
        <div class="collapse-body" data-body="lesson">📘 ${escapeHtml(lessonMeta ? lessonMeta.title : '')}</div>
        <div class="collapse-body" data-body="syn">${syn.map((s) => `<span class="tag syn-chip" style="margin:3px;">${escapeHtml(s)}</span>`).join('')}</div>
        <div class="collapse-body" data-body="ant">${ant.map((s) => `<span class="tag ant-chip" style="margin:3px;">${escapeHtml(s)}</span>`).join('')}</div>
        <div class="collapse-body" data-body="tag">${tags.map((s) => `<span class="tag" style="margin:3px;">${escapeHtml(s)}</span>`).join('')}</div>
        <div class="collapse-body" data-body="root">${escapeHtml(e.wordRoot || '')}</div>
        <div class="collapse-body" data-body="date">${escapeHtml((e.dateAdded || '').slice(0, 10))}</div>

        <div class="divider"></div>
        <div class="row" style="justify-content:flex-end;">
          <button class="btn sm ghost" id="cycleStatusBtn">${e.learningStatus === 'mastered' ? '↩️ Đặt lại "Mới"' : e.learningStatus === 'learning' ? '⭐ Đánh dấu đã thuộc' : '▶️ Bắt đầu học'}</button>
          <button class="btn sm ghost" id="editWordBtn">✏️ Sửa</button>
          <button class="btn sm danger" id="deleteWordBtn">🗑️ Xóa</button>
        </div>
      </div>`;

    $('#backToListBtn').onclick = () => { VA.state.detailId = null; VA.renderVocabTab(); };
    $('#detailSpeak').onclick = () => VA.speak($('#detailSpeak').dataset.speak, $('#detailSpeak').dataset.lang);
    VA.bindCardActions(document.querySelector('.panel'));
    $('#editWordBtn').onclick = () => VA.openModal(e.id);
    $('#deleteWordBtn').onclick = () => {
      if (confirm('Xóa từ "' + e.word + '" khỏi kho từ vựng?')) {
        VA.state.entries = VA.state.entries.filter((x) => x.id !== e.id);
        VA.saveEntries(VA.state.entries);
        VA.state.detailId = null;
        VA.renderVocabTab();
      }
    };
    $('#cycleStatusBtn').onclick = () => {
      if (e.learningStatus === 'mastered') { e.learningStatus = 'new'; e.correctStreak = 0; VA.toast('Đã đặt lại "Mới"'); }
      else if (e.learningStatus === 'learning') { e.learningStatus = 'mastered'; VA.toast('🎉 Đã đánh dấu thuộc!'); }
      else { VA.markLearned(e); VA.toast('✓ Bắt đầu học "' + e.word + '"'); }
      VA.saveEntries(VA.state.entries);
      renderDetail(e.id);
    };
  }
})();
