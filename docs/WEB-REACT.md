# App React — `apps/web/src/`

## 1. Làm gì

App React mới (GĐ 0: **khung trống**). Mục tiêu: port toàn bộ tính năng từ app
legacy sang React + TS trong các giai đoạn tiếp theo (xem PRODUCTION-PLAN.md).

## 2. Lợi ích

- **TypeScript strict** — bắt lỗi trước khi chạy (legacy là JS không kiểu).
- **Component hóa** — mỗi màn hình là 1 feature, dễ mở rộng (thêm game, thêm khóa học).
- **Code-split tự động** — data (seed/lesson/bank) tải đúng lúc cần, thay cho
  chèn `<script>` thủ công của legacy.
- Chạy song song legacy — chuyển đổi an toàn từng bước.

## 3. Cấu trúc hiện tại

```
apps/web/
├── index.html          # entry React
├── vite.config.ts      # Vite + React plugin; public/ → copy ra dist/
├── tsconfig.json       # TS strict
├── public/legacy/      # app legacy (docs/LEGACY-APP.md)
└── src/
    ├── main.tsx        # ReactDOM root
    ├── App.tsx         # trang tạm: link tới /legacy/
    └── index.css
```

Cấu trúc đích (GĐ 3):
```
src/
├── main.tsx
├── router.tsx                    # react-router
├── app/                          # layout, nav, picker khóa học
├── features/
│   ├── lessons/                  # danh sách bài + học theo bài
│   ├── games/                    # flashcard, translate, synonym, antonym
│   ├── vocabulary/               # kho từ + chi tiết từ
│   ├── review/                   # ôn tập + retry từ sai
│   └── stats/                    # streak, lịch sử
├── db/                           # IndexedDB (GĐ 2): repo + migrations
├── data/                         # seed + lessons (lazy import)
├── lib/                          # tts, dict-api, norm, pickSense, requeue… (port từ legacy)
└── types/                        # tái xuất từ @english/shared
```

## 4. Cách port 1 màn hình (GĐ 3) — quy ước

1. Copy logic thuần từ `ui-*.js` vào `lib/` (đổi sang TS, KHÔNG sửa hành vi).
2. Viết store (Zustand) cho state tương ứng (`VA.state.*`, `VA.session`).
3. Viết component render; so sánh với legacy bằng `_e2e.js` / Playwright.
4. Data access qua `db/` (chưa có thì tạm bọc localStorage legacy).

## 5. Chạy

```bash
npm install && npm run dev        # http://localhost:5173 (React) + /legacy/
npm run build                     # tsc --noEmit && vite build → dist/
npm run preview                   # xem bản build
```
