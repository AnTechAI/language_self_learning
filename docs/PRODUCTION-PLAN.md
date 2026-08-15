# Kế hoạch Production — English Learning App

> **ĐÃ QUYẾT ĐỊNH (đã duyệt):**
> 1. UI framework: **React** (+ TypeScript + Vite)
> 2. Backend: **FastAPI (Python)** — đồng bộ dữ liệu để **share app cho bạn bè** (multi-user)
> 3. Bắt đầu: **Giai đoạn 0** (bọc Vite — hoàn thành ✅)
> 4. Quy ước: mọi thành phần đều có file MD giải thích (xem docs/README.md)

---

## 1. Hiện trạng sau GĐ 0 (đã xong)

| Mục | Trạng thái |
|---|---|
| Monorepo (npm workspaces): `apps/web` + `packages/shared` | ✅ |
| App legacy chạy dưới Vite tại `/legacy/` (và vẫn chạy file://) | ✅ |
| App React khung trống (Vite + React 18 + TS strict) | ✅ |
| FastAPI skeleton (`/health`) | ✅ |
| `.gitignore` (41MB jsonl + 25MB chunk không commit) | ✅ |
| 142 test legacy vẫn xanh | ✅ |

## 2. Kiến trúc đích

```
apps/web (React + Vite + TS) ──┬── features/: lessons · games · vocab · review · stats
                               ├── db/: IndexedDB (migration từ localStorage)
                               ├── lib/: tts · dict-api · logic thuần (port từ legacy)
                               ├── data/: seed + lessons (lazy import)
                               └── PWA: offline
apps/api (FastAPI + SQLite) ─── sync đa người dùng · proxy dictionary · auth
packages/shared ─────────────── types dùng chung web + api (đã có)
data/scripts ────────────────── 5 tool sinh dữ liệu + CLI chung (di dời xong ở GĐ 4)
```

## 3. Lộ trình

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| **0** | Bọc Vite + monorepo + React khung + FastAPI skeleton + docs | ✅ XONG |
| **1** | TypeScript hóa data model (packages/shared — đã đối chiếu toEntry thật); ESLint/Prettier; CI GitHub Actions | ✅ XONG |
| **2** | localStorage → IndexedDB (migration tự động, repo pattern — `apps/web/src/db/`, 12 test) | ✅ XONG |
| **3** | Port từng màn hình sang React (Picker → Home/Lessons → Games → Vocab → Stats) — zustand + design system mới + smoke test | ✅ XONG (xem docs/DESIGN.md) |
| **4** | PWA offline (vite-plugin-pwa: manifest + icon + SW precache asset build + legacy, runtime cache bank/lessons — dùng được khi mất mạng, cài đặt như app) | ✅ XONG (đã di dời tools → data/scripts + CLI chung) |
| **5** | Backend FastAPI: tài khoản + sync đa người dùng + proxy từ điển | ✅ XONG (xem docs/API-SYNC.md) |

## 4. Quyết định kỹ thuật

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Build | Vite | chuẩn, nhanh, HMR, code-split |
| Ngôn ngữ | TypeScript (strict) | data model đã rõ, tránh bug |
| UI | React 18 | đã duyệt; hệ sinh thái lớn |
| State (GĐ 3) | **Zustand** (đã dùng) | nhẹ, phổ biến |
| Router (GĐ 3) | **Tab state trong store** (chưa cần react-router — thêm khi có deep-link/URL) | app nhỏ, 4 tab; router thêm chi phí không cần thiết |
| Lưu trữ | IndexedDB (idb) | đủ lớn cho 25MB từ điển, migration từ localStorage |
| PWA (GĐ 4) | vite-plugin-pwa (autoUpdate) + manifest.webmanifest tĩnh + icon tự sinh (`data/scripts/make-icons.js`) | precache asset build + legacy trừ bank/lessons (tải nhu cầu, runtime cache) — offline thật, không phình bundle |
| Backend | FastAPI + SQLite (better-sqlite3 tương đương bên Python: sqlite3 chuẩn) | thân thiện tác giả, deploy đơn giản |
| Auth (GĐ 5) | JWT (hoặc token đơn giản cho bạn bè) | đơn giản, đủ dùng |
| Deploy | static (Vercel/Netlify/Pages) + API trên VPS/Workers | chi phí 0 |

## 5. Deploy

- **GĐ 0 → 4**: SPA tĩnh — GitHub Pages / Netlify / Vercel, chi phí 0đ.
- **GĐ 5**: API FastAPI trên VPS nhỏ hoặc Render/Fly.io free tier; DB SQLite (một file — dễ backup).

## 6. Rủi ro

1. Không phá app đang dùng: legacy chạy song song đến khi React đủ tính năng.
2. Free API (dictionaryapi.dev, Google Translate endpoint) chỉ dùng dev — GĐ 5 proxy qua backend.
3. Dữ liệu học tập là của người dùng: luôn export/backup trước khi đổi schema.
4. TTS (Web Speech) phụ thuộc nền tảng — giữ fallback.
