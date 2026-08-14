# Requirements Document — Website Học Từ Vựng Tiếng Anh

## 1. Tổng quan (Overview)

**Mục tiêu:** Xây dựng một website cá nhân hỗ trợ học từ vựng tiếng Anh thông qua:

- Một từ điển cá nhân (personal vocabulary bank) lưu trữ thông tin chi tiết về từ vựng.
- Các minigame tương tác để luyện tập và ghi nhớ từ.
- Hệ thống theo dõi tiến độ học tập (learning tracker).

**Đối tượng sử dụng:** Cá nhân (single-user), có thể mở rộng multi-user sau này.

---

## 2. Data Model — Từ vựng (Vocabulary Entry)

Mỗi từ vựng cần lưu các trường sau:

| Trường           | Tên field        | Kiểu dữ liệu | Bắt buộc | Ghi chú                                                         |
| ---------------- | ---------------- | ------------ | -------- | --------------------------------------------------------------- |
| Từ               | `word`           | string       | ✅       | Từ tiếng Anh gốc                                                |
| Phiên âm         | `pronunciation`  | string (IPA) | ✅       | Ví dụ: `/əˈpruːv/`                                              |
| Loại từ          | `partOfSpeech`   | enum         | ✅       | noun, verb, adjective, adverb, ... (có thể nhiều loại cho 1 từ) |
| Gốc từ           | `wordRoot`       | string       | ⬜       | Ví dụ: gốc Latin, Hy Lạp...                                     |
| Nghĩa tiếng Anh  | `definitionEN`   | string       | ✅       | Định nghĩa bằng tiếng Anh                                       |
| Nghĩa tiếng Việt | `definitionVI`   | string       | ✅       | Định nghĩa/nghĩa dịch tiếng Việt                                |
| Từ đồng nghĩa    | `synonyms`       | string[]     | ⬜       | Danh sách từ đồng nghĩa                                         |
| Trái nghĩa       | `antonyms`       | string[]     | ⬜       | Danh sách từ trái nghĩa                                         |
| Ví dụ câu        | `examples`       | string[]     | ⬜       | _(đề xuất bổ sung — xem mục 6)_                                 |
| Chủ đề/tag       | `tags`           | string[]     | ⬜       | _(đề xuất bổ sung)_                                             |
| Ngày thêm        | `dateAdded`      | date         | auto     |                                                                 |
| Trạng thái học   | `learningStatus` | enum         | auto     | new / learning / mastered                                       |

**Câu hỏi cần làm rõ:**

- Một từ có thể có **nhiều loại từ** (vd "record" vừa là noun vừa là verb, phát âm khác nhau) — có cần hỗ trợ nhiều "nghĩa" (senses) cho 1 từ không?
- Từ đồng nghĩa/trái nghĩa: nhập tay hay tự động gợi ý qua API/dictionary?

---

## 3. Chức năng chính (Functional Requirements)

### 3.1. Quản lý từ vựng (Vocabulary CRUD)

- Thêm / sửa / xóa từ vựng.
- Xem danh sách từ vựng (có tìm kiếm, lọc theo loại từ / trạng thái học / tag).
- Xem chi tiết 1 từ (đầy đủ các trường).
- _(Tùy chọn)_ Import hàng loạt từ file CSV/Excel hoặc qua API từ điển (vd. Free Dictionary API) để tự động điền phiên âm/nghĩa.

### 3.2. Games học từ vựng

| Game                     | Mô tả                                                                                        | Input            | Output/Đánh giá                         |
| ------------------------ | -------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------- |
| **Flashcard**            | Hiển thị mặt trước (từ hoặc nghĩa), người dùng lật thẻ xem đáp án                            | Chọn bộ từ để ôn | Người dùng tự đánh giá "nhớ / chưa nhớ" |
| **Dịch nghĩa (2 chiều)** | (a) Hiện nghĩa tiếng Việt → nhập từ tiếng Anh; (b) Hiện từ tiếng Anh → nhập nghĩa tiếng Việt | Text input       | So khớp đáp án, chấm đúng/sai           |
| **Chọn từ đồng nghĩa**   | Trắc nghiệm: cho 1 từ, chọn từ đồng nghĩa đúng trong 4 lựa chọn                              | Multiple choice  | Đúng/sai                                |
| **Chọn từ trái nghĩa**   | Tương tự, chọn từ trái nghĩa đúng                                                            | Multiple choice  | Đúng/sai                                |

**Câu hỏi cần làm rõ:**

- Dịch nghĩa: chấm đúng/sai như thế nào? Exact match, hay chấp nhận gần đúng (fuzzy match / bỏ qua hoa-thường, dấu câu)?
- Chọn đồng nghĩa/trái nghĩa: các lựa chọn sai (distractors) lấy từ đâu — từ ngẫu nhiên trong kho từ vựng, hay cần đảm bảo cùng loại từ để tránh quá dễ đoán?
- Nếu 1 từ không có sẵn synonym/antonym trong kho, game đó có tự động bỏ qua từ đó không?

### 3.3. Theo dõi & lưu tiến độ học (Progress Tracking)

- Lưu lịch sử mỗi lần chơi game: từ nào đúng, từ nào sai, thời gian chơi.
- Đánh dấu trạng thái từ: **new → learning → mastered** (dựa trên số lần trả lời đúng liên tiếp, hoặc thủ công).
- Trang thống kê ("Đã học"): xem danh sách từ đã học/đang học/chưa học, tỷ lệ đúng theo từng game, biểu đồ tiến độ theo thời gian.
- _(Tùy chọn)_ Spaced repetition: ưu tiên ôn lại từ hay sai hoặc lâu chưa ôn.

---

## 4. Yêu cầu phi chức năng (Non-functional Requirements)

- **Lưu trữ dữ liệu:** cần xác định — lưu local (localStorage/IndexedDB) cho bản đơn giản, hay có backend + database để lưu lâu dài và truy cập nhiều thiết bị?
- **Responsive:** dùng tốt trên cả desktop và mobile.
- **Hiệu năng:** tải nhanh với kho từ vựng lớn (hàng trăm–nghìn từ).
- **Khả năng mở rộng:** dễ thêm game mới, dễ thêm trường dữ liệu mới sau này.

---

## 5. Đề xuất kiến trúc kỹ thuật (gợi ý, cần xác nhận)

| Thành phần          | Đề xuất                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend            | React (hoặc Next.js nếu cần SEO/SSR)                                                                                                                     |
| Lưu trữ dữ liệu     | Giai đoạn 1: localStorage/IndexedDB (không cần backend); Giai đoạn 2: backend (Node.js + database như PostgreSQL/SQLite) nếu muốn đồng bộ nhiều thiết bị |
| Phát âm             | Có thể tích hợp Text-to-Speech (Web Speech API) để đọc từ                                                                                                |
| Tra từ điển tự động | Free Dictionary API hoặc tương tự, để tự điền phiên âm/nghĩa khi thêm từ mới                                                                             |

---

## 6. Đề xuất bổ sung (Suggested additions — cần bạn xác nhận có muốn thêm không)

- **Câu ví dụ (example sentences):** giúp nhớ từ theo ngữ cảnh.
- **Phát âm bằng audio (TTS):** nghe cách đọc từ.
- **Tag/chủ đề:** phân loại từ theo chủ đề (business, travel, academic...) để học theo bộ.
- **Chế độ ôn tập hàng ngày (daily review / streak):** nhắc nhở học mỗi ngày.

---## 7. Từ điển ngoại tuyến truy xuất theo nhu cầu (Offline dictionary bank)

- `english-dictionary.jsonl` (207.272 entry) **KHÔNG nạp vào app** — được `tools/build-chunks.js` chia thành **104 chunk nhỏ** (`js/bank/chunk-NNN.js`, ~24.7MB tổng) + `js/bank/manifest.js` (danh sách chunk).
- App chỉ tải **ĐÚNG 1 chunk chứa từ cần tra** (chèn `<script>` động — chạy tốt trên `file://`): băm FNV-1a `word % N` → tên chunk → load → tìm entry. Mỗi lần tra tải ~270KB.
- Nút "🔍 Tra từ điển" trong modal Thêm từ: **ưu tiên từ điển máy** (offline, nhanh, đủ mọi nghĩa/loại từ/đồng-trái nghĩa) → **fallback API online** (nếu từ không có trong máy).
- Chunk bị thiếu/hỏng → tự động bỏ qua, fallback API → app không bao giờ lỗi vì thiếu bank.
- Tái sinh khi cần: `node tools/build-chunks.js` (thêm `--size 3000` để chunk to hơn).
- Không có phiên âm trong JSONL nên khi tra từ điển máy, phiên âm để trống (người dùng tự bổ sung hoặc từ đã có trong 523 từ cơ bản thì có sẵn).

## 8. BÀI HỌC (Lesson) — học từ mới theo bài, games theo bài

- `tools/build-lessons.js` đọc english-dictionary.jsonl (dịch Việt + IPA API) → **chia BÀI HỌC, mỗi bài 20 từ** → xuất `js/lessons/` (manifest.js + lesson-001.js…).
- App chỉ tải ĐÚNG bài học người dùng chọn (`js/lesson-loader.js`, chèn `<script>` động — chạy tốt trên `file://`).
- **"Học từ mới"** (tab Hôm nay): chọn bài → **tự thêm 20 từ của bài vào kho** (entry có `lessonId` + tag chủ đề) → hiện thẻ từ mới đầu tiên để học. Idempotent (không thêm trùng).
- **Tab Từ vựng**: chip điều hướng [Tất cả từ] / [Bài 1 · chủ đề]…; mở bài → xem 20 từ với trạng thái học; nút "Học bài này".
- **Games**: bộ chọn **Phạm vi** (Tất cả từ / theo bài học) — chọn bài nào thì flashcard/dịch nghĩa/đồng-trái nghĩa chỉ dùng từ bài đó.
- Tái sinh bài học: `node tools/build-lessons.js --file tools/lesson-words.txt` (cache API ở tools/out/lesson-cache.json — chạy lại nhanh).
