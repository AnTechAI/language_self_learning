# App React — `apps/web/src/`

## 1. Làm gì

App React mới (GĐ 0 → 3): **port toàn bộ tính năng legacy sang React + TS**, cùng
UI/UX redesign (docs/DESIGN.md). Legacy vẫn chạy song song tại `public/legacy/`
(`/legacy/index.html`) cho tới khi port xong.

## 2. Lợi ích

- **TypeScript strict** — bắt lỗi trước khi chạy (legacy là JS không kiểu).
- **Component hóa** — mỗi màn hình là 1 feature, dễ mở rộng.
- **Logic thuần + test** — mọi biến đổi dữ liệu nằm trong `lib/` (hàm thuần,
  vitest); store chỉ phối hợp → bug ít, refactor an toàn.
- **Code-split / tải đúng lúc** — seed 457KB bundle sẵn; lesson/chunk 25MB từ
  điển tải đúng 1 file khi cần qua shim `window.VocabApp` (không bao giờ nạp
  toàn bộ 41MB JSONL vào app).
- Chạy song song legacy — chuyển đổi an toàn từng bước (142 e2e legacy guard).

## 3. Cấu trúc hiện tại

```
apps/web/
├── index.html          # entry React
├── vite.config.ts      # Vite + React; vitest (node + happy-dom qua pragma)
├── tsconfig.json       # TS strict
├── public/legacy/      # app legacy (docs/LEGACY-APP.md) — copy nguyên vào dist/
└── src/
    ├── main.tsx / App.tsx     # root + router theo tab (chưa cần react-router)
    ├── index.css / styles/app.css  # design system (docs/DESIGN.md)
    ├── vite-env.d.ts          # types Vite
    ├── db/                    # IndexedDB (GĐ 2): db.ts, repo.ts, migrate.ts
    ├── data/                  # dữ liệu + shim legacy
    │   ├── courses.ts         # cấu hình khóa học (en/zh)
    │   ├── seed.ts            # toEntry / mergeSeeds / applySeedUpgrade
    │   ├── seed.generated.ts  # 524 EN + 90 ZH (sinh bởi tools/export-seed.js)
    │   ├── registry.ts        # shim window.VocabApp + loadScript + once()
    │   ├── bank.ts            # từ điển offline theo chunk (FNV-1a hash)
    │   └── lessons.ts         # bài học theo nhu cầu (manifest + merge)
    ├── lib/                   # logic thuần (port từ legacy)
    │   ├── format.ts          # normalize/shuffle/uid/maskText/meaningOf…
    │   ├── learning.ts        # markLearned/applyResult/streak/history
    │   ├── games.ts           # pool/session/choice/checkTranslate
    │   └── tts.ts             # Web Speech API (BCP-47)
    ├── store/useCourseStore.ts   # zustand — state toàn cục + phối hợp IDB
    ├── components/            # ui.tsx (design system), Layout.tsx
    └── features/              # picker/, home/ (HomeScreen + useLessons),
                               # vocab/, games/, stats/
```

## 4. Nguyên tắc port

1. **Logic → `lib/` trước, UI sau.** Copy hàm thuần từ legacy JS, sửa kiểu TS;
   viết vitest test cho các hàm quan trọng (xem `lib/*.test.ts` — ví dụ
   `db.test.ts` 12 test, `app.smoke.test.tsx` 3 test).
2. **Dữ liệu qua `repo` (IDB)** — không đọc localStorage trong UI. Migration
   tự động khi boot (`migrateIfNeeded`).
3. **Store phối hợp, không chứa logic** — gọi `applyResult`/`recordAnswer`…
   rồi persist qua `saveEntries/saveDaily/saveHistory`.
4. **So sánh với legacy qua e2e** — hành vi giữ nguyên (bảng quy tắc trong
   docs/DESIGN.md §Hành vi quan trọng).

## 5. Lưu ý triển khai

- **`runTx` trả mảng kết quả** → 1 request phải destructure: `const [x] = await runTx(...)`.
- **`replaceAll` = 2 transaction** (xóa getAllKeys + ghi). KHÔNG dùng cursor để
  xóa: `c.delete()` chạy sau nhiều tick → transaction inactive → InvalidStateError
  (xảy ra với fake-indexeddb khi có tx khác xen vào; cũng là rủi ro trình duyệt).
- **History không có id khi ở store** — `saveHistory` sinh `id` khi ghi.
- **wordRoot có thể là object** (`{p,e,v,…}`) cho 33 từ EN — dùng `rootText()`.
- **Zustand subscribe theo selector** — gọi `useCourseStore()` cả store sẽ
  re-render nhiều; ưu tiên `useCourseStore((s) => s.field)`.
- **Smoke test cần chờ async boot** — dùng `waitFor` poll thay vì sleep cố định
  (enterCourse 524 từ mất ~100ms; click sớm → race với boot).
- **fake-indexeddb**: đừng `deleteDatabase` khi connection cũ còn mở (bị block);
  reset dữ liệu qua repo.

## 6. Test & verify

```bash
npm run lint && npm run typecheck && npm run format:check   # static
npm run test:react        # vitest: db (12) + smoke (3) — Node/CI
node _e2e.js              # 142 test legacy (guard)
npm run build             # dist/ + dist/legacy/
```

CI (GitHub Actions) chạy: lint → typecheck → test:react → build (+ job API).
