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

---

# Design v4 "Từ điển biên tập" (Editorial Dictionary) — 2025

> Bản thiết kế lại theo file tham chiếu `chinese-app-ui.jsx` (rail trái +
> topbar + khung 2-pane). Áp dụng cho **cả 2 khóa** (Tiếng Anh theo cùng hệ,
> nhấn riêng ở course theming). Không còn "giấy ấm" — chuyển sang **giấy
> trắng, mực đậm, ấn đỏ con dấu + ngọc jade**, giọng thư viện/từ điển biên tập.

## Concept

Ứng dụng như một **từ điển biên tập hiện đại**: thanh điều hướng dọc (rail)
trái cố định, masthead topbar (eyebrow + tựa), và **khung 2-pane** làm màn hình
trung tâm — danh sách từ bên trái, chi tiết từ bên phải (không tách trang).
Chữ Hán chạy font serif CJK hệ thống (`--font-hanzi`: Noto Serif SC → 宋体),
từ tiếng Anh dùng serif Lora; UI dùng **Inter Variable** (bundle qua
`@fontsource-variable/inter`, PWA precache giữ offline).

## Tokens chính (light)

| Token | Giá trị | Vai trò |
| --- | --- | --- |
| `--bg` | `#ffffff` | giấy trắng |
| `--surface-2` | `#faf8f5` | nền danh sách / ô nhập |
| `--ink` | `#1c1b19` | mực đậm |
| `--ink-3` | `#7a7369` | chữ nhạt |
| `--line` | `#e9e4dc` | hairline |
| `--brand` | `#b8332b` | ấn đỏ con dấu (cả 2 khóa) |
| `--jade` | `#3d6b5c` | ngọc jade — accent khóa zh (radical, ví dụ, dot) |
| `--font-hanzi` | serif CJK hệ thống | Hán tự mọi nơi (danh sách, chi tiết, rail-mark) |

Dark mode giữ cấu trúc token (đêm mực), chỉ dịch hue cho hợp giấy trắng:
`--bg #14130f`, `--brand #e35a4e`, `--jade #7fb2a0`.

## Thay đổi cấu trúc

- **Shell**: `.app` = rail (desktop ≥760px, rộng 76px, sticky, có `rail-mark`
  hình ấn Hán/EN) + `.rail-main` (masthead + main max-width 1160). Mobile:
  rail chuyển thành nav dưới (giữ class `.app-nav`/`nav-btn` — smoke test vẫn
  đúng). Masthead: eyebrow + tựa + streak 🔥 (en) + 🌙/☀️ + ⚙️ + chip khóa học.
- **Từ vựng (en)** = khung 2-pane: chip bài học + tìm kiếm + lọc trạng thái +
  danh sách (trái) / **WordDetail mở ngay trong khung** (phải). Bỏ trang chi
  tiết tách rời; `openDetail` chuyển tab `vocab` để mở đúng chỗ từ Home/Games.
- **Từ điển (zh)** = đúng mẫu tham chiếu: topbar tra Hán tự/pinyin/vi/en + chip
  HSK 1–6 kèm số lượng, 2-pane list/detail. Chi tiết gồm: hero Hán tự to (88px),
  đường cong thanh điệu từng chữ, phát âm TTS, **con dấu HSK**, bộ thủ (radical
  chip ngọc), lượng từ/phồn thể/tần suất, thứ tự nét từng chữ, nghĩa khác, ví
  dụ, nút **Thêm vào kho** / **Luyện viết chữ này** (mở WritingScreen đúng từ
  qua `zhWriteTarget`).
- **Điểm đặc sắc zh**: `ToneCurve` SVG 5 thanh thu gọn; dot ngọc xanh cạnh mỗi
  từ chỉ "đã trong kho"; seal-badge xoay -3°; stroke-row hiện từng chữ + số nét.

## Nguyên tắc giữ vững

- Vẫn UI tiếng Việt, offline-first, không react-router, không bẻ smoke test
  (`.app-nav`, `button.nav-btn`, nhãn tab, 'Tất cả từ', 'Flashcard',
  'Kho từ vựng').
- Mỗi màn hình vẫn là 1 file, lazy tải dữ liệu đúng nhu cầu (hsk.json chỉ load
  khi mở tab từ điển zh).

---

# Tách 2 giao diện (English v3 / Chinese v4) — 2025

> Sau khi trải nghiệm cả hai look, quyết định: **KHÔNG dùng chung shell nữa**.
> Mỗi khóa có giao diện riêng hoàn toàn, mở ở cấp route:

- **Tiếng Anh** → `AppShell` (Design v3 "Từ điển giấy": giấy ấm, nav dưới,
  max-width 720, Lora + Be Vietnam Pro). Đã hoàn trả nguyên trạng.
- **Tiếng Trung** → `features/zh/ZhRoot.tsx` (Design v4 theo `chinese-app-ui.jsx`:
  rail trái 5 tab **Từ điển · Flashcard · Luyện viết · Ôn tập · Tiến độ**,
  nền trắng, ấn đỏ con dấu viền, ngọc jade, Hán tự serif hệ thống). Không có
  trang "Hôm Nay": mở khóa là thẳng vào Từ điển.
  - **Từ vựng theo HSK**: mỗi cấp HSK 1–6 chia **单字 (từ đơn)** và
    **词语 (từ ghép)**; mỗi phần chia **bài học 20 mục**. Số liệu thật từ
    `hsk.json`: từ đơn 1.050 (212/176/154/154/170/184), từ ghép 4.313.
  - Dữ liệu tính ngay tại client từ hsk.json — không sinh thêm file.
  - Không SM-2 streak 🔥; SRS vẫn dùng (Ôn tập tab), lịch sử theo daily.

## Tách giao diện thế nào (kỹ thuật)

- `App.tsx`: `if (course?.seed === 'zh') return <ZhRoot/>` — nằm TRƯỚC mọi
  routing của shell tiếng Anh. Picker chọn khóa là điểm rẽ chung.
- CSS zh hoàn toàn **scoped trong `.zh-app`** (biến `--seal`/`--jade`/... khai
  báo trên nút gốc) → không cần đụng sheet tiếng Anh, không rò rỉ class.
- Tab cũ `zhView`/các màn zh cũ (`ZhDictScreen`, `ReviewScreen`,
  `WritingScreen`, `ToneQuizScreen`, `GrammarScreen`) giữ nguyên trong repo
  nhưng không còn được route — bản zh mới tự dựng view riêng trong `ZhRoot`.
- Smoke test e2e không đổi: nhận diện khóa Tiếng Anh qua shell cũ (v3) — zh
  là nhánh riêng, không ảnh hưởng.

---

# Giao diện TIẾNG ANH v5 "LEXICON" — 2025 (theo `lexicon-ui.jsx`)

> Bản thiết kế lại trang học tiếng Anh theo file mẫu `lexicon-ui.jsx`
> (tra từ điển hiện đại: mực navy + teal + kẻ linen). Khóa zh GIỮ NGUYÊN
> giao diện v4 `chinese-app-ui.jsx` — hai khóa vẫn tách hoàn toàn.

## Palette en (tokens trong `:root` — thay thế v3 "Từ điển giấy")

| Token | Light | Dark "Đêm mực" |
| --- | --- | --- |
| `--bg` | `#f7f7f4` | `#10131c` |
| `--surface` | `#ffffff` | `#171b27` |
| `--surface-2` (zebra/active) | `#efefef` | `#1e2433` |
| `--ink` | `#1e2a44` (navy) | `#ececea` |
| `--ink-2 / --ink-3` | `#5a5540 / #8a836a` | `#b3b1a6 / #827f70` |
| `--line / --line-strong` | `#d6ceb8 / #bdb49b` (linen) | `#2c3140 / #3b4152` |
| `--brand` (teal) | `#256b67` | `#58a29d` |
| `--amber` | `#c98a2e` | (giữ) |
| `--rose` | `#b14a3c` | (giữ) |
| `--sky / --purple` | `#3e7ca6 / #7a6b9e` | (giữ) |

## Font en

- **Work Sans** (body) — `@fontsource-variable/work-sans`, có subset Vietnamese.
- **Fraunces** (từ vựng + tựa) — `@fontsource/fraunces` 500/600 + italic 500.
- **IBM Plex Mono** (IPA, số, nhãn tag) — `@fontsource/ibm-plex-mono` 400/500.
- Cả 3 đều bundle qua `main.tsx` (Vietnamese nằm trong unicode-range của file
  static — không cần import subset riêng).

## Shell en (AppShell — sidebar)

- Desktop (≥760px): **sidebar trái 210px** `--nav-w`: brand serif "Lexicon ·
  English" + 4 nút (Bài học 📖 / Từ vựng 🗂️ / Ôn tập 🧠 / Thống kê 📈), active
  = viền teal 3px trái + nền `--surface-2`. Header sticky bên phải (brand
  Fraunces + 🔥 streak + 🌙☀️ + ⚙️ + chip khóa).
- Mobile (≤760px): sidebar chuyển thành **nav dưới** cố định (giữ class
  `.app-nav` + `button.nav-btn` cho smoke test; `.nav-brand` ẩn).
- Nội dung `--app-max: 1020px`, cột `--content-max: 860px`.

## Các màn hình mới

- **Bài học (Home)**: thẻ bài `lex-lesson-card` — vòng tiến độ `ll-ring`
  (mono %), eyebrow "Bài N", title Fraunces, thanh `ll-bar` màu theo bài (5 màu
  tuần tự), mono "learned/total từ · tag", nút Học bài/Tiếp tục/Ôn tập. Bấm →
  `startLessonStudy(id)` (guided study) hoặc `startGame('flashcard', onlyIds)`
  khi bài đã xong. Giữ text "Đã học hôm nay: X/Y" cho smoke test.
- **Từ vựng (Vocab)**: `lex-toolbar` (search + select "Tất cả từ"/theo bài) +
  **bảng kẻ sọc** `lex-table` (4 cột: Từ+IPA Fraunces/mono · Loại từ tag ·
  Nghĩa · #Bài). Bấm hàng → **MODAL** `lex-overlay` + `lex-modal` (word 34px +
  nút đọc, IPA, tag, các field Anh-Anh/Anh-Việt/Ví dụ, đồng/trái nghĩa tag,
  nút Đóng tối). `detailId` từ App/Stats/games giờ render cùng overlay.
- **Ôn tập (Games)**: giữ nguyên engine game + menu (Flashcard/Dịch nghĩa/
  Đồng nghĩa/Trái nghĩa) — tự tái-skin theo token lexicon.
- **Thống kê (Stats)**: 4 thẻ số (Từ đã học/Đã thuộc/Hôm nay/Bài xong) +
  biểu đồ 7 ngày dạng cột CSS (`lex-week`) + danh sách thanh tiến độ từng bài
  ("Kho từ vựng · tiến độ từng bài" — giữ text smoke).

## Kỹ thuật

- Tất cả class en mới tiền tố `lex-*` / `lt-*` / `ll-*` / `lw-*` / `lb-*` /
  `lm-*` — không đụng class zh (`.zh-app` scoped riêng).
- Tokens v3 bị thay bằng lexicon ở `:root` → toàn bộ component cũ (study,
  games, chips, hero, badge…) tái-skin tự động, không cần sửa JSX.
- Mobile bảng từ ≤600px: ẩn header bảng, hàng xếp dọc.
- Fonts mới thêm dep: `@fontsource-variable/work-sans`, `@fontsource/fraunces`,
  `@fontsource/ibm-plex-mono` (giữ nguyên inter + be-vietnam-pro + lora).
