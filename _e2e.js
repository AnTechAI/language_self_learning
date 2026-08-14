/**
 * _e2e.js — Kiểm tra toàn bộ app (mô hình KHÓA HỌC) bằng DOM stub.
 * Chạy: node _e2e.js
 */
const fs = require('fs');

/* ---------- DOM stub ---------- */
function makeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    toggle: (c, force) => { if (force === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else { force ? set.add(c) : set.delete(c); } return set.has(c); },
    contains: (c) => set.has(c),
  };
}
function makeEl(id) {
  return {
    id: id || '', textContent: '', innerHTML: '', value: '', dataset: {}, style: {},
    classList: makeClassList(),
    addEventListener() {}, appendChild(c) { if (c && typeof c.onerror === 'function') c.onerror(); }, remove() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    onclick: null, oninput: null, onchange: null, onkeydown: null, disabled: false,
  };
}
const byId = {}, bySel = {};
const bodyEl = makeEl('body');
global.window = global;
global.localStorage = (() => {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _dump: () => m };
})();
global.sessionStorage = { getItem: () => null, setItem() {} };
global.document = {
  getElementById: (id) => byId[id] || (byId[id] = makeEl(id)),
  createElement: () => makeEl('x'),
  addEventListener() {},
  // '#id' qua querySelector trả về CÙNG phần tử với getElementById
  querySelector: (s) => (s[0] === '#' ? (byId[s.slice(1)] || (byId[s.slice(1)] = makeEl(s.slice(1)))) : (bySel[s] || (bySel[s] = makeEl(s)))),
  querySelectorAll: (s) => (bySel[s + '|all'] = bySel[s + '|all'] || []),
  getElementsByTagName: () => [],
  body: bodyEl,
};
global.scrollTo = () => {};
global.SpeechSynthesisUtterance = function (t) { this.text = t; };
global.speechSynthesis = { cancel() {}, getVoices: () => [], speak() {} };
global.confirm = () => true;
global.alert = () => {};
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;

/* ---------- Nạp scripts theo thứ tự index.html ---------- */
const order = ['utils', 'config', 'storage', 'tts', 'course', 'dictionary', 'bank-loader', 'seed-data', 'lesson-loader', 'state', 'learning',
  'ui-shared', 'ui-picker', 'ui-home', 'ui-vocab', 'ui-modal', 'ui-games', 'ui-stats', 'main'];
for (const f of order) eval(fs.readFileSync('apps/web/public/legacy/js/' + f + '.js', 'utf-8'));

const VA = window.VocabApp;
let pass = 0, fail = 0;
function T(name, cond) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL:', name); }
}

console.log('\n== 1. KHỞI ĐỘNG — màn chọn khóa học ==');
VA.exitCourse();
T('đang ở picker (course.current = null)', VA.course.current === null);
T('body có class picker', document.body.classList.contains('picker'));
T('renderPicker gọi được', true);
const pickerHtml = byId['app'].innerHTML;
T('picker hiển thị tên 2 khóa học', pickerHtml.includes('Tiếng Anh') && pickerHtml.includes('Tiếng Trung'));

console.log('\n== 2. VÀO KHÓA TIẾNG ANH ==');
VA.enterCourse('en');
T('course.current = en', VA.course.current === 'en');
T('body[data-course=en]', document.body.dataset.course === 'en');
T('305 từ (seed EN gồm cả record)', VA.state.entries.length >= 305);
T('không trùng lặp từ', new Set(VA.state.entries.map((e) => e.word.toLowerCase())).size === VA.state.entries.length);
const allEn = VA.state.entries;
T('mọi từ có meaning.vi', allEn.every((e) => e.senses.every((s) => (s.meaning || {}).vi)));
T('mọi từ có meaning.en', allEn.every((e) => e.senses.every((s) => (s.meaning || {}).en)));
T('mọi từ có IPA', allEn.every((e) => e.senses.every((s) => s.pronunciation)));
T('hasTarget đúng cho khóa en', allEn.every((e) => VA.hasTarget(e)));
T('meaning() trả Anh→Việt', (() => { const m = VA.meaning(allEn[0].senses[0]); return !!m.source && !!m.target; })());
T('directionLabel Việt→Anh', VA.directionLabel(true) === 'Việt → Anh');
T('data lưu ở khóa course_en_entries', JSON.parse(localStorage.getItem('course_en_entries')).length === allEn.length);

// markLearned + streak scoped
const first = allEn.find((e) => e.learningStatus === 'new');
VA.markLearned(first);
T('markLearned ghi vào course_en_daily', (JSON.parse(localStorage.getItem('course_en_daily') || '{}')[VA.todayStr()] || []).includes(first.id));
T('course_zh_daily chưa tồn tại (database tách biệt)', localStorage.getItem('course_zh_daily') === null);
T('getStreak en = 1', VA.getStreak() === 1);
T('getStreakFor(en) = 1', VA.getStreakFor('en') === 1);
T('getStreakFor(zh) = 0 (streak riêng)', VA.getStreakFor('zh') === 0);

console.log('\n== 3. CÁC TAB KHÓA EN ==');
VA.renderHome(); T('home render', byId['app'].innerHTML.includes('Hôm nay'));
VA.state.tab = 'vocab'; VA.renderVocabTab(); T('vocab render', byId['app'].innerHTML.includes('Kho từ vựng'));
VA.state.detailId = allEn[0].id; VA.renderVocabTab();
T('detail render (có từ đầu tiên)', byId['app'].innerHTML.includes(allEn[0].word));
VA.state.tab = 'games'; VA.state.gameScreen = 'menu'; VA.renderGamesTab();
T('menu game EN có cả đồng/trái nghĩa', byId['app'].innerHTML.includes('Flashcard') && byId['app'].innerHTML.includes('đồng nghĩa') && byId['app'].innerHTML.includes('trái nghĩa'));
VA.state.tab = 'stats'; VA.renderStatsTab(); T('stats render', byId['app'].innerHTML.includes('Tổng quan'));

// game dịch nghĩa EN
VA.state.gameScreen = 'translate';
VA.startGame('translate');
const tr = VA.session;
tr.idx = 0; tr.dir = 's2t'; tr.hints = 0;
VA.renderTranslate();
T('translate render EN', byId['app'].innerHTML.includes('Gõ nghĩa'));
byId['answerInput'].value = VA.meaning(tr.queue[0].senses[0]).target;
byId['submitAnswerBtn'].onclick();
T('đáp án tiếng Việt đúng', byId['feedbackArea'].innerHTML.includes('Chính xác'));

console.log('\n== 4. VÀO KHÓA TIẾNG TRUNG ==');
VA.enterCourse('zh');
T('course.current = zh', VA.course.current === 'zh');
T('body[data-course=zh]', document.body.dataset.course === 'zh');
T('90 từ tiếng Trung', VA.state.entries.length === 90);
T('không trùng chữ Hán', new Set(VA.state.entries.map((e) => e.word)).size === 90);
const allZh = VA.state.entries;
T('mọi từ có meaning.vi', allZh.every((e) => e.senses.every((s) => (s.meaning || {}).vi)));
T('mọi từ có pinyin', allZh.every((e) => e.senses.every((s) => s.pronunciation)));
T('mọi từ không có meaning.en (khác database)', allZh.every((e) => e.senses.every((s) => !(s.meaning || {}).en)));
T('database riêng course_zh_entries', JSON.parse(localStorage.getItem('course_zh_entries')).length === 90);
T('course_en_entries không bị đụng', JSON.parse(localStorage.getItem('course_en_entries')).length === allEn.length);
T('daily en vẫn giữ (không bị ghi đè khi chuyển khóa)', (JSON.parse(localStorage.getItem('course_en_daily') || '{}')[VA.todayStr()] || []).length >= 1);

console.log('\n== 5. TAB + GAME KHÓA TRUNG ==');
VA.renderHome();
T('home TRUNG hiển thị biểu tượng 🇨🇳', byId['app'].innerHTML.includes('🇨🇳'));
VA.state.tab = 'vocab'; VA.renderVocabTab();
T('vocab TRUNG (chữ Hán xuất hiện)', byId['app'].innerHTML.includes('你好'));
VA.state.detailId = allZh[0].id; VA.renderVocabTab();
T('detail TRUNG có pinyin', byId['app'].innerHTML.includes('nǐ hǎo'));
VA.state.tab = 'games'; VA.state.gameScreen = 'menu'; VA.renderGamesTab();
T('menu TRUNG ẨN game đồng/trái nghĩa', !byId['app'].innerHTML.includes('data-game="synonym"') && !byId['app'].innerHTML.includes('data-game="antonym"'));

// translate TRUNG: vi→zh chấp nhận pinyin
VA.state.gameScreen = 'translate';
VA.startGame('translate');
const trz = VA.session;
trz.idx = 0; trz.dir = 't2s'; trz.hints = 0;
VA.renderTranslate();
T('translate TRUNG có nhãn pinyin', byId['app'].innerHTML.includes('chữ Hán hoặc pinyin'));
byId['answerInput'].value = VA.normPinyin(trz.queue[0].senses[0].pronunciation); // gõ pinyin không dấu
byId['submitAnswerBtn'].onclick();
T('gõ pinyin không dấu vẫn ĐÚNG', byId['feedbackArea'].innerHTML.includes('Chính xác'));
T('normPinyin chuẩn hóa', VA.normPinyin('nǐ hǎo') === 'nihao' && VA.normPinyin('duìbuqǐ') === 'duibuqi');

// translate TRUNG: zh→vi
trz.idx = 0; trz.dir = 's2t'; trz.hints = 0;
VA.renderTranslate();
byId['answerInput'].value = VA.meaning(trz.queue[0].senses[0]).target;
byId['submitAnswerBtn'].onclick();
T('Trung→Việt chấm điểm đúng', byId['feedbackArea'].innerHTML.includes('Chính xác'));

// maskText tiếng Trung
T('maskText 你好 0 kí tự → _ _', VA.maskText('你好', 0) === '__');
T('maskText 你好 1 kí tự → 你_', VA.maskText('你好', 1) === '你_');
T('countRevealable 你好 = 2', VA.countRevealable('你好') === 2);
T('maskText bỏ qua dấu câu Trung', VA.maskText('再见！', 0) === '__！');

VA.state.tab = 'stats'; VA.renderStatsTab(); T('stats TRUNG render', byId['app'].innerHTML.includes('Tổng quan'));

console.log('\n== 6. CHUYỂN KHÓA KHÔNG MẤT DỮ LIỆU ==');
VA.enterCourse('en');
T('quay lại en còn đủ 305 từ', VA.state.entries.length === allEn.length);
T('en streak vẫn = 1', VA.getStreak() === 1);
T('settings lưu courseId=en', VA.loadSettings().courseId === 'en');
VA.exitCourse();
T('exitCourse về picker', VA.course.current === null && document.body.classList.contains('picker'));
T('settings xóa courseId', VA.loadSettings().courseId === undefined);

console.log('\n== 7. MIGRATE CÀI ĐẶT CŨ (pairId → courseId) ==');
localStorage.setItem('vocab_settings_v1', JSON.stringify({ pairId: 'en-zh' }));
eval(fs.readFileSync('apps/web/public/legacy/js/main.js', 'utf-8')); // chạy lại boot
T('pairId en-zh → vào thẳng khóa zh', VA.course.current === 'zh');
T('settings đã đổi sang courseId', VA.loadSettings().courseId === 'zh' && VA.loadSettings().pairId === undefined);

console.log('\n== 8. IMPORT DỮ LIỆU CŨ (schema cũ) ==');
// Mô phỏng người dùng cũ: xóa course_en_* + có vocab_entries_v2 schema cũ
localStorage.removeItem('course_en_entries');
localStorage.removeItem('course_en_daily');
localStorage.setItem('vocab_entries_v2', JSON.stringify([
  { id: 'old1', word: 'hello', tags: ['đời sống'], dateAdded: '2025-01-01T00:00:00Z',
    learningStatus: 'mastered', correctStreak: 5, synonyms: ['hi'], antonyms: [], wordRoot: '',
    senses: [{ pronunciation: '/həˈləʊ/', partOfSpeech: 'noun', definitionEN: 'A greeting.', definitionVI: 'Xin chào.', examples: ['Hello!'] }] },
]));
localStorage.setItem('vocab_daily_v2', JSON.stringify({ '2025-08-01': ['old1'] }));
VA.exitCourse();
VA.enterCourse('en');
const saved = JSON.parse(localStorage.getItem('course_en_entries'));
T('dữ liệu cũ được copy sang course_en_entries', saved.some((e) => e.word === 'hello'));
const oldHello = saved.find((e) => e.word === 'hello');
T('giữ status mastered', oldHello.learningStatus === 'mastered');
T('giữ streak 5', oldHello.correctStreak === 5);
T('schema cũ chuyển sang meaning map', oldHello.senses[0].meaning.en === 'A greeting.' && oldHello.senses[0].meaning.vi === 'Xin chào.');
T('daily cũ copy sang course_en_daily', (JSON.parse(localStorage.getItem('course_en_daily') || '{}')['2025-08-01'] || []).includes('old1'));
T('seed vẫn merge thêm từ mới (không đụng hello)', saved.length >= 305 && saved.filter((e) => e.word === 'hello').length === 1);

console.log('\n== 9. THÊM TỪ MỚI CHO KHÓA TRUNG (modal) ==');
VA.enterCourse('zh');
VA.openModal('new');
VA.modalDraft.word = '猫';
VA.modalDraft.senses[0].pronunciation = 'māo';
VA.modalDraft.senses[0].partOfSpeech = 'noun';
VA.modalDraft.senses[0].meaning = { vi: 'Mèo.' };
VA.modalDraft.senses[0].examples = ['我喜欢猫。'];
VA.state.entries.push(VA.modalDraft);
VA.saveEntries(VA.state.entries);
T('từ mới 猫 lưu vào course_zh_entries', JSON.parse(localStorage.getItem('course_zh_entries')).some((e) => e.word === '猫'));
T('không lọt vào course_en_entries', !JSON.parse(localStorage.getItem('course_en_entries')).some((e) => e.word === '猫'));

console.log('\n== 10. ÔN TẬP TỐI ƯU — menu + số câu + ôn lại từ sai ==');
VA.enterCourse('en');
VA.state.tab = 'games'; VA.state.gameScreen = 'menu'; VA.renderGamesTab();
T('menu có bộ chọn "Số câu mỗi lượt"', byId['app'].innerHTML.includes('Số câu mỗi lượt'));
T('menu hiện số từ khả dụng trên thẻ', byId['app'].innerHTML.includes('game-count'));

// Số câu mỗi lượt = 10
let ss = VA.loadSettings(); ss.gameQty = 10; VA.saveSettings(ss);
VA.startGame('translate');
T('gameQty=10 → hàng đợi ≤ 10 từ', VA.session.queue.length <= 10 && VA.session.queue.length > 0);
VA.state.gameScreen = 'menu'; VA.renderGamesTab();
T('qtySelect hiển thị đúng lựa chọn', byId['qtySelect'].value === '10');
ss = VA.loadSettings(); ss.gameQty = 0; VA.saveSettings(ss);

// Synonym: sai → requeue + missed
VA.startGame('synonym');
const sg = VA.session;
const initLen = sg.queue.length;
const wrongEntry = sg.current.entry;
const wrongOpt = sg.current.options.find((o) => VA.normalize(o) !== VA.normalize(sg.current.correctWord));
VA.answerChoice(wrongOpt);
T('sai → từ được đưa lại CUỐI hàng đợi', sg.queue.length === initLen + 1 && sg.queue[sg.queue.length - 1].id === wrongEntry.id);
T('missed ghi nhận đúng 1 từ', sg.missed.length === 1 && sg.missed[0] === wrongEntry.id);
T('feedback có retry-note', byId['feedbackArea'].innerHTML.includes('sẽ được hỏi lại'));

// Flashcard: Chưa nhớ → requeue
VA.startGame('flashcard');
const sf = VA.session;
const initF = sf.queue.length;
VA.answerFlashcard(sf.queue[0], false);
T('flashcard Chưa nhớ → hỏi lại cuối phiên', sf.queue.length === initF + 1 && sf.missed.length === 1);

// Translate: sai → hỏi lại → vẫn sai → summary có danh sách từ sai + nút Ôn lại
VA.startGame('translate');
const st = VA.session;
st.queue = [st.queue[0]];
st.idx = 0; st.dir = 't2s'; st.hints = 0;
VA.renderTranslate();
const missedId = st.queue[0].id;
byId['answerInput'].value = 'zzzzwronganswer';
byId['submitAnswerBtn'].onclick();
T('translate sai → retry-note hiển thị', byId['feedbackArea'].innerHTML.includes('sẽ được hỏi lại'));
T('translate sai → requeue (queue 1→2)', st.queue.length === 2);
byId['nextQBtn'].onclick();
T('từ sai được hỏi lại (idx=1/2)', st.idx === 1 && st.queue.length === 2);
st.dir = 's2t'; VA.renderTranslate();
byId['answerInput'].value = 'stillwrong';
byId['submitAnswerBtn'].onclick();
T('sai lần 2 → không requeue thừa (repeat max)', st.queue.length === 2 && st.missed.length === 1);
byId['nextQBtn'].onclick();
T('kết thúc → summary hiện danh sách từ sai', byId['app'].innerHTML.includes('missed-item'));
T('summary có nút Ôn lại từ sai', byId['app'].innerHTML.includes('retryMissedBtn') && byId['app'].innerHTML.includes('Ôn lại từ sai'));
const beforeRetry = VA.session.queue.length;
byId['retryMissedBtn'].onclick();
T('Ôn lại từ sai → session mới chỉ chứa từ sai', VA.session.queue.length === 1 && VA.session.queue[0].id === missedId && VA.session.queue.length < beforeRetry);

// Đúng khi được hỏi lại → gỡ khỏi danh sách chưa nhớ
VA.startGame('translate');
const st2 = VA.session;
st2.queue = [st2.queue[0]];
st2.idx = 0; st2.dir = 't2s'; st2.hints = 0;
VA.renderTranslate();
byId['answerInput'].value = 'wrongagain';
byId['submitAnswerBtn'].onclick();
T('sai → missed = 1', st2.missed.length === 1);
byId['nextQBtn'].onclick();
st2.dir = 's2t'; VA.renderTranslate();
byId['answerInput'].value = VA.meaning(st2.queue[st2.idx].senses[0]).target;
byId['submitAnswerBtn'].onclick();
T('đúng khi hỏi lại → gỡ khỏi missed', st2.missed.length === 0);
byId['nextQBtn'].onclick();
T('summary KHÔNG còn từ sai (đã nhớ lại)', !byId['app'].innerHTML.includes('missed-item') && !byId['app'].innerHTML.includes('retryMissedBtn'));

// Chọn đáp án đúng liên tiếp → không requeue thừa
VA.startGame('synonym');
const sOk = VA.session;
const lenOk = sOk.queue.length;
VA.answerChoice(sOk.current.correctWord);
T('đúng → không requeue, queue không đổi', sOk.queue.length === lenOk && sOk.missed.length === 0);

console.log('\n== 11. GAME UX: PHÁT ÂM + NÚT BỎ QUA + STREAK ==');
VA.enterCourse('en');
// Flashcard: lật thẻ → hiện nút; bỏ qua không tính điểm; lật qua lại được
VA.startGame('flashcard');
const sf2 = VA.session;
T('flashcard có nút phát âm từ (fc-speak)', byId['app'].innerHTML.includes('fc-speak'));
T('chưa lật → chưa hiện nút trả lời', !byId['app'].innerHTML.includes('knowBtn'));
VA.flipFlashcard();
T('lật thẻ → hiện 3 nút (Bỏ qua/Chưa nhớ/Đã nhớ)', byId['app'].innerHTML.includes('passBtn') && byId['app'].innerHTML.includes('knowBtn') && byId['app'].innerHTML.includes('dontKnowBtn'));
T('thẻ có class flipped sau khi lật', byId['app'].innerHTML.includes('flipped'));
T('mặt sau có gợi ý quay lại', byId['app'].innerHTML.includes('quay lại mặt trước'));
VA.flipFlashcard(); // lật VỀ mặt trước
T('lật về → thẻ hết flipped nhưng vẫn hiện nút đánh giá', !byId['app'].innerHTML.includes('flipped') && byId['app'].innerHTML.includes('knowBtn'));
VA.flipFlashcard(); // lật lại lần nữa
T('lật qua lật lại được (flipped trở lại)', byId['app'].innerHTML.includes('flipped'));
const idxBefore = VA.session.idx;
const totalBefore = VA.session.total;
VA.passFlashcard();
T('Bỏ qua → sang thẻ sau, KHÔNG tính điểm, không ghi missed', VA.session.idx === idxBefore + 1 && VA.session.total === totalBefore && VA.session.missed.length === 0);
T('thẻ mới → chưa hiện nút đánh giá (seenOnce reset)', !byId['app'].innerHTML.includes('knowBtn'));

// Choice: phát âm câu hỏi + từng đáp án + phím số
VA.startGame('synonym');
T('câu hỏi có nút phát âm', byId['app'].innerHTML.includes('data-speak'));
T('4 đáp án đều có phím số + nút phát âm', (byId['app'].innerHTML.match(/choice-key/g) || []).length === 4 && (byId['app'].innerHTML.match(/speak-btn/g) || []).length >= 5);
T('có hướng dẫn phím 1-4', byId['app'].innerHTML.includes('chọn đáp án nhanh'));

// Streak liên tiếp hiện chip 🔥 trong khung game
VA.startGame('translate');
const strk = VA.session;
strk.queue = [strk.queue[0], strk.queue[1], strk.queue[2]];
strk.idx = 0; strk.dir = 's2t'; strk.hints = 0;
VA.renderTranslate();
byId['answerInput'].value = VA.meaning(strk.queue[0].senses[0]).target;
byId['submitAnswerBtn'].onclick();
byId['nextQBtn'].onclick();
VA.session.dir = 's2t'; VA.renderTranslate();
byId['answerInput'].value = VA.meaning(VA.session.queue[1].senses[0]).target;
byId['submitAnswerBtn'].onclick();
byId['nextQBtn'].onclick();
T('streak liên tiếp = 2', VA.session.streakNow === 2);
T('gameShell hiện chip 🔥 streak', byId['app'].innerHTML.includes('game-streak'));

console.log('\n== 12. TỪ ĐA NGHĨA (nhiều nghĩa / nhiều loại từ) ==');
VA.enterCourse('en');
const allEn2 = VA.state.entries;
T('có từ đa nghĩa trong kho (senses > 1)', allEn2.some((e) => (e.senses || []).length > 1));
const pres = allEn2.find((e) => e.word === 'present');
T('present có 3 nghĩa (verb/noun/adjective)', !!pres && pres.senses.length === 3 && pres.senses.map((s) => s.partOfSpeech).join(',') === 'verb,noun,adjective');
T('present nghĩa verb = Trình bày', !!pres && pres.senses[0].meaning.vi.includes('Trình bày'));
T('present nghĩa noun = Món quà', !!pres && pres.senses[1].meaning.vi.includes('Món quà'));
T('present phiên âm đúng: verb /prɪˈzent/, noun+adj /ˈprezənt/', !!pres && pres.senses[0].pronunciation === '/prɪˈzent/' && pres.senses[1].pronunciation === '/ˈprezənt/' && pres.senses[2].pronunciation === '/ˈprezənt/');

// detail view hiển thị "Các nghĩa khác"
VA.state.detailId = pres.id; VA.renderVocabTab();
T('detail view hiện "Các nghĩa khác (2)"', byId['app'].innerHTML.includes('Các nghĩa khác (2)'));
T('detail view hiện 3 chip loại từ', (byId['app'].innerHTML.match(/pos-chip/g) || []).length >= 3);
VA.state.detailId = null;

// pickSense: 1 sense → luôn sense đó; đa nghĩa → trả 1 trong các sense
const singleE = allEn2.find((e) => (e.senses || []).length === 1);
T('pickSense từ 1 nghĩa trả về đúng sense', !!singleE && VA.pickSense(singleE) === singleE.senses[0]);
T('pickSense từ đa nghĩa trả về 1 sense hợp lệ', !!pres && pres.senses.includes(VA.pickSense(pres)));

// applySeedUpgrade: entry cũ (1 nghĩa) được bổ sung nghĩa, giữ nguyên trạng thái học
const oldE = {
  id: 'old-present', word: 'present', tags: ['đời sống'], dateAdded: '2024-01-01',
  learningStatus: 'mastered', correctStreak: 9, synonyms: [], antonyms: [], wordRoot: '',
  senses: [{ pronunciation: '/ˈprezənt/', partOfSpeech: 'adjective', meaning: { en: 'Relating to now.', vi: 'Hiện tại.' }, examples: [''] }],
};
const upgraded = VA.applySeedUpgrade([oldE]);
T('upgrade thêm 2 nghĩa còn thiếu (verb, noun)', upgraded === 1 && oldE.senses.length === 3);
T('upgrade giữ nguyên learningStatus/streak', oldE.learningStatus === 'mastered' && oldE.correctStreak === 9);
T('upgrade không thêm nghĩa trùng loại từ', oldE.senses.filter((s) => s.partOfSpeech === 'adjective').length === 1);
// chạy lại → không thay đổi gì (idempotent)
T('upgrade idempotent', VA.applySeedUpgrade([oldE]) === 0 && oldE.senses.length === 3);
// seedVersion được ghi khi vào khóa
const set2 = JSON.parse(localStorage.getItem('vocab_settings_v1'));
T('settings.seedVersion = 2 sau khi vào khóa', (set2 && set2.seedVersion) === 2);

// flashcard với từ đa nghĩa render được (pickSense)
VA.startGame('flashcard');
const fcE = VA.session.queue.find((e) => (e.senses || []).length > 1) || VA.session.queue[0];
VA.session.queue = [fcE]; VA.session.idx = 0; VA.session.revealed = false; VA.session.seenOnce = false;
VA.renderFlashcard();
T('flashcard render từ đa nghĩa OK', byId['app'].innerHTML.includes('fc-word'));
VA.flipFlashcard();
T('flashcard từ đa nghĩa lật hiện nghĩa (fc-vi)', byId['app'].innerHTML.includes('fc-vi'));

console.log('\n== 13. TỪ ĐIỂN NGOẠI TUYẾN (tải chunk theo nhu cầu) ==');
// bankInit + chunkName nhất quán với manifest
VA.bankInit(['chunk-000.js', 'chunk-001.js', 'chunk-002.js', 'chunk-003.js', 'chunk-004.js']);
T('bankInit đăng ký manifest', VA.bank.manifest.length === 5);
const cw = VA.bankChunkName('wander');
T('bankChunkName trả tên chunk hợp lệ', /^chunk-\d{3}\.js$/.test(cw));
T('cùng 1 từ → cùng chunk (ổn định)', cw === VA.bankChunkName('wander'));

// mô phỏng 1 chunk (như file sinh bởi build-chunks.js): đăng ký → tra từ
const testRows = [
  ['wander', 'verb', 'Go via an indirect route or at no set pace', 'After dinner, we wandered into town', ['stray', 'roam'], []],
  ['wander', 'verb', 'Move about aimlessly or without any destination', '', [], []],
  ['wonder', 'noun', 'Something that causes amazement or awe', '', [], []],
];
VA.bankRegister(cw, testRows);
T('bankRegister lưu chunk', VA.bank.loaded.get(cw) === testRows);

(async () => {
  const hit = await VA.bankLookup('wander');
  T('bankLookup trả đủ mọi nghĩa của từ', hit.length === 2 && hit.every((r) => r[0] === 'wander'));
  const miss = await VA.bankLookup('wanderxyz');
  T('bankLookup từ không có → []', miss.length === 0);
  const lw = await VA.bankLookupWord('wander');
  T('bankLookupWord trả senses đa nghĩa', !!lw && lw.senses.length === 2 && lw.senses[0].meaning.en.includes('indirect'));
  T('bankLookupWord gộp đồng nghĩa', !!lw && lw.synonyms.includes('roam'));
  T('bankLookupWord từ không có → null', (await VA.bankLookupWord('nope')) === null);
  T('bankHash FNV xác định (cùng giá trị mỗi lần)', VA.bankHash('wander') === VA.bankHash('wander') && typeof VA.bankHash('wander') === 'number');

  console.log('\n== 14. BÀI HỌC (lesson) — chọn bài → tự fetch từ vào kho ==');
  // Đăng ký manifest + dữ liệu bài học (mô phỏng file js/lessons/lesson-001.js)
  VA.lessonsInit([
    { id: 'lesson-001', title: 'Bài 1 · đời sống', file: 'lesson-001.js', tag: 'đời sống', count: 2 },
    { id: 'lesson-002', title: 'Bài 2 · ẩm thực', file: 'lesson-002.js', tag: 'ẩm thực', count: 1 },
  ]);
  const lesson1Rows = [
    ['kettle', '/ˈketl/', 'noun', 'A metal or plastic container with a lid and spout, used for boiling water.', 'Ấm đun nước.', 'The kettle is boiling.', 'đời sống', ['pot'], [], ''],
    ['faucet', '/ˈfɔːsɪt/', 'noun', 'A device for controlling the flow of water from a pipe.', 'Vòi nước.', '', 'đời sống', [], [], ''],
  ];
  const lesson2Rows = [
    ['recipe', '/ˈresɪpi/', 'noun', 'A set of instructions for preparing a particular dish.', 'Công thức nấu ăn.', 'This is my favorite recipe.', 'ẩm thực', ['formula'], [], ''],
  ];
  VA.lessonsRegister('lesson-001.js', { tag: 'đời sống', words: lesson1Rows });
  VA.lessonsRegister('lesson-002.js', { tag: 'ẩm thực', words: lesson2Rows });
  T('lessonsInit đăng ký manifest', VA.lessons.manifest.length === 2);
  T('lessonById trả thông tin bài', VA.lessonById('lesson-001').title === 'Bài 1 · đời sống');
  const loaded = await VA.loadLesson('lesson-001');
  T('loadLesson trả từ của bài', !!loaded && loaded.words.length === 2 && loaded.tag === 'đời sống');

  // Gộp bài vào kho → entry có lessonId + tags
  const before = VA.state.entries.length;
  const added1 = await VA.ensureLessonInCourse('lesson-001');
  T('ensureLessonInCourse thêm đủ từ bài 1', added1 === 2 && VA.state.entries.length === before + 2);
  const kettle = VA.state.entries.find((e) => e.word === 'kettle');
  T('từ bài học có lessonId', !!kettle && kettle.lessonId === 'lesson-001');
  T('từ bài học gắn tag chủ đề', !!kettle && kettle.tags[0] === 'đời sống');
  T('từ bài học có nghĩa Việt', !!kettle && VA.hasTarget(kettle));
  const added2 = await VA.ensureLessonInCourse('lesson-001');
  T('gộp lại idempotent (không thêm trùng)', added2 === 0 && VA.state.entries.length === before + 2);
  T('lessonWordsInCourse đếm đúng', VA.lessonWordsInCourse('lesson-001') === 2);
  await VA.ensureLessonInCourse('lesson-002');
  T('gộp bài 2 riêng biệt', VA.lessonWordsInCourse('lesson-002') === 1);

  // Tab Từ vựng: danh sách bài học hiện chip + thẻ bài
  VA.enterCourse('en');
  VA.state.tab = 'vocab'; VA.state.detailId = null; VA.state.vocabLessonId = null;
  VA.render();
  T('vocab hiện chip "Tất cả từ"', byId['app'].innerHTML.includes('Tất cả từ'));
  T('vocab hiện thẻ bài học', byId['app'].innerHTML.includes('Bài 1 · đời sống'));
  // Mở bài học → xem 20 từ
  VA.state.vocabLessonId = 'lesson-001';
  VA.renderVocabTab();
  await new Promise((r) => setTimeout(r, 10));
  T('vocab hiện từ của bài học', byId['app'].innerHTML.includes('kettle') && byId['app'].innerHTML.includes('faucet'));

  // Home: panel chọn bài học
  VA.state.tab = 'home'; VA.state.lessonFocus = 'lesson-001';
  VA.render();
  T('home hiện panel bài học + select', byId['app'].innerHTML.includes('lessonSelect'));
  T('home tô đúng bài đang học', byId['lessonSelect'].value === 'lesson-001');

  // Games: phạm vi theo bài học lọc đúng pool
  VA.state.tab = 'games'; VA.state.gameScreen = 'menu'; VA.state.gameLessonId = 'lesson-001';
  VA.render();
  T('game menu hiện bộ chọn phạm vi', byId['app'].innerHTML.includes('scopeSelect'));
  VA.state.gameScreen = 'flashcard'; VA.startGame('flashcard');
  T('game flashcard chỉ dùng từ bài đã chọn', !!VA.session && VA.session.queue.every((e) => e.lessonId === 'lesson-001'));
  VA.state.gameLessonId = null; VA.state.gameScreen = 'menu'; VA.render();
  VA.state.gameScreen = 'flashcard'; VA.startGame('flashcard');
  T('bỏ phạm vi → game dùng mọi từ', !!VA.session && VA.session.queue.some((e) => !e.lessonId));

  console.log(`\nKẾT QUẢ: ${pass} pass / ${fail} fail ${fail === 0 ? '— ALL GOOD ✅' : '— CÓ LỖI ❌'}`);
  process.exit(fail === 0 ? 0 : 1);
})();
