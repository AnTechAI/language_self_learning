# Data Pipelines — `data/scripts/` (5 tool sinh dữ liệu + CLI chung)

> Nguồn duy nhất: `data/raw/english-dictionary.jsonl` (207.272 entry — git-ignored).
> Mọi lệnh gọi qua CLI chung: `node data/scripts/cli.js <lệnh>` (hoặc npm run data:*).

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
node data/scripts/cli.js build --words "gratitude brave polite"
node data/scripts/cli.js build --file list.txt          # 'từ, chủ đề' / @chủ đề
node data/scripts/cli.js build --limit 100 --tag "đời sống"
node data/scripts/cli.js build ... --apply              # chèn thẳng vào seed-data.js
node data/scripts/cli.js build ... --allow-no-ipa --phrases --max-senses 6
```

- Mặc định: chỉ TỪ ĐƠN + bắt buộc có IPA + bỏ qua từ đã có trong kho.
- Sense chính: loại từ nhiều nhất (hòa → verb > noun > adj…), nghĩa ngắn nhất.
- Đầu ra xem trước: `data/scripts/out/jsonl-rows.js` (+ jsonl-rows.json).

## 2. build-lessons.js

```bash
node data/scripts/cli.js lessons --file data/scripts/lesson-words.txt   # 20 từ/bài (nguồn jsonl + API)
node data/scripts/cli.js lessons --size 10 --words "a b c"       # tùy chỉnh
```

- Nhóm theo thứ tự danh sách → mỗi bài 20 từ, tiêu đề "Bài N · chủ đề".
- **Cache API**: `data/scripts/out/lesson-cache.json` — chạy lại nhanh, không tốn request.
- Đầu ra: `js/lessons/manifest.js` + `lesson-001.js…` (format: docs/DATA-MODEL.md §3).
- App chỉ tải đúng bài người chọn (lesson-loader.js).

### Chế độ ENRICHED (GĐ 4) — chia bài từ TOÀN BỘ từ đã làm giàu, KHÔNG gọi API

Có `data/raw/english-dictionary.enriched.jsonl` (từ enrich-vi-ipa.py) thì tool
MẶC ĐỊNH dùng nguồn đó: đọc thẳng vi/ipa/freq → **xếp theo tần suất** (từ thông
dụng trước) → chia bài 20 từ. Một từ nhiều nghĩa → nghĩa chính (POS ưu tiên +
definition ngắn nhất) + tối đa 4 nghĩa bổ sung `{p,i,e,v,x,s,a}`.

```bash
node data/scripts/cli.js lessons                              # enriched, theo tần suất
node data/scripts/cli.js lessons --source raw                 # ép dùng jsonl gốc + API
node data/scripts/cli.js lessons --src <file>                 # file enriched khác
node data/scripts/cli.js lessons --limit 1000                 # chỉ 1000 từ thông dụng nhất
node data/scripts/cli.js lessons --from 1000 --limit 1000     # lô tiếp theo (bài 51+)
node data/scripts/cli.js lessons --order alpha                # xếp a→z thay vì tần suất
node data/scripts/cli.js lessons --include-seed               # giữ cả từ đã có trong seed
node data/scripts/cli.js lessons --keep-existing              # THÊM bài mới, giữ bài cũ
node data/scripts/cli.js lessons --out-dir /tmp/lessons       # ghi ra thư mục khác (test)
```

- Chỉ giữ từ HỌC ĐƯỢC (có nghĩa Việt), bỏ từ đã có trong seed (trừ `--include-seed`).
- `--keep-existing` đọc manifest cũ (hỗ trợ key có/không nháy) → tiếp số bài, không xóa.
- Luồng chuẩn: enrich → chia bài → `--limit` theo lô (mỗi lô ~50 bài) → `--keep-existing` để cộng dồn.

## 3. build-chunks.js

```bash
node data/scripts/cli.js chunks            # toàn bộ jsonl → 104 chunk
node data/scripts/cli.js chunks --size 3000
node data/scripts/cli.js chunks --src data/raw/english-dictionary.enriched.jsonl
```

- 2 lượt đọc: đếm tổng → `N = ceil(total/size)` → bucket `hashFNV(word) % N`.
- **Băm phải khớp** `js/bank-loader.js` (`VA.bankHash`) — đừng đổi thuật toán một phía.
- Tự ưu tiên **file enriched** nếu tồn tại → row 8 cột `[word,pos,def,ex,syn,ant,vi,ipa]`;
  thiếu vi/ipa → vẫn 6 cột (tương thích ngược).
- Đầu ra: `js/bank/chunk-NNN.js` + manifest.js (format: docs/DATA-MODEL.md §4).

## 4. fetch-vocab.js

```bash
node data/scripts/cli.js fetch --words "x y z" --apply
node data/scripts/cli.js fetch --enrich --words "x y"    # thêm nghĩa bổ sung cho từ đã có
node data/scripts/cli.js fetch --fixpos                  # chỉ vá loại từ (POS_OVERRIDE)
```

- Nguồn: `data/scripts/new-words.txt` (hỗ trợ `@tag`) hoặc `--words`.
- `--enrich`: CHỈ THÊM sense, không ghi đè dữ liệu người dùng; idempotent.
- POS chuẩn hóa + bảng `POS_OVERRIDE` (~30 từ) vì API hay trả noun trước.

## 5. enrich-vi-ipa.py

> Tool Python làm giàu TOÀN BỘ jsonl (207k từ) — nền tảng cho chiến thuật
> học toàn bộ từ vựng (docs/VOCABULARY-STRATEGY.md). Chạy: `python data/scripts/enrich-vi-ipa.py`

```bash
python data/scripts/enrich-vi-ipa.py --limit 10000         # chạy từng bước
python data/scripts/enrich-vi-ipa.py --words "brave gratitude"
python data/scripts/enrich-vi-ipa.py --file list.txt       # 1 từ mỗi dòng
python data/scripts/enrich-vi-ipa.py --workers 4 --delay 0.2   # tăng tốc (coi chừng chặn)
python data/scripts/enrich-vi-ipa.py --skip-ipa            # chỉ dịch nghĩa
python data/scripts/enrich-vi-ipa.py --freq                # thêm cột freq (pip install wordfreq)
python data/scripts/enrich-vi-ipa.py --dry-run --inplace --out <file>
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
