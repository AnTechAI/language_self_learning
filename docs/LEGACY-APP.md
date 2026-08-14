# App Legacy — `apps/web/public/legacy/`

> App JavaScript thuần (không framework) — **bạn dùng hằng ngày**.
> Sau GĐ 0 nó nằm trong `public/` của Vite nên chạy được cả file:// lẫn `/legacy/`.

## 1. Làm gì

Toàn bộ tính năng hiện tại: kho từ vựng theo khóa học (en/zh), 7 bài học × 20 từ,
4 game ôn tập, streak, thống kê, từ điển offline 207k từ, đa nghĩa (senses).

## 2. Lợi ích của cách tổ chức này

- **Không phá app đang chạy**: legacy là nguồn duy nhất (single source) — sửa ở đây,
  vẫn chạy file:// ngay lập tức, đồng thời có sẵn trên dev server để xem thử.
- **Lưới an toàn cho GĐ 3**: khi port sang React, legacy là chuẩn so sánh; `_e2e.js`
  chạy thẳng trên code này (142 test).
- **Zero config**: Vite copy nguyên trạng vào `dist/legacy/` khi build.

## 3. Cách chạy

```bash
npm install && npm run dev        # mở http://localhost:5173/legacy/
# hoặc mở trực tiếp bằng file://:  apps/web/public/legacy/index.html
```

> ⚠️ localStorage theo ORIGIN: dữ liệu trên `localhost:5173` TÁCH BIỆT với file://.
> Đây là tính năng (thử nghiệm không phá dữ liệu thật), không phải lỗi.

## 4. Format module (IIFE + namespace)

Mỗi file `js/*.js` là một IIFE đăng ký hàm lên `window.VocabApp`:

```js
(function () {
  const VA = window.VocabApp;   // namespace chung
  VA.funcName = function (...) { ... };
})();
```

Thứ tự nạp (quan trọng — index.html liệt kê theo đúng thứ tự):

| Thứ tự | Module | Trách nhiệm |
|---|---|---|
| 1 | utils | `$`, `$$`, escapeHtml, uid, shuffle, toast… |
| 2 | config | danh sách khóa học (en/zh), quota, key settings |
| 3 | storage | đọc/ghi localStorage scoped theo khóa học + migrate dữ liệu cũ |
| 4 | tts | Web Speech API (🔈) |
| 5 | course | courseById, getCourse, khởi tạo |
| 6 | dictionary | gọi Free Dictionary API (online) |
| 7 | bank-loader | từ điển offline: tải chunk theo nhu cầu (`VA.bankLookup`) |
| 8 | seed-data | 523 từ (SEED_WORDS), toEntry, mergeSeeds, applySeedUpgrade |
| 9 | lesson-loader | bài học: tải đúng bài người dùng chọn (`VA.ensureLessonInCourse`) |
| 10 | state | trạng thái toàn cục (tab, filter, session…) |
| 11 | learning | markLearned, registerResult, streak, history |
| 12-17 | ui-* | render từng tab: picker, home, vocab, modal, games, stats |
| 18 | main | boot() + điều hướng tab + vào/ra khóa học |

## 5. Format dữ liệu

- Entry chuẩn + dòng nén seed + bài học + chunk từ điển: xem **docs/DATA-MODEL.md**.
- localStorage keys:
  - `vocab_settings_v1` — cài đặt toàn cục (courseId, gameQty, seedVersion)
  - `course_{en,zh}_entries` / `_daily` / `_history` — database riêng từng khóa

## 6. Test

```bash
node _e2e.js        # 142 test: harness tự dựng DOM giả, eval thẳng js/*.js
node --check <file> # kiểm tra cú pháp từng module
```

`_e2e.js` nạp các module theo đúng thứ tự index.html vào một DOM giả (stub) —
không cần trình duyệt.
