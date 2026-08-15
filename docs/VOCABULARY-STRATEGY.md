# Chiến thuật LƯU & HỌC toàn bộ từ vựng (207.272 từ)

> Trạng thái: đề xuất (GĐ 4+) · Tool làm giàu đã có: `data/scripts/enrich-vi-ipa.py`

## 1. Hiện trạng & vấn đề

| Kho | Số lượng | Dùng để | Có nghĩa Việt / IPA? |
|---|---|---|---|
| `data/raw/english-dictionary.jsonl` | 207.272 dòng (41MB) | nguồn master | ❌ chỉ EN |
| Bank chunk (`js/bank/`, 104 file) | 207.272 entry (24.7MB) | **tra từ điển** offline | ❌ (bản gốc) / ✅ (bản giàu) |
| Seed (523 EN + 90 ZH) | ~613 từ | kho học mặc định | ✅ |
| Lessons (7 bài × 20 từ) | 123 từ đã merge | bài học | ✅ |

**Vấn đề:** app chỉ HỌC được ~646 từ (2% ngân hàng) vì mọi từ học được phải có
nghĩa đích (`hasTarget`). Muốn học toàn bộ 207k từ phải có (a) bản dịch tiếng
Việt + IPA cho toàn bộ, và (b) cơ chế đưa từ vào kho học theo nhu cầu.

## 2. Nguyên tắc cốt lõi (giữ nguyên kiến trúc hiện tại)

1. **KHÔNG bao giờ nạp 207k từ vào seed / bộ nhớ học.** Vẫn giữ mô hình 3 lớp:
   - **L1 — Master data** (build-time, git-ignored): `english-dictionary.enriched.jsonl`
     = JSONL gốc + `vi` + `ipa` (+ `freq` tùy chọn). Chỉ dùng để SINH ra dữ liệu khác.
   - **L2 — Từ điển** (runtime, on-demand): bank chunks mở rộng 8 cột
     `[word, pos, def, ex, syn, ant, vi, ipa]` — app chỉ tải 1 chunk (~270KB) khi tra.
   - **L3 — Kho học** (runtime, IDB): chỉ những từ người dùng đã MỞ KHÓA
     (qua bài học, qua nút "Thêm vào kho", qua seed). Không bao giờ là 207k entry.
2. **Điều gì được học = do người dùng quyết định**, không phải tải hết về.
3. **Mọi thứ regenerable**: JSONL, bank, enriched đều nằm trong `.gitignore`
   (mục `data/raw/` + `data/scripts/out/`) — chỉ commit công cụ + docs.

## 3. Chiến thuật LƯU TRỮ

### 3.1 Làm giàu master data — `data/scripts/enrich-vi-ipa.py` ✅ (đã có)

```
python data/scripts/enrich-vi-ipa.py --limit 10000     # chạy từng bước
python data/scripts/enrich-vi-ipa.py --freq            # thêm cột freq (pip install wordfreq)
python data/scripts/enrich-vi-ipa.py --inplace         # ghi đè gốc (mặc định: file .enriched.jsonl)
```

- `vi` = Google Translate: từ đơn nghĩa dịch **TỪ** (ngắn gọn); từ đa nghĩa
  (nhiều dòng cùng word) dịch **ĐỊNH NGHĨA** theo ngữ cảnh từng nghĩa.
- `ipa` = Free Dictionary API, chỉ từ **đơn** (cụm từ để trống).
- `freq` = `wordfreq` (tần suất / triệu, ngoại tuyến) → dùng để xếp bài học.
- **Resume an toàn**: chạy lại bỏ qua DÒNG đã có (đánh dấu theo word+định nghĩa,
  không theo từ — tránh mất nghĩa của từ đa nghĩa); cache theo văn bản gốc
  (từ/định nghĩa) không gọi trùng; backoff khi bị 429/lỗi mạng.

### 3.2 Bank chunk mở rộng — `data/scripts/build-chunks.js` ✅ (đã có)

- Tự động ưu tiên file enriched nếu tồn tại (không thì dùng file gốc):
  `node data/scripts/cli.js chunks` hoặc `--src <file>`.
- Row: `[word, pos, def, example, syn[4], ant[4], vi, ipa]` — **8 cột**.
  Thiếu vi/ipa → vẫn 6 cột (tương thích ngược, app cũ không vỡ).
- Kích thước dự kiến bản giàu: ~30–35MB tổng, mỗi chunk ~300–380KB — vẫn on-demand.

### 3.3 Hiển thị — đã nối dây ✅

- Legacy `bank-loader.js` → `bankLookupWord` trả `meaning.vi` + `pronunciation`.
- Legacy `ui-modal.js` → modal "Thêm từ" tự điền sẵn **nghĩa Việt + phiên âm**
  khi tra từ (người dùng chỉ cần xác nhận).
- React `data/bank.ts` + `registry.ts` → cùng kiểu 8 cột (sẵn sàng khi port modal).

### 3.4 Kho học (IDB) — giữ nguyên, thêm 1 trường

- `entries` không đổi (schema v1). Đề xuất thêm trường tùy chọn `freq` khi
  entry sinh từ JSONL giàu → dùng để ưu tiên thứ tự hàng đợi từ mới.
- **Không lưu toàn bộ từ điển vào IDB** — sync (GĐ 5) chỉ đồng bộ PROGRESS
  (entries đã học, history, settings), không đồng bộ 30MB từ điển.

## 4. Chiến thuật HỌC

### 4.1 Thứ tự học: theo TẦN SUẤT, không theo bảng chữ cái

- JSONL hiện xếp theo alphabet ("crossing guard", "crossover"...) — học theo đó
  sẽ gặp toàn từ hiếm ngay từ đầu.
- Dùng cột `freq` (wordfreq) → sinh lesson theo `freq` giảm dần: 20 từ thông
  dụng nhất trước, càng về sau từ càng hiếm.

### 4.2 Pipeline bài học mở rộng ✅ (GĐ 4 — đã có)

```
enriched.jsonl (có vi+ipa+freq)
  → data/scripts/build-lessons.js (chế độ enriched: xếp theo freq, 20 từ/bài, không gọi API)
  → js/lessons/manifest.js + lesson-NNN.js
  → app: pickLesson → ensureLessonInCourse → auto-merge 20 từ vào entries
```

- Cơ chế hiện tại đã đủ: bài = 20 từ, chơi scoped theo `lessonId`, merge idempotent.
- Khác biệt duy nhất: nguồn từ = enriched (không phải danh sách tay `lesson-words.txt`).
- `--keep-existing` để CỘNG DỒN bài mới vào bài cũ (không xóa).
- Đã chạy thật: **300 từ thông dụng nhất → 15 bài "Từ phổ biến"** (Bài 8–22),
  giữ nguyên 7 bài chủ đề (đời sống/ẩm thực/sức khỏe/công nghệ/cảm xúc).
  Bài 8 mở đầu: week, case, nothing, person, today… (20 từ/bài, vi + ipa đầy đủ).
- Mở rộng toàn bộ 207k từ: `--limit 1000 --keep-existing` chạy nhiều lô (mỗi lô
  ~50 bài), hoặc `--from N --limit 1000` cho lô tiếp theo.

### 4.3 "Thêm vào kho học" từ từ điển — cơ chế học từ KHÔNG có trong bài

- Tra từ bất kỳ (207k) trong từ điển → nút **"＋ Học từ này"** → tạo entry từ
  row bank (vi/ipa có sẵn) → xuất hiện trong hàng đợi từ mới + ôn tập.
- Giống kiểu **Anki add**: học đúng từ bạn gặp, không bị giới hạn bởi bài có sẵn.
- Idempotent: word đã có trong entries → chỉ cập nhật nếu thêm nghĩa mới.
- Đây là cơ chế quan trọng nhất để "học toàn bộ từ vựng" — vì không ai cần học
  cả 207k từ bắt buộc; người dùng tự chọn, hệ thống luôn sẵn sàng.

### 4.4 Spaced repetition (SRS) — thay luật "3 đúng → mastered"

- Hiện tại: `applyResult` đúng 3 lần → mastered (không ôn lại nữa).
- Đề xuất giữ 3 lần đúng cho **from → learning**, sau đó lịch ôn
  **ngày +1 → +3 → +7 → +14 → +30** mới lên `mastered`:
  - `lastReviewDay` đã có sẵn trong WordEntry.
  - Thêm `nextReviewDay` (build-day số) — chọn từ ôn tập: `nextReviewDay <= today`.
  - Trả lời sai bất kỳ lúc nào → về `learning`, đặt lại lịch.
- Hiệu quả: lượng ôn mỗi ngày ổn định (~10–20 từ), nhớ dài hạn thay vì học vẹt.

### 4.5 Quota & tiến độ

- Giữ mặc định 8 từ mới/ngày; thêm lựa chọn 5/8/15/30.
- Thanh tiến độ Home hiện tính theo entries trong khóa — đổi thành
  `mastered / tổng từ trong kho học` (không phải 207k — gây áp lực vô nghĩa).
- Mục tiêu "tự chọn": mỗi tuần thêm 1–2 bài (40 từ) hoặc 20 từ tự chọn → 2.000
  từ/năm là mục tiêu thực tế, không phải 207k.

### 4.6 Tra cứu & tìm kiếm

- Vocab screen: tìm kiếm EN + **VI** trong kho học (entries — nhỏ, nhanh).
- Từ điển: tra 207k từ, giờ có nghĩa Việt + phiên âm → cũng là công cụ học
  (đọc nghĩa Việt khi gặp từ lạ trong game).

## 5. Chi phí & lộ trình

### 5.1 Chi phí API (bản full 207k)

| Loại request | Số lượng ước tính | Endpoint |
|---|---|---|
| Dịch EN→VI | ~207k (từ đơn nghĩa) + ~50k (định nghĩa đa nghĩa) | Google Translate (miễn phí, không key) |
| IPA | ~180k (từ đơn) | dictionaryapi.dev (miễn phí) |

- 3 workers × 0.25s giãn cách → **~10 từ/s ≈ 9–10 giờ** (lý thuyết); thực tế
  có retry/backoff → chạy batch đêm nhiều đợt, resume không mất.
- **Khuyến nghị**: không chạy 1 phát hết 207k — chạy `--limit 10000` mỗi đợt,
  kiểm tra chất lượng bản dịch, rồi mở rộng dần. Chất lượng Google Translate
  cho định nghĩa từ điển (~10–30 từ) khá tốt nhưng cần soi.
- GĐ 5 (FastAPI proxy) sẽ thay endpoint client bằng proxy riêng (đỡ rate-limit
  trình duyệt, có thể thêm cache server).

### 5.2 Lộ trình triển khai

| GĐ | Việc | Trạng thái |
|---|---|---|
| GĐ 4 | `enrich-vi-ipa.py` + `build-chunks` 8 cột + modal điền sẵn vi/ipa | ✅ xong |
| GĐ 4 | Chia lesson từ file giàu theo TẦN SUẤT (`build-lessons --keep-existing`) | ✅ xong (15 bài thật) |
| GĐ 4 | Nút **"＋ Học từ này"** trong modal từ điển | chưa làm |
| GĐ 4 | PWA offline (manifest + SW cho `dist/`, runtime cache bank/lessons, icon tự sinh) | ✅ xong |
| GĐ 5 | FastAPI sync (JWT, SQLite, proxy dictionary) | chưa làm |
| GĐ 6 | SRS (`nextReviewDay`) + tìm kiếm VI | chưa làm |

### 5.3 Những gì KHÔNG làm

- ❌ Nhúng seed 207k từ vào bundle (bundle đã 523KB vì 613 từ).
- ❌ Nạp toàn bộ bank vào IDB/memory.
- ❌ Sync 30MB từ điển lên server — server chỉ giữ progress + proxy dịch.
- ❌ Bắt buộc học hết 207k — hệ thống CUNG CẤP, người dùng CHỌN.

## 6. Tóm tắt quyết định

| Câu hỏi | Quyết định |
|---|---|
| Dữ liệu master cho 207k từ? | `english-dictionary.enriched.jsonl` (vi+ipa+freq), git-ignored |
| Từ điển hiển thị gì? | nghĩa EN + VI + IPA + ví dụ + syn/ant (8 cột chunk) |
| Làm sao học từ ngoài bài? | nút "＋ Học từ này" trong modal tra từ (Anki-add) |
| Thứ tự bài học? | theo `freq` giảm dần (wordfreq), 20 từ/bài |
| Lúc nào lên mastered? | 3 lần đúng + ôn SRS 1/3/7/14/30 ngày |
| Kho học tối đa? | do người dùng chọn; mục tiêu thực tế ~2.000 từ/năm |
| Đồng bộ (GĐ 5)? | chỉ progress + proxy dịch, không đồng bộ từ điển |
