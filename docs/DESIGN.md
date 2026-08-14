# Thiết kế UI/UX — English Learning (GĐ 3)

> Tài liệu này mô tả **design system mới** của app React (GĐ 3) và cách nó thay
> thế giao diện legacy. Legacy vẫn chạy song song tại `/legacy/` cho tới khi
> port xong toàn bộ màn hình.

## Mục tiêu

- **Mobile-first** — app học từ vựng dùng chủ yếu trên điện thoại.
- **Thoáng, tròn, ấm** — thay giao diện legacy chật, bảng nhập.
- **Course theming** — khóa Tiếng Anh (xanh ngọc emerald) / Tiếng Trung (hồng rose)
  đổi màu toàn cục qua `body[data-course]`.
- **Ít bước chạm** — mọi thao tác chính (học từ mới, ôn tập, tra từ) ≤ 2 chạm.
- **Phản hồi tức thì** — feedback đúng/sai có màu, toast, streak live.

## Design tokens (`src/styles/app.css`)

| Token            | Giá trị          | Dùng cho                    |
| ---------------- | ---------------- | --------------------------- |
| `--brand`        | theo khóa học    | nút chính, active state     |
| `--brand-soft`   | nền nhạt         | hero, badge, flashcard back |
| `--ink / 2 / 3`  | chính/phụ/nhạt   | chữ                         |
| `--surface/2`    | thẻ / nền phụ    | card, chip                  |
| `--amber/rose`   | trạng thái       | new (vàng), sai (hồng)      |
| `--radius 16px`  | bo góc lớn       | card                        |
| `--shadow-1/2`   | đổ bóng nhẹ      | nổi khối                    |

**Trạng thái từ** (dot màu, giống legacy):
`🟡 new` (amber) · `🟢 learning` (brand) · `🔵 mastered` (sky).

## Layout

- **Header**: logo/brand (bấm về Picker), streak 🔥, chip đổi khóa.
- **Main**: nội dung theo tab, tối đa 560px, căn giữa.
- **Bottom nav** (4 tab): Hôm nay · Từ vựng · Ôn tập · Thống kê — cố định, blur.

## Component tái dùng (`src/components/ui.tsx`)

- `Card` — khối nền trắng bo góc.
- `Button` — `primary/soft/ghost/danger` + kích thước `sm`; hỗ trợ `style`.
- `Chip` — lọc/điều hướng ngang (cuộn mượt, ẩn scrollbar).
- `ProgressBar` — tiến độ ngày / kho từ.
- `Speak` — nút 🔈 phát âm (Web Speech API, BCP-47).
- `PosChips` — loại từ (noun/verb…).
- `EmptyState` — trạng thái rỗng có emoji lớn.
- `Toast` — thông báo nổi 2.2s.

## Màn hình

### Picker khóa học
Hai thẻ lớn (Tiếng Anh 🇬🇧 / Tiếng Trung 🇨🇳) → `enterCourse`.

### Hôm nay (Home)
- **Hero**: lời chào theo giờ, thống kê nhanh, progress "x/quota từ".
- **Bài học từ vựng** (en): lưới card chọn bài (cuộn nếu nhiều) → chọn bài nào
  hiện ngay **danh sách từ của bài** (đọc thẳng file bài — xem trước trước khi gộp):
  word + IPA + loại từ + nghĩa Việt, chấm trạng thái (chưa học / mới / đang học /
  đã thuộc); bấm từ đã có → mở WordDetail ở tab Từ vựng.
  Nút **"Học bài này →"** gộp 20 từ vào kho (pickLesson, idempotent);
  nút **"🎮 Ôn bài này"** → tab Ôn tập với phạm vi = bài đã chọn.
- **Thẻ từ mới**: từ + IPA + nghĩa + ví dụ; 2 nút "Ôn lại sau" / "Tôi đã hiểu".
- **Ôn tập nhanh**: từ đến hạn hôm nay (`lastReviewDay !== hôm nay`), bấm → flashcard.

### Từ vựng (Vocab)
- Chips: `Tất cả từ` + từng bài học; xem từ theo bài, nút "Học bài này".
- Tìm kiếm (từ / nghĩa), lọc trạng thái.
- **WordDetail**: từ + IPA + loại từ luôn hiện; nghĩa theo từng sense;
  đồng nghĩa/trái nghĩa/tags/gốc từ/bài học qua nút mở rộng (collapse).

### Ôn tập (Games)
- Cài đặt phiên: phạm vi (toàn bộ / 1 bài), số lượng (Tất cả/10/20/50 — lưu).
- 4 game:
  - **Flashcard** 🃏 — lật thẻ (Space), 1/2/3 = chưa nhớ/đã nhớ/bỏ qua.
  - **Dịch nghĩa** ✍️ — hai chiều ngẫu nhiên, gợi ý dần từng chữ (`maskText`).
  - **Đồng nghĩa / Trái nghĩa** 🔁↔️ — 4 đáp án, phím 1-4.
- Sai → đưa về cuối hàng đợi (tối đa 1 lần/từ), tổng kết + "Ôn lại từ sai".

### Thống kê (Stats)
Streak, hôm nay, % đúng, kho từ (mới/đang học/đã thuộc), lịch sử 10 gần nhất.

## Hành vi quan trọng (port từ legacy — giữ nguyên ngữ nghĩa)

| Quy tắc legacy | React |
| -------------- | ----- |
| 8 từ mới/ngày | `DAILY_QUOTA = 8` |
| 3 đúng liên tiếp → mastered | `applyResult` trong `lib/learning.ts` |
| Sai → requeue 1 lần | `requeueIfWrong` trong `lib/games.ts` |
| Flashcard: lật không tính điểm | `seenOnce` + không gọi `recordAnswer` khi lật |
| Từ cần có nghĩa đích mới học được | `hasTarget` trong `buildPool` |
| History cap 800 | `pushHistory` |
| localStorage → IDB 1 lần | `migrateIfNeeded` (GĐ 2) |

## State & data flow

```
React components ── đọc ──> useCourseStore (zustand) ── ghi ──> repo (IDB)
                            │
                            └── logic thuần: lib/learning.ts, lib/games.ts,
                                lib/format.ts, data/seed.ts, data/lessons.ts
```

- Mọi biến đổi dữ liệu là **hàm thuần trong `lib/`** → test được (vitest).
- Store chỉ phối hợp: đọc IDB → chạy logic → persist.
- Không bao giờ tải 41MB JSONL / 25MB bank vào app — chunk/bài học tải đúng 1 file khi cần (shim `window.VocabApp`).

## CSS classes chính (đã có trong `styles/app.css`)

`hero, stats, stat, card, chip, chip-row, pos-chip, progress-track/fill,
word-list, word-item, status-dot, learn-card, flashcard (fc-*), masked,
options/option/opt-key, feedback good/bad, toast, speak-btn, game-grid,
game-top, game-title, streak-chip, badge, input-answer, input, empty-state,
app-nav/nav-btn, app-header/brand, picker-screen, course-card, lesson-grid`
