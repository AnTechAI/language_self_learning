# Data Pipelines — `tools/` (5 tool sinh dữ liệu)

> Nguồn duy nhất: `data/raw/english-dictionary.jsonl` (207.272 entry — git-ignored).
> Mỗi tool đọc jsonl (hoặc API) → sinh ra dữ liệu cho app. Sẽ di dời thành
> `data/scripts` với CLI chung ở GĐ 4.

| Tool | Làm gì | Lợi ích | Đầu ra |
|---|---|---|---|
| [build-from-jsonl.js](#1-build-from-jsonljs) | Dựng từ theo danh sách: gom mọi nghĩa + dịch Việt + IPA | Thêm từ chất lượng cao vào kho cơ bản | dòng nén seed → `--apply` vào seed-data.js |
| [build-lessons.js](#2-build-lessonsjs) | Chia jsonl thành **bài học 20 từ** | Học theo bài, games theo bài | `js/lessons/` (manifest + lesson-*) |
| [build-chunks.js](#3-build-chunksjs) | Chia toàn bộ jsonl thành **chunk nhỏ** | Từ điển offline 207k từ, tải đúng 1 chunk | `js/bank/` (104 chunk + manifest) |
| [fetch-vocab.js](#4-fetch-vocabjs) | Fetch từ API Free Dictionary + Google Translate | Bổ sung từ mới + sửa POS | dòng nén seed |
| [enrich-vi-ipa.py](#5-enrich-vi-ipapy) | Làm giàu **toàn bộ** jsonl: nghĩa Việt + IPA (+ freq) | Nền tảng học 207k từ (xem VOCABULARY-STRATEGY.md) | `english-dictionary.enriched.jsonl` |

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
node tools/build-lessons.js --file tools/lesson-words.txt   # 20 từ/bài (nguồn jsonl + API)
node tools/build-lessons.js --size 10 --words "a b c"       # tùy chỉnh
```

- Nhóm theo thứ tự danh sách → mỗi bài 20 từ, tiêu đề "Bài N · chủ đề".
- **Cache API**: `tools/out/lesson-cache.json` — chạy lại nhanh, không tốn request.
- Đầu ra: `js/lessons/manifest.js` + `lesson-001.js…` (format: docs/DATA-MODEL.md §3).
- App chỉ tải đúng bài người chọn (lesson-loader.js).

### Chế độ ENRICHED (GĐ 4) — chia bài từ TOÀN BỘ từ đã làm giàu, KHÔNG gọi API

Có `data/raw/english-dictionary.enriched.jsonl` (từ enrich-vi-ipa.py) thì tool
MẶC ĐỊNH dùng nguồn đó: đọc thẳng vi/ipa/freq → **xếp theo tần suất** (từ thông
dụng trước) → chia bài 20 từ. Một từ nhiều nghĩa → nghĩa chính (POS ưu tiên +
definition ngắn nhất) + tối đa 4 nghĩa bổ sung `{p,i,e,v,x,s,a}`.

```bash
node tools/build-lessons.js                              # enriched, theo tần suất
node tools/build-lessons.js --source raw                 # ép dùng jsonl gốc + API
node tools/build-lessons.js --src <file>                 # file enriched khác
node tools/build-lessons.js --limit 1000                 # chỉ 1000 từ thông dụng nhất
node tools/build-lessons.js --from 1000 --limit 1000     # lô tiếp theo (bài 51+)
node tools/build-lessons.js --order alpha                # xếp a→z thay vì tần suất
node tools/build-lessons.js --include-seed               # giữ cả từ đã có trong seed
node tools/build-lessons.js --keep-existing              # THÊM bài mới, giữ bài cũ
node tools/build-lessons.js --out-dir /tmp/lessons       # ghi ra thư mục khác (test)
```

- Chỉ giữ từ HỌC ĐƯỢC (có nghĩa Việt), bỏ từ đã có trong seed (trừ `--include-seed`).
- `--keep-existing` đọc manifest cũ (hỗ trợ key có/không nháy) → tiếp số bài, không xóa.
- Luồng chuẩn: enrich → chia bài → `--limit` theo lô (mỗi lô ~50 bài) → `--keep-existing` để cộng dồn.

## 3. build-chunks.js

```bash
node tools/build-chunks.js            # toàn bộ jsonl → 104 chunk
node tools/build-chunks.js --size 3000
node tools/build-chunks.js --src data/raw/english-dictionary.enriched.jsonl
```

- 2 lượt đọc: đếm tổng → `N = ceil(total/size)` → bucket `hashFNV(word) % N`.
- **Băm phải khớp** `js/bank-loader.js` (`VA.bankHash`) — đừng đổi thuật toán một phía.
- Tự ưu tiên **file enriched** nếu tồn tại → row 8 cột `[word,pos,def,ex,syn,ant,vi,ipa]`;
  thiếu vi/ipa → vẫn 6 cột (tương thích ngược).
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

## 5. enrich-vi-ipa.py

> Tool Python làm giàu TOÀN BỘ jsonl (207k từ) — nền tảng cho chiến thuật
> học toàn bộ từ vựng (docs/VOCABULARY-STRATEGY.md). Chạy: `python tools/enrich-vi-ipa.py`

```bash
python tools/enrich-vi-ipa.py --limit 10000         # chạy từng bước
python tools/enrich-vi-ipa.py --words "brave gratitude"
python tools/enrich-vi-ipa.py --file list.txt       # 1 từ mỗi dòng
python tools/enrich-vi-ipa.py --workers 4 --delay 0.2   # tăng tốc (coi chừng chặn)
python tools/enrich-vi-ipa.py --skip-ipa            # chỉ dịch nghĩa
python tools/enrich-vi-ipa.py --freq                # thêm cột freq (pip install wordfreq)
python tools/enrich-vi-ipa.py --dry-run --inplace --out <file>
```

- Thêm `vi` (Google Translate) + `ipa` (dictionaryapi.dev, chỉ từ đơn) + `freq` (wordfreq).
- Từ đơn nghĩa → dịch TỪ; từ đa nghĩa (nhiều dòng cùng word) → dịch ĐỊNH NGHĨA
  (đúng ngữ cảnh từng nghĩa). Cache theo văn bản gốc, **resume** không gọi lại API.
- Mặc định ghi `english-dictionary.enriched.jsonl` (không đụng file gốc); `--inplace` để ghi đè.
- `build-chunks.js` tự ưu tiên file enriched (8 cột: `[.., vi, ipa]`) — tương thích ngược.

## Lưu ý chung

- **Định dạng dòng nén phải 1 dòng 1 từ** — parser dựa trên dòng (docs/DATA-MODEL.md §2).
- Sau khi `--apply` luôn chạy `node --check` (tool tự chạy).
- Sau khi sinh lessons/bank, chạy `node _e2e.js` để xác nhận không vỡ.
