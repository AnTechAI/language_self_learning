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
| [make-popular-list.py](#6-make-popular-listpy) | Tạo danh sách TỪ NỘI DUNG ĐƠN theo tần suất (wordfreq) | Enrich/bài theo thứ tự đáng học + sinh slice chạy đêm | `out/popular-words.txt`, `out/slices/` |

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
- **Chống trùng khi `--keep-existing`**: sidecar `data/scripts/out/lessoned-words.json`
  lưu từ đã vào bài — build lần sau **loại** các từ đó (không dựng lại bài trùng).
  Nếu file này mất, tool chỉ biết bỏ seed → thêm bài trùng (lần đầu build mới dọn tay).
- Luồng chuẩn: `make-popular-list.py --slice-size 800` → `enrich --file slices/*` →
  `build-lessons --keep-existing` để cộng dồn bài mới từ toàn bộ file giàu (0 trùng).

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
> học toàn bộ từ vựng (docs/VOCABULARY-STRATEGY.md).
> **Xử lý theo TẦN SUẤT** (từ đáng học trước) thay vì a→z: chạy
> `python data/scripts/make-popular-list.py --slice-size 800` để sinh
> `data/scripts/out/slices/slice-NNN.txt`, rồi chạy `--file` từng slice
> (~800 từ/lần ≈ 30–40 phút, resume an toàn theo dòng) — nối tiếp nhau về đêm.
> Chạy đơn: `python data/scripts/enrich-vi-ipa.py`

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

## 6. make-popular-list.py

> Sinh danh sách **từ nội dung đơn theo tần suất** (wordfreq — offline, không API) —
> xử lý enrich/trái bài theo mức "đáng học" thay vì thứ tự a→z của jsonl gốc.

```bash
python data/scripts/make-popular-list.py                   # ghi out/popular-words.txt
python data/scripts/make-popular-list.py --slice-size 800  # + sinh slices/slice-001..NNN.txt
```

- Lọc: từ đơn (không dấu cách) + POS nội dung (noun/verb/adjective/adverb) +
  bỏ ~250 rank đầu wordfreq (hàm chức năng) + bỏ token rác (không nguyên âm, số, ≤1 ký tự).
- `slices/` chia danh sách CHƯA giàu thành các lô ~800 từ → chạy nhiều đêm
  `enrich-vi-ipa.py --file slices/slice-NNN.txt` (mỗi lô ~30–40 phút, resume an toàn).

---

## 7. Hạ Canh — TIẾNG TRUNG (HSK 1–6)

Pipeline riêng cho khóa **Tiếng Trung 🇨🇳**, không đụng dữ liệu en:

### Bước 1 — `fetch-hsk.js`: tải từ điển HSK

- Nguồn: [`drkameleon/complete-hsk-vocabulary`](https://github.com/drkameleon/complete-hsk-vocabulary)
  (GitHub, công khai) — bộ từ vựng đầy đủ cho **HSK 2.0** (`wordlists/inclusive/old/`)
  và **HSK 3.0** (`new/newest`); dùng bộ `old` = HSK 2.0 cổ điển.
- Mỗi entry: `simplified` (chữ giản thể) · `pos` (CC-CEDICT) · `frequency` (SUBTLEX-CH) ·
  `forms[0].transcriptions.pinyin` · `forms[0].meanings[]` (tiếng Anh).
- File level là **cumulative** → giữ 1 từ ở cấp ĐẦU TIÊN xuất hiện → **4.991 từ unique**
  (150/147/298/598/1298/2500 theo cấp 1→6).
- Ghi `data/raw/hsk-dictionary.jsonl` — schema enriched chuẩn: `word, partOfSpeech,
  definition(en), examples, synonyms, antonyms, ipa(=PINYIN), freq, level`. 1 từ đa nghĩa
  → nhiều dòng (mỗi dòng 1 nghĩa, `vi` để trống).

```bash
node data/scripts/cli.js hsk
```

### Bước 2 — enrich: dịch nghĩa VIỆT

Thêm cờ **`--sl`** (ngôn ngữ nguồn) vào `enrich-vi-ipa.py` (mặc định `en`):

```bash
python data/scripts/enrich-vi-ipa.py --sl auto --skip-ipa \
  --in data/raw/hsk-dictionary.jsonl --out data/raw/hsk-dictionary.enriched.jsonl \
  --workers 8 --delay 0.12
```

- `--skip-ipa`: pinyin đã có sẵn ở cột `ipa` (enrich giữ nguyên field có sẵn).
- `--sl auto`: Google tự nhận diện tiếng Trung (sl=en sai nghĩa với nhiều từ Hán).
- 4.991 từ ≈ 14 phút (8 workers) — resume đứt đoạn an toàn.

### Bước 3 — `build-lessons.js --course zh`: bài học theo cấp HSK

Chế độ enriched mở rộng cờ **`--course zh` + `--order level`**:

```bash
node data/scripts/cli.js lessons --src data/raw/hsk-dictionary.enriched.jsonl \
  --course zh --order level
```

- Xếp theo `level` tăng dần (HSK 1 → 6), trong cấp theo tần suất giảm dần.
- Xuất **riêng, không đụng en**: `lesson-zh-NNN.js` + `manifest-zh.js` (gọi
  `window.VocabApp.zhLessonsInit`); xóa/ghi CHỈ file tiền tố `lesson-zh-*`.
- Tiêu đề bài: `HSK {cấp} · Bài {k}` (trong cấp), tag `HSK {cấp}` — người học thấy
  rõ lộ trình cấp độ.
- Sidecar chống trùng dùng chung `out/lessoned-words.json` (chữ Hán không bao giờ
  trùng từ tiếng Anh — vô hại).

### App (React) — bài học theo khóa

- `registry.ts`: shim thêm **`zhLessonsInit`** → `reg.zhLessonManifest` (riêng en).
- `lessons.ts`: `ensureLessonsManifest(courseSeed)` tải đúng manifest theo khóa
  (`manifest.js` / `manifest-zh.js`); `lessonById` tìm ở cả 2 mảng.
- `enterCourse` reset `lessonManifestReady: false` → chuyển khóa tải manifest mới;
  `useLessons` đọc `course.seed`. Bỏ cổng `course.seed === 'en'` ở Home/Vocab/Games
  → học viên TRUNG cũng có panel bài học HSK, chọn bài trong trò chơi, chip lọc kho.

---
