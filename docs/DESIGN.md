# Thiết kế UI/UX — English Learning (Design v3 "Từ điển giấy")

> Bản thiết kế lại TOÀN BỘ giao diện (Design v2 → v3): thoát khỏi look
> "glass xanh" thông thường, theo **mỹ học từ điển giấy / thư viện cổ** —
> giấy ấm, mực, chữ serif cho từ, con dấu vermillion, đường kẻ nhòe, hình
> khối ít bo tròn. Legacy vẫn chạy song song tại `/legacy/`.

## Ý tưởng (concept)

Ứng dụng như một **cuốn từ điển giấy + sổ tay học tập**: mỗi từ là một "mục từ"
(headword serif to + IPA + nghĩa đánh số), thẻ bài là "phiếu giấy kẻ dòng",
bài học là "thẻ index" có tab phân loại, khóa học là hai "bìa sách" có gáy màu,
nút bấm là "con dấu" ấn xuống giấy. Một chi tiết dễ nhớ: **"giống đang lật một
cuốn từ điển cũ"**.

## Mục tiêu

- **Mobile-first** — app học từ vựng dùng chủ yếu trên điện thoại.
- **Chữ đẹp cho tiếng Việt** — font **Be Vietnam Pro** (400–800) cho UI + serif
  **Lora** (400–700 + italic, hỗ trợ tiếng Việt) cho các TỪ/tựa đề. Cả hai bundler
  vào build (PWA precache `woff2`) → offline vẫn đủ font.
- **Dark mode "Đêm mực"** — giấy ấm → than ấm, chữ giấy da. Mặc định theo
  `prefers-color-scheme`, nút 🌙/☀️ trên header lưu `localStorage['el_theme']`;
  script inline `index.html` đặt theme sớm chống FOUC.
- **Course theming** — Tiếng Anh (con dấu vermillion) / Tiếng Trung (đỏ son)
  qua `body[data-course]`.
- **Motion chuẩn** — easing tùy biến (`--ease-out` / `--ease-inout`), hover chỉ
  trên thiết bị `pointer:fine`, tôn trọng `prefers-reduced-motion`, không
  `transition: all`.

## Design tokens (`src/styles/app.css`)

### Light — "Giấy nhẹ buổi chiều"
| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `--bg` | `#f3ede1` | nền giấy ấm |
| `--surface` | `#fbf7ec` | thẻ giấy da |
| `--surface-2` | `#ece5d2` | nền phụ, chip, track |
| `--ink / 2 / 3` | `#2b2a24 / #6c6455 / #9a9079` | chữ chính/phụ/nhạt |
| `--line / strong` | `#e3dac5 / #cfc2a6` | hairline viền |
| `--brand` | `#b3402c` | con dấu vermillion (ghi đè theo khóa) |
| `--brand-soft` | `#f3dcd2` | nền nhạt của brand |
| `--amber / rose / sky` | trạng thái | new / sai / mastered |
| `--font-display` | `'Lora', serif` | từ, tựa đề, số liệu nổi bật |

### Dark — "Đêm mực"
Giấy → than ấm: `--bg #191a15`, `--surface #222219`, `--ink #ece5d2`,
`--brand #d46a4f`, hairline `#333026`. Con dấu sáng hơn để đủ tương phản.

## Font

- `@fontsource/be-vietnam-pro` (400/500/600/700/800) — UI, nội dung.
- `@fontsource/lora` (400/500/600/700 + 400-italic) — **các từ** (headword
  flashcard/study/detail/vocab), tựa hero, số trong ring, brand wordmark.
- Import trong `main.tsx`; `vite.config.ts` precache `**/*.woff2`.

## Hình khối & chi tiết

- **Radius nhỏ** (`--radius 12px`, `--radius-sm 8px`) — ít bo tròn hơn v2.
- **Hairline** 1px khắp nơi; chia sense = đường kẻ; chia syn/ant = nét đứt.
- **Nút = con dấu**: hard-shadow 2px màu `--brand-strong` bên dưới; khi bấm
  `translateY(2px)` (ấn con dấu xuống) + `scale(0.97)`; variant `.soft`/`.ghost`/
  `.danger`; size `.sm`/`.lg`.
- **Thẻ giấy** (`.card`, `.lesson-card`, `.fc-face`, `.study-word`): viền hairline,
  bóng nhẹ; mặt thẻ có **dòng kẻ nhòe** (`repeating-linear-gradient`).
- **Lesson card** có **tab phân loại vermillion** ở mép trên (như thẻ index).
- **Course card** có **gáy sách màu** 8px mép trái + cico dạng huy chương tròn.
- **Nav dưới**: bookmark tab — tab active có **thanh vermillion 3px ở mép trên**.
- **Progress ring**: track chấm (dashed), fill brand; label serif.
- **Focus**: outline nét đứt (như ghi chú bút chì) thay cho box-shadow mặc định.
- **Scrollbar**: mảnh, màu `--line-strong`.

## Chuyển động (theo Emil design-engineering)

| Trường hợp | Giá trị |
| --- | --- |
| Button press | `transform 140ms --ease-out` + `scale(0.97)`/`translateY(2px)` |
| Screen in | `screen-in 220ms --ease-out` (opacity + translateY 8px) |
| Option feedback | `option-pop 250ms --ease-out` (0.96 → 1.02 → 1) |
| Ring / progress bar | `600ms --ease-inout` |
| Hover lift | chỉ trong `@media (hover:hover) and (pointer:fine)` |
| `prefers-reduced-motion` | tắt mọi animation/transition |
| Quy tắc | không `transition: all`; chỉ transform/opacity/color |

## Các màn hình

### Picker — hai "bìa sách"
Logo huy chương + tựa serif + 2 thẻ khóa (Tiếng Anh 🇬🇧 / Tiếng Trung 🇨🇳) có
gáy màu; "Chọn khóa học của bạn…" nghiêng italic; feature tags bên dưới.

### Hôm nay (Home — hub điều hướng)
- **Hero trang giấy kẻ dòng**: ProgressRing (x/quota) + lời chào serif + date
  italic + stat pills **bấm được → chuyển trang**.
- **Quick actions**: 4 thẻ nhanh (Học từ mới → study · Ôn tập → games ·
  Kho từ vựng → vocab · Thống kê → stats) — click → chuyển trang.
- **Bài học từ vựng** (en): lưới thẻ index có tab vermillion; "Học bài này →"
  mở trang học bài; "🎮 Ôn bài này" → games theo bài.

### Từ vựng (Vocab)
Thanh tìm kiếm (ngăn kéo tra cứu), chip bài học, danh sách **mục từ**:
headword serif + IPA + trạng thái (chấm tròn); bấm từ → **trang chi tiết từ**.

### Chi tiết từ (WordDetail — trang đầy đủ)
Hero giấy kẻ dòng + **từ serif 40px**; các sense đánh số (① ② ③) ngăn bởi
hairline; ví dụ nghiêng; đồng nghĩa/trái nghĩa/tags; "← Quay lại".

### Ôn tập (Games)
Menu game (5 thẻ: Flashcard · Dịch nghĩa {Nguồn}–{Việt} · Dịch nghĩa Anh–Anh (chỉ
khóa en) · Đồng nghĩa · Trái nghĩa); **Flashcard** = phiếu giấy kẻ dòng lật 3D, từ
serif 30px; **Dịch nghĩa** = 2 game MỘT CHIỀU (vi: hiện từ, gõ nghĩa Việt;
en: hiện định nghĩa Anh, gõ TỪ VỰNG), chữ bị che + gợi ý từng chữ, Enter = kiểm
tra → Enter = câu tiếp; **Choice** = 4 đáp án kiểu
giấy, đúng/sai đổi màu con dấu + ✓/✗ + animation pop.

### Học bài (Study — trang đầy đủ)
Mục từ serif 38px + IPA + từng sense + "Từ tiếp theo →"; hết bài: 2 nút
"Học tiếp →" / "🎮 Ôn tập"; thanh tiến độ kiểu thước đọc.

### Thống kê (Stats)
Hero + biểu đồ 7 ngày (cột "gáy sách", hôm nay serif đậm, ngày 0 = nét đứt),
chuỗi ngày, lịch sử luyện.

## Danh sách class CSS chính

`.btn (.sm/.lg/.soft/.ghost/.danger)` · `.card` · `.chip` · `.pos-chip` ·
`.hero(.ring)` · `.ring-*` · `.stat(.btn)` · `.quick-card` · `.lesson-card/.grid`
· `.course-card` · `.word-item` · `.search-bar` · `.detail-hero/.word` ·
`.fc-face/.fc-word` · `.option(.right/.wrong)` · `.opt-key` · `.feedback`
· `.study-*` · `.mini-bars` · `.toast` · `.modal` · `.speak-btn` · `.badge`

> ⚠️ Smoke test phụ thuộc: `button.course-card`, `.app-nav`, `button.nav-btn`,
> các nhãn 'Hôm nay'/'Từ vựng'/'Ôn tập'/'Thống kê', 'Đã học hôm nay',
> 'Tất cả từ', 'Flashcard', 'Kho từ vựng', 'Tiếng Anh'/'Tiếng Trung' — giữ nguyên.

## Trước → Sau (Design v2 → v3)

| Khía cạnh | v2 | v3 |
| --- | --- | --- |
| Look | glass xanh + emerald | giấy ấm + mực + vermillion |
| Chữ | BE Vietnam Pro toàn bộ | + Lora serif cho từ/tựa |
| Radius | 16–24px bo tròn | 8–18px vuông vức |
| Nút | gradient mềm | con dấu hard-shadow, ấn xuống |
| Nav active | pill bo tròn | bookmark tab 3px mép trên |
| Thẻ | card phẳng | phiếu giấy kẻ dòng, tab index |
| Focus | box-shadow ring | outline nét đứt (bút chì) |
| Motion | ease mặc định | easing tùy biến + reduced-motion |
