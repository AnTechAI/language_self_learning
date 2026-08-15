#!/usr/bin/env python
"""make-popular-list.py — tạo danh sách TỪ NỘI DUNG ĐƠN theo tần suất (wordfreq).

Đầu ra: data/scripts/out/popular-words.txt (~22k từ) — nguồn để chạy enrich
theo mức độ "đáng học" (từ thông dụng trước) thay vì thứ tự a→z của jsonl gốc.

Lọc:
  - từ ĐƠN (không có dấu cách) có phần loại nội dung (noun/verb/adjective/adverb)
  - bỏ ~250 rank đầu của wordfreq (hàm chức năng: the/and/to…)
  - bỏ token rác: không có nguyên âm, số, ký hiệu, độ dài ≤ 1

Dùng:
  python data/scripts/make-popular-list.py                 # ghi popular-words.txt
  python data/scripts/make-popular-list.py --slice-size 800 # + sinh slices/slice-NNN.txt

Cần: pip install wordfreq (offline — không gọi API).
"""
from __future__ import annotations

import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from wordfreq import top_n_list  # noqa: E402

ROOT = __import__("os").path.dirname(__import__("os").path.abspath(__file__))
sys.path.insert(0, ROOT)

CONTENT_POS = {"noun", "verb", "adjective", "adverb"}
RAW = sys.argv[sys.argv.index("--raw") + 1] if "--raw" in sys.argv else "data/raw/english-dictionary.jsonl"
ENRICHED = sys.argv[sys.argv.index("--enriched") + 1] if "--enriched" in sys.argv else "data/raw/english-dictionary.enriched.jsonl"
OUT_DIR = "data/scripts/out"

GOOD_RE = re.compile(r"^[a-z]+(?:[' -][a-z]+)*$")


def good(w: str) -> bool:
    if not GOOD_RE.fullmatch(w):
        return False
    if len(w) <= 1:
        return False
    if not re.search(r"[aeiouy]", w):
        return False
    return True


def main() -> None:
    import os

    raw_file = os.path.join(os.getcwd(), RAW)
    enr_file = os.path.join(os.getcwd(), ENRICHED)

    done: set[str] = set()
    if os.path.exists(enr_file):
        for ln in open(enr_file, encoding="utf-8"):
            try:
                done.add(json.loads(ln).get("word", "").lower())
            except Exception:
                pass

    in_dict: set[str] = set()
    with open(raw_file, encoding="utf-8") as f:
        for ln in f:
            try:
                e = json.loads(ln)
            except Exception:
                continue
            w = e["word"].strip().lower()
            pos = (e.get("partOfSpeech") or "").strip().lower()
            if w and " " not in w and pos in CONTENT_POS:
                in_dict.add(w)

    words = [w for w in top_n_list("en", 40000)[250:] if w in in_dict and good(w)]
    out = os.path.join(os.getcwd(), OUT_DIR)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "popular-words.txt"), "w", encoding="utf-8") as f:
        f.write("# Tu noi dung don theo tan suat (wordfreq top_n_list)\n" + "\n".join(words) + "\n")
    new = [w for w in words if w not in done]
    print(f"tong: {len(words)} | chua giau: {len(new)} -> popular-words.txt")

    slice_size = 0
    if "--slice-size" in sys.argv:
        slice_size = int(sys.argv[sys.argv.index("--slice-size") + 1])
    if slice_size > 0:
        os.makedirs(os.path.join(out, "slices"), exist_ok=True)
        for i, start in enumerate(range(0, len(new), slice_size)):
            chunk = new[start : start + slice_size]
            with open(os.path.join(out, "slices", f"slice-{i + 1:03d}.txt"), "w", encoding="utf-8") as f:
                f.write("\n".join(chunk) + "\n")
        print(f"sinh {int((len(new) + slice_size - 1) / slice_size)} slice (moi slice {slice_size} tu) -> out/slices/")


if __name__ == "__main__":
    main()