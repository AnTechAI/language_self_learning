/**
 * bank-loader.js — TỪ ĐIỂN NGOẠI TUYẾN truy xuất THEO NHU CẦU.
 *
 * english-dictionary.jsonl (207k từ, 41MB) đã được tools/build-chunks.js chia
 * thành các chunk nhỏ trong js/bank/. App KHÔNG nạp toàn bộ — chỉ khi cần tra
 * từ nào đó mới chèn <script> của ĐÚNG 1 chunk chứa từ đó (chạy tốt trên file://).
 *
 * Cơ chế:
 *   VA.bankInit(names)          — khai báo danh sách chunk (từ manifest.js)
 *   VA.bankHash(word)           — FNV-1a 32-bit
 *   VA.bankChunkName(word)      — tên chunk chứa từ = chunk-HASH%N.js
 *   VA.bankLookup(word)         — (async) load chunk cần thiết → trả mọi entry khớp
 *   VA.bankLookupWord(word)     — (async) trả {senses, synonyms, antonyms} cho modal
 *   VA.bankRegister(name, rows) — chunk IIFE gọi để nạp dữ liệu vào bộ nhớ
 */
(function () {
  const VA = window.VocabApp;

  const bank = {
    manifest: null,   // ['chunk-000.js', ...] — nạp chậm từ manifest.js
    loaded: new Map(),// chunkName -> rows
    pending: new Map(),// chunkName -> [resolve, reject]
  };
  VA.bank = bank;

  /** Đăng ký danh sách chunk (manifest.js gọi) */
  VA.bankInit = function (names) {
    bank.manifest = Array.isArray(names) ? names : [];
  };

  /** Băm FNV-1a 32-bit */
  VA.bankHash = function (word) {
    let h = 0x811c9dc5;
    const w = String(word || '').toLowerCase();
    for (let i = 0; i < w.length; i++) {
      h ^= w.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  };

  /** Tên chunk chứa từ (không cần tải manifest nếu đã biết số chunk) */
  VA.bankChunkName = function (word) {
    const n = (bank.manifest || []).length;
    if (!n) return null;
    return 'chunk-' + String(VA.bankHash(word) % n).padStart(3, '0') + '.js';
  };

  /** Chunk IIFE gọi để nộp dữ liệu */
  VA.bankRegister = function (name, rows) {
    bank.loaded.set(name, rows || []);
    const p = bank.pending.get(name);
    if (p) { bank.pending.delete(name); p[0](); }
  };

  function loadManifest() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/bank/manifest.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Không tải được js/bank/manifest.js (thiếu chunk? hãy chạy node data/scripts/cli.js chunks)'));
      document.head.appendChild(s);
    });
  }

  /** Tải 1 chunk (chèn <script> động — hoạt động trên file://) */
  function loadChunk(name) {
    if (bank.loaded.has(name)) return Promise.resolve();
    const existing = bank.pending.get(name);
    if (existing) { // đang tải dở → chờ cùng promise
      return new Promise((resolve, reject) => { existing.push(resolve, reject); });
    }
    return new Promise((resolve, reject) => {
      bank.pending.set(name, [resolve, reject]);
      const head = document.head || document.getElementsByTagName('head')[0] || document.body;
      const s = document.createElement('script');
      s.src = 'js/bank/' + name;
      s.onerror = () => { bank.pending.delete(name); reject(new Error('Không tải được js/bank/' + name)); };
      head.appendChild(s);
      // onload không cần — chunk IIFE gọi bankRegister → resolve
    });
  }

  /** Tra từ trong từ điển ngoại tuyến — trả mọi entry khớp (mọi nghĩa/loại từ) */
  VA.bankLookup = async function (word) {
    const w = String(word || '').toLowerCase().trim();
    if (!w) return [];
    if (!bank.manifest) await loadManifest();
    const name = VA.bankChunkName(w);
    if (!name) return [];
    try { await loadChunk(name); } catch (e) { return []; } // chunk hỏng/thiếu → coi như không có từ
    const rows = bank.loaded.get(name) || [];
    return rows.filter((r) => r[0] === w);
  };

  /** Giao diện cho modal Thêm từ — trả {senses, synonyms, antonyms} giống API online */
  VA.bankLookupWord = async function (word) {
    const rows = await VA.bankLookup(word);
    if (!rows.length) return null;
    const senses = rows.map((r) => ({
      pronunciation: r[7] || '',
      partOfSpeech: r[1] || '',
      meaning: { en: r[2] || '', ...(r[6] ? { vi: r[6] } : {}) },
      examples: r[3] ? [r[3]] : [],
    }));
    const syn = new Set(), ant = new Set();
    rows.forEach((r) => { (r[4] || []).forEach((s) => syn.add(s)); (r[5] || []).forEach((a) => ant.add(a)); });
    return { senses, synonyms: [...syn].slice(0, 8), antonyms: [...ant].slice(0, 8) };
  };
})();
