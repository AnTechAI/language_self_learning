#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
enrich-vi-ipa.py — LÀM GIÀU english-dictionary.jsonl bằng NGHĨA TIẾNG VIỆT + IPA.

Tại sao cần:
  data/raw/english-dictionary.jsonl có 207k từ nhưng MỖI DÒNG chỉ có nghĩa
  tiếng Anh. App chỉ học được từ có nghĩa đích (hasTarget) → muốn học TOÀN BỘ
  từ vựng phải có bản dịch tiếng Việt + phiên âm. Tool này tự động bổ sung:

    {"word":"...","partOfSpeech":"...","definition":"...","examples":[...],
     "synonyms":[...],"antonyms":[...],"vi":"Nghĩa tiếng Việt.","ipa":"/ˈ.../"}

  - vi:  Google Translate (endpoint miễn phí, giống data/scripts/fetch-vocab.js)
         — dịch TỪ trước, nếu kém thì dịch ĐỊNH NGHĨA (cache theo văn bản gốc)
  - ipa: Free Dictionary API (api.dictionaryapi.dev) — chỉ từ ĐƠN (cụm từ bỏ)
  - freq: (tùy chọn --freq) tần suất từ qua thư viện wordfreq (ngoại tuyến)
         → dùng để sắp xếp bài học theo độ phổ biến (xem docs/VOCABULARY-STRATEGY.md)

Cách dùng:
  python data/scripts/enrich-vi-ipa.py                    # làm giàu toàn bộ (resume được)
  python data/scripts/enrich-vi-ipa.py --limit 50         # thử 50 từ
  python data/scripts/enrich-vi-ipa.py --words "brave gratitude"   # vài từ chỉ định
  python data/scripts/enrich-vi-ipa.py --file list.txt    # 1 từ mỗi dòng
  python data/scripts/enrich-vi-ipa.py --workers 4 --delay 0.2     # tăng tốc (coi chừng chặn)
  python data/scripts/enrich-vi-ipa.py --skip-ipa         # chỉ thêm nghĩa Việt
  python data/scripts/enrich-vi-ipa.py --freq             # thêm cột freq (cần: pip install wordfreq)
  python data/scripts/enrich-vi-ipa.py --add-freq          # CHỈ thêm freq cho file đã giàu (không gọi API)
  python data/scripts/enrich-vi-ipa.py --dry-run          # chạy thử không gọi API
  python data/scripts/enrich-vi-ipa.py --inplace          # ghi đè file gốc (mặc định ghi file mới)
  python data/scripts/enrich-vi-ipa.py --out <file>       # chỉ định file đầu ra

An toàn:
  - Không sửa file gốc (mặc định). Ghi ra file .enriched.jsonl.
  - RESUME theo TỪNG DÒNG (word+định nghĩa) chứ không theo từ — từ nhiều nghĩa
    phải làm giàu ĐỦ mọi dòng mới tính là xong (đừng đánh dấu theo từ — sẽ mất nghĩa).
  - Backoff khi bị 429 / lỗi mạng; retry theo --retries.
  - Cache theo văn bản gốc (từ/định nghĩa) để không dịch trùng.
"""
import argparse
import json
import os
import random
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# Windows console (cp1252) không in được emoji — ép UTF-8
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_IN = os.path.join(ROOT, "data", "raw", "english-dictionary.jsonl")
DEFAULT_OUT = os.path.join(ROOT, "data", "raw", "english-dictionary.enriched.jsonl")

API_DICT = "https://api.dictionaryapi.dev/api/v2/entries/en/{w}"
API_TRANS = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q={q}"
UA = "Mozilla/5.0 (enrich-vi-ipa)"


# ---------------------------------------------------------------- tiện ích mạng
def http_get(url, timeout=20, retries=3, backoff=2.0):
    """GET url → bytes. 404 → None. 429/lỗi mạng → retry có backoff (jitter)."""
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status == 404:
                    return None
                if r.status >= 400:
                    raise urllib.error.HTTPError(url, r.status, "http error", r.headers, None)
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429 or e.code >= 500:
                wait = backoff * (2 ** i) + random.random()
                print(f"    [..] HTTP {e.code}, chờ {wait:.1f}s…", file=sys.stderr)
                time.sleep(wait)
                continue
            return None
        except Exception as e:  # lỗi mạng / timeout
            if i < retries - 1:
                wait = backoff * (2 ** i) + random.random()
                print(f"    [!]  {e.__class__.__name__}, chờ {wait:.1f}s…", file=sys.stderr)
                time.sleep(wait)
    return None


def google_translate(text):
    """Google Translate EN→VI. Trả '' nếu lỗi."""
    if not text:
        return ""
    raw = http_get(API_TRANS.format(q=urllib.parse.quote(text)))
    if not raw:
        return ""
    try:
        data = json.loads(raw)
        return "".join(seg[0] for seg in (data or [[], []])[0] if seg and seg[0]).strip()
    except Exception:
        return ""


def fetch_ipa(word):
    """IPA từ Free Dictionary API — chỉ từ đơn. Trả '' nếu không có."""
    raw = http_get(API_DICT.format(w=urllib.parse.quote(word)))
    if not raw:
        return ""
    try:
        data = json.loads(raw)
        if not isinstance(data, list) or not data:
            return ""
        for p in (data[0].get("phonetics") or []):
            if p.get("text"):
                return p["text"].strip()
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------- làm sạch
def clean_vi(s):
    """Chuẩn hóa nghĩa tiếng Việt: bỏ ngoặc thừa, thêm dấu chấm cuối."""
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    s = re.sub(r"^[\(\[“\"']+|[\)\]”\"',.]+$", "", s).strip()
    if not s:
        return ""
    if not re.search(r"[.!?。]$", s):
        s += "."
    return s


def is_single_word(word):
    """Từ ĐƠN (không dấu cách) — chỉ những từ này mới hỏi IPA."""
    return bool(re.fullmatch(r"[a-z]+(?:['\-][a-z]+)*", word.lower()))


# ---------------------------------------------------------------- chính
def build_arg_parser():
    p = argparse.ArgumentParser(description="Làm giàu english-dictionary.jsonl (vi + ipa + freq)")
    p.add_argument("--in", dest="infile", default=DEFAULT_IN, help="file JSONL nguồn")
    p.add_argument("--out", dest="outfile", default=DEFAULT_OUT, help="file JSONL đầu ra")
    p.add_argument("--inplace", action="store_true", help="ghi đè file nguồn (mặc định: file mới)")
    p.add_argument("--limit", type=int, default=0, help="chỉ xử lý N từ đầu (0 = tất cả)")
    p.add_argument("--words", default="", help="chỉ xử lý các từ (cách nhau bởi dấu cách)")
    p.add_argument("--file", default="", help="chỉ xử lý các từ trong file (1 từ mỗi dòng)")
    p.add_argument("--workers", type=int, default=3, help="số luồng song song (mặc định 3)")
    p.add_argument("--delay", type=float, default=0.25, help="giãn cách giữa 2 request/luồng (giây)")
    p.add_argument("--retries", type=int, default=3, help="số lần thử lại khi lỗi mạng/429")
    p.add_argument("--skip-ipa", action="store_true", help="không lấy IPA (chỉ dịch nghĩa)")
    p.add_argument("--skip-vi", action="store_true", help="không dịch nghĩa (chỉ lấy IPA)")
    p.add_argument("--freq", action="store_true", help="thêm cột freq qua wordfreq (pip install wordfreq)")
    p.add_argument("--add-freq", action="store_true", help="CHỈ thêm cột freq cho file đã giàu (không gọi API)")
    p.add_argument("--dry-run", action="store_true", help="chỉ đếm, không gọi API")
    return p


def add_freq_pass(outfile):
    """Thêm cột freq (wordfreq) cho mọi dòng còn thiếu — offline, không gọi API."""
    try:
        from wordfreq import word_frequency
    except ImportError:
        print("[X] Cài wordfreq để dùng --add-freq:  pip install wordfreq", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(outfile):
        print("[X] Không tìm thấy " + outfile, file=sys.stderr)
        sys.exit(1)
    out = []
    changed = 0
    with open(outfile, "r", encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            if "freq" not in e:
                e["freq"] = round(word_frequency(str(e.get("word", "")).lower(), "en"), 8)
                changed += 1
            out.append(json.dumps(e, ensure_ascii=False))
    with open(outfile, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"[OK] Thêm freq cho {changed}/{len(out)} dòng → " + outfile)


def load_done(outfile):
    """Đọc file đầu ra (nếu có) → cache vi/ipa + set dòng đã xong (resume).
    Quan trọng: đánh dấu theo TỪNG DÒNG (word|definition) chứ không theo từ —
    một từ nhiều nghĩa phải làm giàu ĐỦ mọi dòng mới tính là xong."""
    done = set()
    vi_cache, ipa_cache = {}, {}
    if os.path.exists(outfile):
        with open(outfile, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                w = str(e.get("word", "")).lower()
                if w:
                    done.add(line_fp(e))
                if e.get("vi"):
                    vi_cache[e.get("definition", "")] = e["vi"]
                    vi_cache.setdefault(w, e["vi"])
                if e.get("ipa"):
                    ipa_cache[w] = e["ipa"]
    return done, vi_cache, ipa_cache


def line_fp(e):
    """Dấu vân tay 1 dòng JSONL: word + định nghĩa (phân biệt các nghĩa của cùng từ)."""
    return str(e.get("word", "")).lower() + "|" + str(e.get("definition", "")).strip().lower()[:200]


def translate_with_cache(text, cache, lock):
    """Dịch có cache + khóa luồng (tránh gọi trùng khi song song)."""
    key = text.lower()
    with lock:
        if key in cache:
            return cache[key]
    time.sleep(0)  # nhường luồng
    vi = clean_vi(google_translate(text))
    with lock:
        cache[key] = vi
    return vi


def process_one(line, done, vi_cache, ipa_cache, lock, opt, word_count):
    """Làm giàu 1 dòng JSONL. Trả về dòng mới (hoặc dòng cũ nếu không đổi)."""
    try:
        e = json.loads(line)
    except Exception:
        return line
    word = str(e.get("word", "")).lower()
    if not word:
        return line
    if line_fp(e) in done:
        return line  # dòng đã xử lý ở lần chạy trước (resume)

    need_vi = not opt.skip_vi
    need_ipa = not opt.skip_ipa and is_single_word(word)

    # ---- nghĩa Việt: từ đơn nghĩa dịch TỪ; từ đa nghĩa dịch ĐỊNH NGHĨA ----
    if need_vi and not e.get("vi"):
        multi_sense = word_count.get(word, 1) > 1
        if multi_sense:
            # đa nghĩa → dịch theo nghĩa (đúng ngữ cảnh); cache theo văn bản định nghĩa
            vi = translate_with_cache(e.get("definition", ""), vi_cache, lock)
        else:
            with lock:
                vi = vi_cache.get(word)
            if not vi:
                raw = clean_vi(google_translate(word))
                bad = not raw or len(raw) > 60 or raw.lower().replace(" ", "").replace("-", "") == word.lower()
                if bad:
                    def_text = e.get("definition", "")
                    vi = translate_with_cache(def_text, vi_cache, lock)
                else:
                    vi = raw
                with lock:
                    vi_cache.setdefault(word, vi)
        if vi:
            e["vi"] = vi
        time.sleep(opt.delay)

    # ---- IPA: chỉ từ đơn ----
    if need_ipa and not e.get("ipa"):
        with lock:
            ipa = ipa_cache.get(word)
        if not ipa:
            ipa = fetch_ipa(word)
            with lock:
                ipa_cache[word] = ipa
        if ipa:
            e["ipa"] = ipa
        time.sleep(opt.delay)

    # ---- tần suất (tùy chọn) ----
    if opt.freq and "freq" not in e:
        try:
            from wordfreq import word_frequency
            e["freq"] = round(word_frequency(word, "en"), 6)
        except ImportError:
            print("    [INFO]  Cài wordfreq để dùng --freq:  pip install wordfreq", file=sys.stderr)

    return json.dumps(e, ensure_ascii=False) + "\n"


def main():
    args = build_arg_parser().parse_args()
    if args.inplace:
        args.outfile = args.infile

    # Mode đặc biệt: chỉ thêm cột freq cho file đã giàu (không gọi API)
    if args.add_freq:
        add_freq_pass(args.outfile)
        return

    if not os.path.exists(args.infile):
        print(f"[X] Không tìm thấy {args.infile}")
        sys.exit(1)

    # --- đọc dòng cần xử lý ---
    lines = []
    with open(args.infile, "r", encoding="utf-8") as f:
        for ln in f:
            if ln.strip():
                lines.append(ln)
    print(f"[DOC] {args.infile}: {len(lines)} dòng")

    # --- đếm từ đa nghĩa (cùng word xuất hiện nhiều dòng) ---
    word_count = {}
    for ln in lines:
        try:
            w = json.loads(ln).get("word", "").lower()
        except Exception:
            continue
        word_count[w] = word_count.get(w, 0) + 1

    # --- lọc theo --words / --file / --limit ---
    wanted = None
    if args.words:
        wanted = {w.lower() for w in args.words.split()}
    elif args.file:
        wanted = set()
        with open(args.file, "r", encoding="utf-8") as f:
            for ln in f:
                w = ln.strip().lower()
                if w and not w.startswith("#"):
                    wanted.add(w.split(",")[0].strip())
    if wanted:
        lines = [ln for ln in lines if json.loads(ln).get("word", "").lower() in wanted]
        print(f"   Lọc {len(lines)} dòng theo danh sách")
    elif args.limit > 0:
        lines = lines[: args.limit]

    # --- resume + cache ---
    done, vi_cache, ipa_cache = load_done(args.outfile)
    todo = [ln for ln in lines if line_fp(json.loads(ln)) not in done]
    print(f"   Đã xong trước: {len(lines) - len(todo)} · Còn xử lý: {len(todo)}")

    if args.dry_run:
        need_ipa = sum(1 for ln in todo if is_single_word(json.loads(ln).get("word", "")))
        print(f"[DRY] DRY-RUN: sẽ dịch {len(todo)} từ + {need_ipa} IPA (workers={args.workers}, delay={args.delay})")
        return

    if not todo:
        print("[INFO] Không còn gì để làm — file đầu ra đã đủ.")
        return

    lock = threading.Lock()
    print(f"[RUN] Đang xử lý {len(todo)} dòng (workers={args.workers}, delay={args.delay}s)…")
    batch = 300  # ghi tiến độ từng cụm — dừng giữa chừng không mất
    t0 = time.time()
    written = 0
    with open(args.outfile, "a", encoding="utf-8") as out:
        if os.path.exists(args.outfile) and os.path.getsize(args.outfile) > 0:
            pass  # file đã có → append tiếp
        for start in range(0, len(todo), batch):
            chunk = todo[start : start + batch]
            results = {}
            with ThreadPoolExecutor(max_workers=args.workers) as ex:
                futs = {ex.submit(process_one, ln, done, vi_cache, ipa_cache, lock, args, word_count): i for i, ln in enumerate(chunk)}
                for fut in as_completed(futs):
                    i = futs[fut]
                    try:
                        results[i] = fut.result()
                    except Exception as ex2:
                        results[i] = chunk[i]  # giữ nguyên dòng nếu lỗi
            for i in range(len(chunk)):
                out.write(results[i])
                written += 1
            out.flush()
            rate = written / max(0.001, time.time() - t0)
            eta = (len(todo) - written) / rate if rate else 0
            print(f"   … {written}/{len(todo)} (~{rate:.1f} từ/s, còn ~{eta/60:.0f} phút)", file=sys.stderr)

    if args.inplace:
        os.replace(args.outfile, args.infile)
    print(f"✅ Xong {written} dòng → {args.outfile}")


if __name__ == "__main__":
    main()
