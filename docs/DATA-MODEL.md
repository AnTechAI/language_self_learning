# Data Model — Format dữ liệu

> Mọi format dữ liệu trong app. Bản TypeScript hóa: `packages/shared/src/index.ts`.

## 1. Entry chuẩn (kho từ vựng — localStorage)

```ts
interface WordEntry {
  id: string;                 // VA.uid()
  word: string;
  tags: string[];             // ['công việc'] — chủ đề
  dateAdded: string;          // ISO
  learningStatus: 'new' | 'learning' | 'mastered';
  correctStreak: number;
  synonyms: string[];
  antonyms: string[];
  wordRoot: string;           // gốc từ (có thể rỗng)
  senses: Sense[];            // NHIỀU NGHĨA (đa loại từ)
  lessonId?: string;          // thuộc bài học nào (hệ thống Lesson)
  lastReviewDay?: string;     // 'YYYY-MM-DD'
}

interface Sense {
  pronunciation: string;      // IPA (en) / pinyin (zh)
  partOfSpeech: string;       // noun | verb | adjective | …
  meaning: { en?, vi?, zh? }; // map theo mã ngôn ngữ
  examples: string[];
  synonyms?: string[];
  antonyms?: string[];
}
```

## 2. Dòng nén SEED_WORDS / bài học (1 dòng = 1 từ)

`js/seed-data.js` và `js/lessons/lesson-*.js` dùng định dạng nén để file nhỏ:

```
[word, ipa, pos, defEN, defVI, example, tag, syn[], ant[], root]
  + tùy chọn CÁC NGHĨA BỔ SUNG: {p,i,e,v,x,s,a}
    p=loại từ · i=phiên âm · e=nghĩa Anh · v=nghĩa Việt · x=ví dụ · s=đồng nghĩa · a=trái nghĩa
```

Ví dụ (from js/seed-data.js):
```js
['present','/ˈprezənt/','noun','A gift.','Món quà.','','học thuật',[],[],'',
  {p:'verb', i:'/prɪˈzent/', e:'To introduce or show.', v:'Trình bày.', x:'He presented his idea.'},
  {p:'adjective', e:'Existing or occurring now.', v:'Hiện tại.'}]
```

- `VA.toEntry(row)` chuyển dòng nén → entry chuẩn (những `...extras` thành `senses[]`).
- Quy ước: **mỗi dòng phải nằm trên 1 dòng** (parser/bộ đếm dòng của tool dựa vào dòng).

## 3. Bài học (Lesson) — `js/lessons/`

**manifest.js** — danh sách bài (nạp trước):
```js
window.VocabApp.lessonsInit([
  {id:'lesson-001', title:'Bài 1 · đời sống', file:'lesson-001.js', tag:'đời sống', count:20},
  …
]);
```

**lesson-001.js** — dữ liệu 1 bài (tải khi người dùng chọn bài đó):
```js
(function(){window.VocabApp.lessonsRegister('lesson-001.js',{
  tag:'đời sống',
  words:[ /* dòng nén §2, 20 từ */ ]
});})();
```

App tải ĐÚNG bài người chọn → `ensureLessonInCourse(id)` gộp từ vào kho
(entry có `lessonId` + tag) → games lọc theo `lessonId`.

## 4. Từ điển offline — `js/bank/`

**manifest.js**: `window.VocabApp.bankInit(['chunk-000.js', …104 chunk])`

**chunk-NNN.js** — entry nén 6 ô (không IPA — JSONL nguồn không có):
```js
[word, pos, definition, example, syn[], ant[]]
```

Tìm chunk chứa từ: `chunkName = 'chunk-' + (hashFNV(word) % 104)` — **không cần sắp xếp**,
O(1). `VA.bankLookup(word)` → mọi entry khớp (mọi nghĩa/loại từ).

## 5. localStorage

| Key | Nội dung | Ghi chú |
|---|---|---|
| `vocab_settings_v1` | `{courseId, gameQty, seedVersion}` | seedVersion để kích hoạt nâng cấp seed |
| `course_{id}_entries` | `WordEntry[]` | mỗi khóa một key riêng |
| `course_{id}_daily` | `{'YYYY-MM-DD': [entryId…]}` | quota + streak |
| `course_{id}_history` | `HistoryRecord[]` (tối đa 800) | lịch sử game |

Legacy keys cũ (`vocab_entries_v1/v2`, `vocab_daily_v2`, `vocab_history_v2`)
được copy sang `course_en_*` khi mở khóa en lần đầu (storage.js `importLegacy`).
