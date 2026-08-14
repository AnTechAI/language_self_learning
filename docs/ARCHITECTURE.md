# Kiến trúc (Architecture)

## 1. Bản đồ thành phần hiện tại (sau GĐ 0)

```
english-learning/
├── apps/
│   ├── web/
│   │   ├── index.html            → App React (GĐ 0: khung trống)
│   │   ├── src/                  → React + TS (docs/WEB-REACT.md)
│   │   └── public/legacy/        → APP LEGACY (dùng hằng ngày)
│   │       ├── index.html        → entry file:// hoặc /legacy/
│   │       ├── css/styles.css
│   │       └── js/               → 19 module IIFE + window.VocabApp
│   │           ├── bank/         → từ điển offline 207k từ (104 chunk, 25MB)
│   │           ├── lessons/      → 7 bài học (manifest + lesson-*.js)
│   │           └── seed-data.js  → 523 từ cơ bản
│   └── api/                      → FastAPI skeleton (docs/API-SYNC.md)
├── packages/shared/src/index.ts  → types dùng chung web+api
├── data/raw/english-dictionary.jsonl → 41MB nguồn (git-ignored)
├── tools/                        → 4 tool sinh dữ liệu (docs/DATA-PIPELINES.md)
└── docs/                         → tài liệu (chính là file này)
```

## 2. App legacy — luồng dữ liệu (không đổi so với trước GĐ 0)

```
index.html → <script src> nạp 19 module theo thứ tự cố định
  utils → config → storage → tts → course → dictionary → bank-loader
  → seed-data → lesson-loader → state → learning → ui-* → main
main.boot() → VA.enterCourse(id) → migrate → merge seed → render tab
Dữ liệu người dùng: localStorage (course_{en,zh}_entries/_daily/_history + vocab_settings_v1)
Từ điển offline: tải ĐÚNG 1 chunk (bank) / ĐÚNG 1 bài (lesson) khi cần
```

## 3. Kiến trúc đích (sau GĐ 3-5)

```
┌─ apps/web (React) ────────────────────────────────┐
│ Router (react-router)                             │
│ ┌── features/ ─────────────────────────────────┐  │
│ │ lessons · games · vocabulary · review · stats│  │
│ └──────────────────────────────────────────────┘  │
│ stores (state) ── db/ (IndexedDB) ── lib/ (tts,   │
│ dict-api, logic thuần port từ legacy)             │
│ data/ (seed + lessons, lazy import)               │
└─────────────────┬──────────────────────────────────┘
                  │ fetch /api/* (chỉ khi online)
┌─ apps/api (FastAPI) ──────────────────────────────┐
│ auth (JWT) · sync (SQLite) · proxy dictionary      │
└────────────────────────────────────────────────────┘
```

## 4. Nguyên tắc chuyển đổi

1. **Logic thuần giữ nguyên** (norm, pickSense, requeue, streak, summary…): chỉ port
   sang TS, không sửa hành vi — 142 test legacy là lưới an toàn.
2. **Lớp render là lớp mỏng**: mỗi màn hình legacy (`ui-*.js`) → 1 feature React.
3. **Data access tập trung**: mọi đọc/ghi qua `db/` (repo pattern) — đổi localStorage
   → IndexedDB ở GĐ 2 mà UI không đổi.
4. **types ở packages/shared**: web và api import từ đây.
