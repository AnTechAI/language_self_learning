/**
 * dictionary.js — Tra từ điển tự động qua Free Dictionary API
 * (https://dictionaryapi.dev). Điền phiên âm, nghĩa tiếng Anh, loại từ, ví dụ,
 * đồng nghĩa/trái nghĩa. Nghĩa ngôn ngữ đích (vi/zh…) để người dùng tự bổ sung.
 */
(function () {
  const VA = window.VocabApp;

  VA.fetchFromDictionaryApi = async function (word) {
    const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.trim().toLowerCase());
    const res = await fetch(url);
    if (!res.ok) throw new Error('Không tìm thấy từ trong từ điển (API).');
    const data = await res.json();
    const entryData = data[0];
    const senses = [];
    const synSet = new Set();
    const antSet = new Set();

    (entryData.meanings || []).forEach((m) => {
      const defObj = (m.definitions && m.definitions[0]) || {};
      senses.push({
        pronunciation: entryData.phonetic || (entryData.phonetics && entryData.phonetics.find((p) => p.text)?.text) || '',
        partOfSpeech: m.partOfSpeech || '',
        meaning: { en: defObj.definition || '' },
        examples: defObj.example ? [defObj.example] : [],
      });
      (m.synonyms || []).forEach((s) => synSet.add(s));
      (m.antonyms || []).forEach((a) => antSet.add(a));
      (m.definitions || []).forEach((d) => {
        (d.synonyms || []).forEach((s) => synSet.add(s));
        (d.antonyms || []).forEach((a) => antSet.add(a));
      });
    });

    if (senses.length === 0) {
      senses.push({ pronunciation: entryData.phonetic || '', partOfSpeech: '', meaning: { en: '' }, examples: [] });
    }
    return {
      senses,
      synonyms: Array.from(synSet).slice(0, 8),
      antonyms: Array.from(antSet).slice(0, 8),
    };
  };
})();
