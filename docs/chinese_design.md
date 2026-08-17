# Thiết kế: App Tự Học Tiếng Trung (Chinese Self-Study App)

## 1. Tổng quan

**Mục tiêu:** Xây dựng một ứng dụng cá nhân để tự học tiếng Trung từ Zero đến HSK, tập trung vào từ vựng, phát âm/thanh điệu, chữ Hán (bộ thủ + thứ tự nét) và ôn tập ngắt quãng (spaced repetition).

**Đối tượng dùng:** Cá nhân (không cần hệ thống multi-user/login phức tạp), tương tự pattern app tiếng Anh đã làm — lưu trữ trên trình duyệt, không cần tài khoản.

**Nguyên tắc thiết kế:**
- Đơn giản, không cần theme tùy chỉnh phức tạp.
- Không gamification nặng (streak, huy hiệu...) — chỉ cần đếm số từ học/ngày để theo dõi tiến độ.
- Dữ liệu từ vựng lấy từ nguồn mở (HSK 3.0), nghĩa tiếng Việt cần bổ sung/dịch thêm.

---

## 2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────┐
│                   Frontend                    │
│  (React/HTML - chạy hoàn toàn trên browser)   │
├───────────────┬───────────────┬───────────────┤
│  Dictionary    │  Learning      │  Progress     │
│  Module        │  Modules       │  Tracking     │
│  (search/lookup)│ (flashcard,   │  (SRS engine, │
│                │  writing, nghe)│   thống kê)   │
├───────────────┴───────────────┴───────────────┤
│              Data Layer (local)                │
│   - Vocabulary DB (JSON, HSK 1-6, tĩnh)         │
│   - User Progress (localStorage/IndexedDB)      │
│   - Audio assets (TTS runtime hoặc file có sẵn) │
└─────────────────────────────────────────────┘
```

Do dữ liệu từ vựng đầy đủ (11,000+ từ HSK 3.0) khá lớn, khuyến nghị dùng **IndexedDB** thay vì localStorage cho phần dictionary tĩnh (localStorage giới hạn ~5-10MB và là chuỗi đồng bộ, không phù hợp dataset lớn). Tiến độ học (progress) có thể vẫn dùng localStorage vì nhẹ.

---

## 3. Cấu trúc dữ liệu từ vựng (Vocabulary Schema)

```json
{
  "id": "hsk1_0001",
  "simplified": "你好",
  "traditional": "你好",
  "pinyin": "nǐ hǎo",
  "pinyin_numeric": "ni3 hao3",
  "hsk_level": 1,
  "pos": ["Interjection"],
  "meaning_en": "hello",
  "meaning_vi": "xin chào",
  "radical": "亻",
  "stroke_count": 9,
  "classifier": null,
  "example_sentences": [
    {
      "zh": "你好，很高兴认识你。",
      "pinyin": "Nǐ hǎo, hěn gāoxìng rènshi nǐ.",
      "vi": "Xin chào, rất vui được gặp bạn."
    }
  ],
  "audio_url": null,
  "frequency_rank": 1
}
```

Nguồn dữ liệu gốc: `drkameleon/complete-hsk-vocabulary` (JSON, đủ field level/pos/meaning/classifier) hoặc `ivankra/hsk30` (CSV sạch, có pinyin/POS/biến thể). Cần pipeline dịch `meaning_en` → `meaning_vi` (dùng google translate API để dịch hàng loạt, xử lý theo batch ~100-200 từ/lần, review lại các từ đa nghĩa).

---

## 4. Danh sách Features chi tiết

### 4.1. Dictionary / Tra từ
- Search theo: Hán tự, pinyin (có/không dấu), nghĩa tiếng Việt hoặc Anh, bộ thủ.
- Trang chi tiết từ: Hán tự lớn, pinyin, âm thanh, nghĩa, ví dụ câu, phân tích bộ thủ, HSK level, các từ liên quan (cùng bộ thủ, đồng nghĩa).
- Lọc/duyệt theo HSK level (1-6, hoặc 7-9 theo HSK 3.0 mới).
- Bookmark/đánh dấu từ để ôn sau.

### 4.2. Flashcard
- Chế độ Hán tự → nghĩa, nghĩa → Hán tự, Hán tự → pinyin.
- Nút "biết" / "chưa biết" để đưa vào hàng đợi SRS.
- Có thể lọc bộ flashcard theo HSK level hoặc theo danh sách đã lưu (bookmark).

### 4.3. Luyện viết chữ Hán (Character Writing Practice)
- Hiển thị hoạt hình thứ tự nét (dùng thư viện mã nguồn mở **Hanzi Writer** — hỗ trợ animation SVG, quiz nét vẽ, cực kỳ phù hợp cho web).
- Chế độ "xem" (animation tự động) và chế độ "luyện" (người dùng vẽ theo, hệ thống chấm đúng/sai từng nét).
- Theo dõi số chữ đã luyện viết thành thạo.

### 4.4. Luyện nghe & thanh điệu
- Nghe audio (TTS hoặc file có sẵn) → chọn Hán tự/nghĩa đúng.
- Module riêng cho **4 thanh điệu**: nghe 1 âm tiết, chọn đúng thanh điệu (1/2/3/4/nhẹ), có visualize đường cong thanh điệu để so sánh.
- Shadowing: nghe câu mẫu, ghi âm lại giọng người học (nếu dùng Web Speech API hoặc MediaRecorder), so sánh (ở mức cơ bản, có thể chỉ là nghe lại chứ không cần AI chấm điểm phát âm — việc này phức tạp, có thể để giai đoạn sau).

### 4.5. Trắc nghiệm / Quiz
- Điền pinyin cho Hán tự (có bàn phím pinyin ảo, tự thêm dấu thanh).
- Điền Hán tự cho pinyin (khó hơn, có thể chọn từ danh sách gợi ý theo bộ thủ).
- Chọn nghĩa đúng (trắc nghiệm 4 đáp án).
- Sentence building: ghép các từ/cụm từ cho sẵn thành câu đúng ngữ pháp (kéo-thả).

### 4.6. Ngữ pháp (Grammar notes)
- Trang tổng hợp điểm ngữ pháp theo từng HSK level (câu 吗/呢, trợ từ 了/的/在/着/过, câu chữ 把/被, bổ ngữ kết quả/xu hướng...).
- Mỗi điểm ngữ pháp có ví dụ minh họa + bài tập nhỏ liên quan.
- Nguồn tham khảo: HSK 3.0 syllabus chính thức (có sẵn trong `krmanik/HSK-3.0`, gồm cả grammar points dạng text/JSON).

### 4.7. Spaced Repetition System (SRS)
- Thuật toán kiểu Anki (SM-2 hoặc biến thể đơn giản hơn): mỗi từ có `interval`, `ease_factor`, `next_review_date`.
- Sau mỗi lần ôn (flashcard/quiz), người dùng đánh giá độ khó (Again/Hard/Good/Easy) → cập nhật lịch ôn tiếp theo.
- Trang "Ôn tập hôm nay" tổng hợp tất cả từ đến hạn ôn (không phân biệt loại bài tập).

### 4.8. Progress Tracking
- Đếm số từ mới học/ngày, số từ ôn tập/ngày (không streak, không gamification theo đúng yêu cầu).
- Thống kê theo HSK level: đã học bao nhiêu % từ vựng mỗi level.
- Biểu đồ đơn giản (line/bar chart) số từ học theo thời gian.
- Lịch sử/log các từ đã học, có thể xem lại và sửa trạng thái thủ công.

---

## 5. Component Structure (Frontend)

```
App
├── Layout (Sidebar/Nav: Dictionary | Học | Ôn tập | Ngữ pháp | Thống kê)
│
├── DictionaryPage
│   ├── SearchBar (search theo hanzi/pinyin/nghĩa/bộ thủ)
│   ├── LevelFilter
│   ├── WordList
│   └── WordDetailPanel
│       ├── HanziDisplay
│       ├── PinyinAudioPlayer
│       ├── RadicalBreakdown
│       └── ExampleSentences
│
├── LearnPage
│   ├── FlashcardMode
│   │   ├── FlashcardCard (flip animation)
│   │   └── SessionSummary
│   ├── WritingPracticeMode
│   │   ├── HanziWriterCanvas (dùng thư viện Hanzi Writer)
│   │   └── StrokeOrderQuiz
│   ├── ListeningMode
│   │   ├── AudioPlayer
│   │   └── ToneRecognitionQuiz
│   └── QuizMode
│       ├── PinyinInputQuiz
│       ├── HanziChoiceQuiz
│       ├── MeaningChoiceQuiz
│       └── SentenceBuilderQuiz
│
├── ReviewPage (SRS)
│   ├── DueTodayList
│   └── ReviewSession (tái sử dụng components từ LearnPage)
│
├── GrammarPage
│   ├── GrammarPointList (theo HSK level)
│   └── GrammarPointDetail
│
├── ProgressPage
│   ├── DailyCountChart
│   ├── LevelCompletionBar
│   └── LearnedWordsLog
│
└── SharedComponents
    ├── HanziWriterCanvas (component tái sử dụng)
    ├── AudioButton (TTS/play)
    ├── LevelBadge
    └── BookmarkToggle
```

---

## 6. Data Layer chi tiết

| Loại dữ liệu | Nơi lưu | Lý do |
|---|---|---|
| Từ vựng HSK (tĩnh, ~11,000 từ) | IndexedDB (load 1 lần từ file JSON khi khởi tạo) | Dataset lớn, cần query nhanh, localStorage không phù hợp |
| Ngữ pháp points | IndexedDB hoặc JSON tĩnh load runtime | Dữ liệu tĩnh, không thay đổi |
| Tiến độ học (SRS state, bookmark, log) | IndexedDB (hoặc localStorage nếu nhẹ) | Cần update thường xuyên, persist qua session |
| Audio | TTS runtime (Web Speech API) hoặc file audio tải kèm theo bộ dữ liệu (nếu có) | Không cần lưu, generate on-the-fly nếu dùng TTS |

**Import flow khi khởi tạo app lần đầu:**
1. Tải file `hsk_vocabulary.json` (đã qua xử lý, có nghĩa tiếng Việt) → bulk insert vào IndexedDB.
2. Tải file `grammar_points.json` → insert.
3. Khởi tạo bảng `user_progress` rỗng.

---

## 7. Nguồn dữ liệu & Pipeline chuẩn bị

1. **Lấy dữ liệu gốc:**
   - `drkameleon/complete-hsk-vocabulary` (JSON, có level/pos/meaning/classifier) — nguồn chính.
   - `ivankra/hsk30` (CSV, pinyin + POS sạch) — đối chiếu/bổ sung.
   - `krmanik/HSK-3.0` — lấy thêm phần grammar points theo syllabus chính thức.

2. **Xử lý dữ liệu:**
   - Merge các nguồn, chuẩn hóa schema như mục 3.
   - Dịch `meaning_en` → `meaning_vi` theo batch (dùng Goolge Translate API), review thủ công các từ đa nghĩa/dễ nhầm.
   - Tính `radical` (bộ thủ) và `stroke_count` cho từng chữ (có thể lấy từ CC-CEDICT hoặc thư viện Hanzi Writer — thư viện này đã có data stroke order sẵn cho phần lớn Hán tự thông dụng).
   - Sinh ví dụ câu (nếu nguồn gốc thiếu)

3. **Lưu ý bản quyền:** Dữ liệu HSK gốc là công trình của Bộ Giáo dục Trung Quốc; các repo GitHub claim license MIT nhưng về pháp lý "hơi đáng ngờ" khi copy nguyên văn từ tài liệu chính phủ. Với mục đích học tập cá nhân thì không vấn đề gì, nhưng nếu định public/thương mại hóa app sau này thì cần cân nhắc lại nguồn.

---

---

## 8. Trạng thái triển khai (thực tế — cập nhật từng phiên)

> Phần này ghi nhận HSK đã nhập vào app tiếng Anh hiện có (khóa Tiếng Trung 🇨🇳
> trong `apps/web`). Code gốc: `docs/WEB-REACT.md`, pipeline: `docs/DATA-PIPELINES.md`.

| # | Mô-đun theo thiết kế (mục 4) | Trạng thái | Ghi chú |
|---|---|---|---|
| 4.1 | Từ điển / tra từ | ✅ | `ZhDictScreen` — tìm Hán tự/pinyin(±dấu)/vi/en/bộ thủ, lọc cấp, chi tiết + bookmark |
| 4.2 | Flashcard | ✅ | `translate-vi` + flashcard (games có sẵn) |
| 4.3 | Luyện viết (thứ tự nét) | ✅ | `WritingScreen` — Hanzi Writer, xem nét + vẽ theo, 1.799 chữ đủ nét |
| 4.4 | Nghe & thanh điệu | ✅ | `ToneQuizScreen` — TTS zh-CN + chọn thanh điệu (pinyin_numeric, 5 thanh) |
| 4.5 | Trắc nghiệm / Quiz | 🟡 | Thanh điệu là dạng quiz; thiếu Pinyin-typing quiz (v2) |
| 4.6 | Ngữ pháp theo cấp | ✅ | `GrammarScreen` — 422 điểm HSK 3.0 chính thức, kèm ví dụ |
| 4.7 | SRS (SM-2) | ✅ | `ReviewScreen` — Lại/Khó/Tốt/Dễ, lịch ôn `entry.srs`, hàng đợi do hạn + từ mới |
| 4.8 | Progress theo cấp | ✅ | Stats zh: tiến độ theo cấp HSK (đã thuộc/đã thêm) |

**Độ lệch với schema mục 3 (đã thích nghi):**
- `hsk.json` (từ điển app) giữ ĐÚNG thiết kế: `id/simplified/traditional/pinyin/
  pinyin_numeric/hsk_level/pos/meaning_en/meaning_vi/radical/classifier/
  frequency_rank/strokes/senses/example_sentences`. `stroke_count` = `strokes[].n`.
- `example_sentences[]` đang RỖNG (nguồn HSK không kèm câu; v2: sinh câu qua LLM
  hoặc thêm `forms[0].examples` nếu nguồn có).
- Dữ liệu nhập IndexedDB **chỉ khi bookmark/học bài** (không nhập toàn 5.363 từ);
  từ điển đọc trực tiếp file tĩnh `legacy/js/zh-dict/hsk.json` (lazy + cache PWA)
  theo đúng triết lý "không bao giờ nạp toàn bộ bank lớn".
- `pos` trong HSK nguồn là CC-CEDICT (viết tắt: v/n/adj/m…) — đã đổi sang chữ đầy
  đủ khi build `hsk.json`.

**Dữ liệu con số (sinh lại được):**
- Từ: 5.363 (HSK1 506 · 2 750 · 3 953 · 4 972 · 5 1.059 · 6 1.123) · 1799 chữ có nét.
- Bài học: 269 (HSK1 26 · 2 37 · 3 48 · 4 49 · 5 52 · 6 57) — thay bộ HSK 2.0 cũ.
- Ngữ pháp: 422 điểm (48/81/81/75/71/66).
- Chưa làm: audio file (dùng TTS), login (không cần — thiết kế cá nhân), bàn phím pinyin.
