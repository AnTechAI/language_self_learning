# Data Pipelines — `tools/` (4 tool sinh dữ liệu)

> Nguồn duy nhất: `data/raw/english-dictionary.jsonl` (207.272 entry — git-ignored).
> Mỗi tool đọc jsonl (hoặc API) → sinh ra dữ liệu cho app. Sẽ di dời thành
> `data/scripts` với CLI chung ở GĐ 4.

| Tool | Làm gì | Lợi ích | Đầu ra |
|---|---|---|---|
| [build-from-jsonl.js](#1-build-from-jsonljs) | Dựng từ theo danh sách: gom mọi nghĩa + dịch Việt + IPA | Thêm từ chất lượng cao vào kho cơ bản | dòng nén seed → `--apply` vào seed-data.js |
| [build-lessons.js](#2-build-lessonsjs) | Chia jsonl thành **bài học 20 từ** | Học theo bài, games theo bài | `js/lessons/` (manifest + lesson-*) |
| [build-chunks.js](#3-build-chunksjs) | Chia toàn bộ jsonl thành **chunk nhỏ** | Từ điển offline 207k từ, tải đúng 1 chunk | `js/bank/` (104 chunk + manifest) |
| [fetch-vocab.js](#4-fetch-vocabjs) | Fetch từ API Free Dictionary + Google Translate | Bổ sung từ mới + sửa POS | dòng nén seed |

API dùng: `dictionaryapi.dev` (IPA + senses) và `translate.googleapis.com/...?client=gtx`
(dịch Việt, miễn phí). Có **retry/backoff** khi 429.

## 1. build-from-jsonl.js

```bash
node tools/build-from-jsonl.js --words "gratitude brave polite"
node tools/build-from-jsonl.js --file list.txt          # 'từ, chủ đề' / @chủ đề
node tools/build-from-jsonl.js --limit 100 --tag "đời sống"
node tools/build-from-jsonl.js ... --apply              # chèn thẳng vào seed-data.js
node tools/build-from-jsonl.js ... --allow-no-ipa --phrases --max-senses 6
```

- Mặc định: chỉ TỪ ĐƠN + bắt buộc có IPA + bỏ qua từ đã có trong kho.
- Sense chính: loại từ nhiều nhất (hòa → verb > noun > adj…), nghĩa ngắn nhất.
- Đầu ra xem trước: `tools/out/jsonl-rows.js` (+ jsonl-rows.json).

## 2. build-lessons.js

```bash
node tools/build-lessons.js --file tools/lesson-words.txt   # 20 từ/bài
node tools/build-lessons.js --size 10 --words "a b c"       # tùy chỉnh
```

- Nhóm theo thứ tự danh sách → mỗi bài 20 từ, tiêu đề "Bài N · chủ đề".
- **Cache API**: `tools/out/lesson-cache.json` — chạy lại nhanh, không tốn request.
- Đầu ra: `js/lessons/manifest.js` + `lesson-001.js…` (format: docs/DATA-MODEL.md §3).
- App chỉ tải đúng bài người chọn (lesson-loader.js).

## 3. build-chunks.js

```bash
node tools/build-chunks.js            # toàn bộ jsonl → 104 chunk
node tools/build-chunks.js --size 3000
```

- 2 lượt đọc: đếm tổng → `N = ceil(total/size)` → bucket `hashFNV(word) % N`.
- **Băm phải khớp** `js/bank-loader.js` (`VA.bankHash`) — đừng đổi thuật toán một phía.
- Đầu ra: `js/bank/chunk-NNN.js` + manifest.js (format: docs/DATA-MODEL.md §4).

## 4. fetch-vocab.js

```bash
node tools/fetch-vocab.js --words "x y z" --apply
node tools/fetch-vocab.js --enrich --words "x y"    # thêm nghĩa bổ sung cho từ đã có
node tools/fetch-vocab.js --fixpos                  # chỉ vá loại từ (POS_OVERRIDE)
```

- Nguồn: `tools/new-words.txt` (hỗ trợ `@tag`) hoặc `--words`.
- `--enrich`: CHỈ THÊM sense, không ghi đè dữ liệu người dùng; idempotent.
- POS chuẩn hóa + bảng `POS_OVERRIDE` (~30 từ) vì API hay trả noun trước.

## Lưu ý chung

- **Định dạng dòng nén phải 1 dòng 1 từ** — parser dựa trên dòng (docs/DATA-MODEL.md §2).
- Sau khi `--apply` luôn chạy `node --check` (tool tự chạy).
- Sau khi sinh lessons/bank, chạy `node _e2e.js` để xác nhận không vỡ.
