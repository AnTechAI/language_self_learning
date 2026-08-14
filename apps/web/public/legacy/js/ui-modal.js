/**
 * ui-modal.js — Modal thêm / sửa từ.
 * Trường nghĩa đích (vi/zh…) thay đổi theo ngôn ngữ đang học:
 * đang học "Anh → Trung" thì textarea là "Nghĩa tiếng Trung", lưu vào meaning.zh.
 */
(function () {
  const VA = window.VocabApp;
  const { $, $$, escapeHtml } = VA;

  VA.openModal = function (id) {
    if (id === 'new') {
      VA.modalDraft = {
        id: VA.uid(), word: '', tags: [], dateAdded: new Date().toISOString(),
        learningStatus: 'new', correctStreak: 0, wordRoot: '', synonyms: [], antonyms: [],
        senses: [{ pronunciation: '', partOfSpeech: 'noun', meaning: {}, examples: [] }],
      };
    } else {
      const found = VA.state.entries.find((e) => e.id === id);
      VA.modalDraft = JSON.parse(JSON.stringify(found));
    }
    renderModal();
  };

  VA.closeModal = function () {
    VA.modalDraft = null;
    const bg = document.getElementById('modalBg');
    if (bg) bg.remove();
  };

  function renderModal() {
    let bg = document.getElementById('modalBg');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'modalBg';
      bg.className = 'modal-bg';
      document.body.appendChild(bg);
    }
    const d = VA.modalDraft;
    const isNew = !VA.state.entries.find((e) => e.id === d.id);
    const course = VA.getCourse();

    bg.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h2 style="margin:0;">${isNew ? '＋ Thêm từ mới' : '✏️ Sửa từ'}</h2>
          <button class="close-x" id="closeModalBtn">×</button>
        </div>
        <small class="help">${isNew ? (course.dictLookup
          ? 'Nhập từ → bấm "🔍 Tra từ điển" để tự điền nghĩa, loại từ, ví dụ (tra từ điển máy 207k từ, offline). Phiên âm có thể để trống. Từ không có trong máy sẽ tra API online. Rồi bổ sung nghĩa ' + course.target.label + '.'
          : 'Nhập chữ Hán + phiên âm pinyin + nghĩa ' + course.target.label + '.') : ''}</small>

        <label>${course.wordFieldLabel}</label>
        <div class="row">
          <input type="text" id="wordInput" value="${escapeHtml(d.word)}" placeholder="${course.wordFieldPh}" class="grow">
          ${course.dictLookup ? `<button class="btn sm soft" id="lookupBtn" type="button">🔍 Tra từ điển</button>` : ''}
        </div>
        <small class="help" id="lookupStatus"></small>

        <label>Chủ đề / tag (ngăn cách bằng dấu phẩy)</label>
        <input type="text" id="tagsInput" value="${escapeHtml((d.tags || []).join(', '))}" placeholder="vd: business, travel">

        <label>Gốc từ (tuỳ chọn)</label>
        <input type="text" id="rootInput" value="${escapeHtml(d.wordRoot || '')}" placeholder="vd: bene (well) + volens (wishing)">

        <h3 style="margin-top:16px;">Các nghĩa</h3>
        <div id="sensesContainer"></div>
        <button class="btn sm ghost" id="addSenseBtn" type="button" style="margin-top:10px;">＋ Thêm nghĩa khác</button>

        <div class="divider"></div>
        <div class="row">
          <button class="btn" id="saveWordBtn" style="flex:1;">Lưu lại</button>
          <button class="btn ghost" id="cancelWordBtn">Hủy</button>
        </div>
      </div>
    `;
    renderSenses();
    $('#closeModalBtn').onclick = VA.closeModal;
    $('#cancelWordBtn').onclick = VA.closeModal;
    $('#wordInput').oninput = (e) => (d.word = e.target.value);
    $('#tagsInput').oninput = (e) => (d.tags = VA.splitList(e.target.value));
    $('#rootInput').oninput = (e) => (d.wordRoot = e.target.value.trim());
    $('#addSenseBtn').onclick = () => {
      d.senses.push({ pronunciation: '', partOfSpeech: 'noun', meaning: {}, examples: [] });
      renderSenses();
    };
    $('#saveWordBtn').onclick = saveWordFromModal;
    const lb = $('#lookupBtn');
    if (lb) lb.onclick = doLookup;
    $('#wordInput').focus();
  }

  function renderSenses() {
    const d = VA.modalDraft;
    const container = $('#sensesContainer');
    const course = VA.getCourse();
    const srcCode = course.source.code;
    const targetCode = course.target.code;

    container.innerHTML = d.senses.map((s, i) => {
      const m = s.meaning || {};
      return `
        <div class="sense-block" data-idx="${i}">
          <div class="sense-head">
            <span>Nghĩa ${i + 1}</span>
            ${d.senses.length > 1 ? `<button class="icon-btn remove-sense" data-idx="${i}">✕ Xóa</button>` : ''}
          </div>
          <div class="row">
            <div class="grow">
              <label>${course.pronunciationLabel}</label>
              <input type="text" class="sense-pron" data-idx="${i}" value="${escapeHtml(s.pronunciation)}" placeholder="${course.pronunciationPh}">
            </div>
            <div style="min-width:130px;">
              <label>Loại từ</label>
              <select class="sense-pos" data-idx="${i}">
                ${['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'other'].map((p) => `<option value="${p}" ${s.partOfSpeech === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>
          ${course.dictLookup ? `<label>Nghĩa tiếng ${course.source.label}</label>
          <textarea class="sense-src" data-idx="${i}">${escapeHtml(m[srcCode] || '')}</textarea>` : ''}
          <label>Nghĩa tiếng ${course.target.label}</label>
          <textarea class="sense-target" data-idx="${i}" data-code="${targetCode}">${escapeHtml(m[targetCode] || '')}</textarea>
          <label>Câu ví dụ (mỗi câu một dòng)</label>
          <textarea class="sense-examples" data-idx="${i}">${escapeHtml((s.examples || []).join('\n'))}</textarea>
        </div>`;
    }).join('');

    container.querySelectorAll('.sense-pron').forEach((el) => (el.oninput = (e) => (d.senses[+e.target.dataset.idx].pronunciation = e.target.value)));
    container.querySelectorAll('.sense-pos').forEach((el) => (el.onchange = (e) => (d.senses[+e.target.dataset.idx].partOfSpeech = e.target.value)));
    container.querySelectorAll('.sense-src').forEach((el) => (el.oninput = (e) => { (d.senses[+e.target.dataset.idx].meaning = d.senses[+e.target.dataset.idx].meaning || {})[srcCode] = e.target.value; }));
    container.querySelectorAll('.sense-target').forEach((el) => (el.oninput = (e) => { const m = (d.senses[+e.target.dataset.idx].meaning = d.senses[+e.target.dataset.idx].meaning || {}); m[el.dataset.code] = e.target.value; }));
    container.querySelectorAll('.sense-examples').forEach((el) => (el.oninput = (e) => (d.senses[+e.target.dataset.idx].examples = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))));
    container.querySelectorAll('.remove-sense').forEach((el) => (el.onclick = (e) => { d.senses.splice(+e.target.dataset.idx, 1); renderSenses(); }));
  }

  async function doLookup() {
    const d = VA.modalDraft;
    const statusEl = $('#lookupStatus');
    if (!d.word.trim()) { statusEl.textContent = 'Nhập từ tiếng Anh trước đã.'; statusEl.style.color = 'var(--danger)'; return; }
    statusEl.textContent = 'Đang tra cứu…';
    statusEl.style.color = 'var(--muted)';
    try {
      // 1) Ưu tiên TỪ ĐIỂN MÁY (offline, tải chunk theo nhu cầu) — có sẵn 207k từ
      let r = null, source = '';
      try { r = await VA.bankLookupWord(d.word); } catch (e) { r = null; }
      if (r && r.senses.length) {
        source = 'từ điển máy (offline)';
      } else {
        // 2) Không có trong từ điển máy → gọi API online (kèm phiên âm)
        r = await VA.fetchFromDictionaryApi(d.word);
        source = 'API online';
      }
      const course = VA.getCourse();
      const oldTarget = d.senses.map((s) => (s.meaning || {})[course.target.code]);
      d.senses = r.senses.map((s, i) => ({
        pronunciation: s.pronunciation,
        partOfSpeech: s.partOfSpeech,
        meaning: { en: s.meaning.en || '', ...(s.meaning.vi ? { vi: s.meaning.vi } : {}), ...(oldTarget[i] ? { [course.target.code]: oldTarget[i] } : {}) },
        examples: s.examples || [],
      }));
      d.synonyms = Array.from(new Set([...(d.synonyms || []), ...(r.synonyms || [])]));
      d.antonyms = Array.from(new Set([...(d.antonyms || []), ...(r.antonyms || [])]));
      renderSenses();
      statusEl.textContent = '✓ Đã tự điền (' + source + '). Bổ sung nghĩa ' + course.target.label + ' nhé.';
      statusEl.style.color = 'var(--primary-dark)';
    } catch (err) {
      statusEl.textContent = '✗ ' + err.message + ' Bạn có thể nhập tay.';
      statusEl.style.color = 'var(--danger)';
    }
  }

  function saveWordFromModal() {
    const d = VA.modalDraft;
    const course = VA.getCourse();
    if (!d.word.trim()) { VA.toast('Vui lòng nhập ' + course.wordFieldLabel.toLowerCase()); return; }
    const srcCode = course.source.code;
    const targetCode = course.target.code;
    for (const s of d.senses) {
      if (!(s.meaning || {})[srcCode] || !(s.meaning || {})[targetCode]) {
        if (!confirm('Có nghĩa chưa điền đầy đủ định nghĩa. Vẫn lưu?')) return;
        break;
      }
    }
    const idx = VA.state.entries.findIndex((e) => e.id === d.id);
    if (idx >= 0) VA.state.entries[idx] = d;
    else VA.state.entries.push(d);
    VA.saveEntries(VA.state.entries);
    VA.closeModal();
    if (VA.state.tab === 'vocab' && VA.state.detailId) VA.renderVocabTab();
    else VA.render();
  }
})();
