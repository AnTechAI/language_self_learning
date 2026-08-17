# Scripts dữ liệu — `data/scripts/`

Bộ công cụ sinh và quản lý dữ liệu cho app **Học Từ Vựng** (en/zh).
Mọi lệnh đi qua **1 cửa duy nhất**:

```bash
node data/scripts/cli.js <lệnh> [tham số…]     # cửa chung (Node + Python)
npm run data<:lệnh> -- [tham số…]              # tắt nhanh qua npm (root)
```

Danh sách lệnh: `cli.js` chạy không đối số → in hướng dẫn.

> Nguồn dữ liệu gốc: `data/raw/english-dictionary.jsonl` (**207.272 entry**) + bản đã làm giàu
> `data/raw/english-dictionary.enriched.jsonl` (git-ignored — tái tạo bằng enrich).
> Chi tiết pipeline: [`docs/DATA-PIPELINES.md`](../../docs/DATA-PIPELINES.md),
> chiến thuật học từ vựng: [`docs/VOCABULARY-STRATEGY.md`](../../docs/VOCABULARY-STRATEGY.md).

---

## Bảng lệnh

| Lệnh (`cli.js`) | Script | Làm gì | Đầu ra |
|---|---|---|---|
| `lessons` | `build-lessons.js` | Chia từ vựng thành **bài học 20 từ** (en + zh/HSK) | `apps/web/public/legacy/js/lessons/` (manifest + lesson-*) |
| `chunks` | `build-chunks.js` | Chia toàn bộ jsonl thành **chunk nhỏ** (từ điển offline) | `js/bank/` (manifest + chunk-*) |
| `seed` | `export-seed.js` | Sinh `seed.generated.ts` cho app React | `apps/web/src/data/seed.generated.ts` |
| `icons` | `make-icons.js` | Sinh **icon PWA** (PNG) | `apps/web/public/icons/icon-192.png` + `icon-512.png` |
| `enrich` | `enrich-vi-ipa.py` | Làm giàu jsonl: **nghĩa Việt + IPA + freq** | `english-dictionary.enriched.jsonl` / `hsk-dictionary.enriched.jsonl` |
| `fetch` | `fetch-vocab.js` | Tự động **tải từ mới** từ Internet (API, en) | dòng nén seed (js/seed-data.js) |
| `hsk` | `fetch-hsk.js` | Tải **từ điển tiếng Trung HSK 1–6** (GitHub) | `data/raw/hsk-dictionary.jsonl` |
| `hsk30` | `fetch-hsk30.js` | Tải **từ điển HSK 3.0** (5.363 từ, pinyin_numeric/bộ thủ/lượng từ) | `data/raw/hsk30-dictionary.jsonl` |
| `zh-dict` | `build-hsk30.js` | Gom nghĩa + trích nét chữ → **từ điển zh + dữ liệu nét** | `legacy/js/zh-dict/hsk.json`, `zh-strokes.json` |
| `zh-grammar` | `fetch-hsk30-grammar.js` | Tải **422 điểm ngữ pháp HSK 3.0** (kèm ví dụ câu) | `legacy/js/zh-dict/zh-grammar.json` |
| `build` | `build-from-jsonl.js` | Dựng từ vựng từ jsonl (gom nghĩa + dịch) | dòng nén seed |

Các script Python chạy qua `cli.js` bằng lệnh `python` (đã cài wordfreq để dùng `--freq`/`--add-freq`).

---

## 1. `build-lessons.js` — tạo bài học 20 từ

Lấy danh sách từ → gom mọi dòng trong jsonl thành nhiều nghĩa/loại từ → chia
**mỗi bài đúng 20 từ** → xuất `js/lessons/` (app chỉ tải đúng bài đang chọn).

**Chế độ enriched (mặc định khi có `english-dictionary.enriched.jsonl`)**: đọc thẳng
`vi/ipa/freq` từ file giàu — **không gọi API**, xếp theo **tần suất** (tie → a→z),
nhóm đa nghĩa thành primary + tối đa 4 nghĩa phụ, bỏ từ đã có trong seed.

```bash
npm run data:lessons                              # xem trước (tất cả từ học được)
npm run data:lessons -- --keep-existing           # CỘNG DỒN bài mới, không xóa bài cũ
npm run data:lessons -- --order alpha             # xếp a→z thay vì theo tần suất
npm run data:lessons -- --include-seed            # kể cả từ đã có trong seed
```

| Flag | Ý nghĩa |
|---|---|
| `--source raw` | ép dùng jsonl gốc + gọi API (thay vì file enriched) |
| `--src <file>` / `--order freq\|alpha\|level` | nguồn khác / thứ tự (level = cấp HSK tăng dần) |
| `--course en\|zh` | khóa học (zh → bài `lesson-zh-*` + `manifest-zh.js` + tiêu đề `HSK N · Bài k`) |
| `--from N --limit M` | lấy lát N→N+M từ |
| `--keep-existing` | đọc manifest cũ → tiếp số bài, không xóa |
| `--out-dir <dir>` | xuất ra thư mục khác (test) |
| `--size N` | mỗi bài N từ (mặc định 20) |

> --course zh KHÔNG đụng bài tiếng Anh: chỉ xóa/ghi `lesson-zh-*.js` + `manifest-zh.js`.
> Bài Hán tự giống hệt en: mỗi bài 20 từ theo cấp HSK, app tải đúng file khi cần.

---

## `fetch-hsk.js` — tải từ điển tiếng Trung HSK 1–6

Tải bộ từ vựng **HSK 2.0 cổ điển** (150/150/300/600/1300/2500) từ kho GitHub
[`drkameleon/complete-hsk-vocabulary`](https://github.com/drkameleon/complete-hsk-vocabulary)
(file `wordlists/inclusive/old/{1..6}.json` — mỗi entry có chữ giản thể, pinyin,
từ loại CC-CEDICT, nghĩa tiếng Anh, tần suất). Các file level là **cumulative** —
script giữ 1 từ ở **cấp đầu tiên xuất hiện** → **4.991 từ unique**, ghi `data/raw/hsk-dictionary.jsonl`
schema chuẩn enriched (cột `ipa` = **pinyin**, `level` = cấp HSK, `vi` để trống).

```bash
node data/scripts/cli.js hsk
```

**Sau đó làm giàu nghĩa Việt + dựng bài** — xem mục Luồng làm việc ở dưới.
Nguồn thay thế: `complete.json` / `wordlists/inclusive/{new,newest}` (HSK 3.0) —
đổi `BASE` + tên file trong `fetch-hsk.js` là dùng được.

---

> **Chống trùng**: `--keep-existing` lưu từ đã vào bài ở `out/lessoned-words.json`
> và **loại** chúng ở lần chạy sau — gọi thêm nhiều lần không tạo bài trùng.

---

## 2. `build-chunks.js` — từ điển offline theo chunk

Đọc jsonl (ưu tiên file giàu) → chia theo hash → **104 chunk nhỏ (~25MB)** để app
chỉ tải đúng **1 chunk** chứa từ cần tra. Mỗi entry nén thành mảng 8 cột
(6 cột nếu file gốc): `[word, pos, def, example, syn[4], ant[4], vi, ipa]`.

```bash
npm run data:chunks                          # sinh lại toàn bộ js/bank/
npm run data:chunks -- --src <file>          # nguồn khác
npm run data:chunks -- --size 3000           # số entry/chunk (mặc định 2000)
```

---

## 3. `export-seed.js` — sinh seed cho app React

Eval 2 module legacy (utils + seed-data) trong Node (stub `window.VocabApp`) →
`VA.buildSeedEntries()` → xuất mảng `WordEntry` chuẩn thành `seed.generated.ts`.

```bash
npm run data:seed                     # ghi apps/web/src/data/seed.generated.ts
npm run data:seed -- --out <file>     # ghi ra chỗ khác
```
> Nguồn duy nhất vẫn là `js/seed-data.js` (legacy) — sửa seed ở đó rồi chạy lại.

---

## 4. `make-icons.js` — icon PWA

Sinh PNG icon app: nền brand + dấu ✓ trắng, dùng **Node zlib** (không thư viện).

```bash
npm run data:icons                     # ghi public/icons/icon-192.png + icon-512.png
```

---

## 5. `enrich-vi-ipa.py` — làm giàu toàn bộ jsonl (nền tảng học 207k từ)

Đọc từng dòng jsonl → **dịch nghĩa Việt** (Google Translate, miễn phí) + **phiên âm IPA**
(dictionaryapi.dev, từ đơn) + tùy chọn **freq** (wordfreq, offline). Chạy song song
(`--workers`), tự đợi khi bị giới hạn, ghi theo cụm → dừng giữa chừng không mất.

**Resume theo TỪNG DÒNG** (`word|definition`) — một từ nhiều nghĩa phải giàu đủ mọi
dòng mới tính xong (đánh dấu theo từ sẽ mất nghĩa hàng loạt của từ đa nghĩa).

```bash
npm run data:enrich -- --limit 10000                     # chạy 10k từ
npm run data:enrich -- --words "brave gratitude"         # vài từ chỉ định
npm run data:enrich -- --file list.txt                   # theo danh sách (1 từ/dòng)
npm run data:enrich -- --workers 4 --delay 0.2           # tăng tốc (coi chừng chặn)
npm run data:enrich -- --skip-ipa                        # chỉ dịch nghĩa
npm run data:enrich -- --add-freq                        # CHỈ thêm freq (offline, không API)
npm run data:enrich -- --dry-run                         # đếm trước, không làm
```

**Chạy theo tần suất (đáng học trước):**
```bash
python data/scripts/make-popular-list.py --slice-size 800   # sinh out/slices/slice-001..NNN.txt
python data/scripts/enrich-vi-ipa.py --file data/scripts/out/slices/slice-001.txt
# … chạy tiếp slice-002… về đêm (mỗi slice ~800 từ ≈ 30–40 phút, resume an toàn)
```

**Lệnh chỉ định nguồn:** mặc định đọc jsonl gốc, ghi `english-dictionary.enriched.jsonl`;
`--inplace` ghi đè nguồn.

---

## 6. `fetch-vocab.js` — nạp từ mới từ Internet

Với mỗi từ: Free Dictionary API (IPA, POS, nghĩa EN, ví dụ, syn/ant) + Google Translate
(nghĩa Việt) → xuất đúng định dạng nén seed.

```bash
npm run data:fetch                                    # đọc data/scripts/new-words.txt
npm run data:fetch -- data/scripts/words2.txt          # danh sách khác
npm run data:fetch -- --words "gratitude curious"      # gõ tay
npm run data:fetch -- --tag "cảm xúc"                  # ghi đè chủ đề
```
> Xem trước ở `out/jsonl-rows.js`; `--apply` mới chèn thẳng vào js/seed-data.js.

---

## 7. `build-from-jsonl.js` — dựng từ vựng từ jsonl

Gom mọi dòng của từ → nhiều nghĩa/loại từ, dịch Việt, lấy IPA → xuất dòng nén seed.

```bash
npm run data:build -- --words "gratitude brave polite"
npm run data:build -- --file list.txt              # 'từ, chủ đề'
npm run data:build -- --limit 100 --tag "đời sống"
npm run data:build ... --apply                     # TỰ CHÈN vào js/seed-data.js
```

---

## `make-popular-list.py` — danh sách từ theo tần suất

Sinh danh sách **từ nội dung đơn theo tần suất** (wordfreq — offline, không API) +
**slice** để chạy đêm: bỏ ~250 rank đầu (hàm chức năng), chỉ POS nội dung
(noun/verb/adjective/adverb), bỏ token rác (không nguyên âm, số, ≤1 ký tự).

```bash
python data/scripts/make-popular-list.py                    # ghi out/popular-words.txt
python data/scripts/make-popular-list.py --slice-size 800   # + sinh out/slices/
```

---

## Luồng làm việc điển hình

**Tạo bài học mới từ từ thông dụng (không đụng seed, không trùng):**
```bash
python data/scripts/make-popular-list.py --slice-size 800     # 1 lần (sinh danh sách + slice)
python data/scripts/enrich-vi-ipa.py --file out/slices/slice-001.txt   # chạy từng slice về đêm
node data/scripts/cli.js lessons --keep-existing                      # cộng dồn bài (0 trùng)
```

**Tiếng Trung (HSK 1–6) — pipeline trọn gói:**
```bash
node data/scripts/cli.js hsk                                       # 1. tải từ điển HSK 1–6 (GitHub)
python data/scripts/enrich-vi-ipa.py --sl auto --skip-ipa \
  --in data/raw/hsk-dictionary.jsonl --out data/raw/hsk-dictionary.enriched.jsonl \
  --workers 8 --delay 0.12                                        # 2. dịch nghĩa Việt (~14 phút)
node data/scripts/cli.js lessons --src data/raw/hsk-dictionary.enriched.jsonl \
  --course zh --order level                                      # 3. bài học theo cấp HSK
```

**Thêm icon/seed/chunk sau khi sửa dữ liệu:**
```bash
npm run data:icons ; npm run data:seed ; npm run data:chunks
```

**Sau khi sinh lessons/bank/seed:** chạy `node _e2e.js` để chắc không vỡ (142 test).

---

*Toàn bộ file sinh ra (`out/`, `data/raw/`, `js/bank/`, `js/lessons/`) nằm trong
`.gitignore` — luôn tái tạo được từ nguồn + các script trên.*