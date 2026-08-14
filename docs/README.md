# English Learning — Tài liệu (Docs)

> Quy ước repo: **thành phần nào implement ra đều có file MD giải thích
> "làm gì · lợi ích gì · format ra sao"**. Trang này là chỉ mục.

## Chỉ mục tài liệu

| Tài liệu | Nội dung | Thành phần mô tả |
|---|---|---|
| [PRODUCTION-PLAN.md](PRODUCTION-PLAN.md) | Lộ trình production tổng thể + các quyết định | Toàn repo |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Bản đồ kiến trúc hiện tại + đích | apps/, packages/ |
| [LEGACY-APP.md](LEGACY-APP.md) | App JS đang dùng hằng ngày: chạy sao, module nào, format gì | `apps/web/public/legacy/` |
| [DATA-MODEL.md](DATA-MODEL.md) | Mọi format dữ liệu (entry, sense, lesson, chunk, localStorage) | js/*, packages/shared |
| [WEB-REACT.md](WEB-REACT.md) | App React mới: làm gì, cấu trúc, cách port màn hình | `apps/web/src/` |
| [API-SYNC.md](API-SYNC.md) | Backend FastAPI: đồng bộ đa người dùng, auth, sync protocol | `apps/api/` |
| [DATA-PIPELINES.md](DATA-PIPELINES.md) | 4 tool sinh dữ liệu từ jsonl: lệnh, định dạng, cache | `tools/` |
| [TOOLING.md](TOOLING.md) | ESLint/Prettier/TS/CI: làm gì, phạm vi, format config | `eslint.config.mjs`, `.prettierrc`, CI |
| [INDEXEDDB.md](INDEXEDDB.md) | Lớp dữ liệu mới (GĐ 2): schema, repo API, migration | `apps/web/src/db/` |
| [DESIGN.md](DESIGN.md) | Design system React (GĐ 3): tokens, màn hình, hành vi port | `apps/web/src/styles/`, `components/`, `features/` |
| [requirements.md](../requirements.md) | Yêu cầu chức năng gốc (cũ, giữ tham khảo) | — |

## Chạy nhanh

```bash
npm install                          # cài workspace (web + shared)
npm run dev                          # Vite dev server → http://localhost:5173
npm run build && npm run preview     # build production
npm test                             # 142 test của app legacy
npm run lint && npm run typecheck    # GĐ 1: kiểm tra chất lượng code
npm run test:react                   # GĐ 2-3: vitest (db 12 + smoke 3)

# API (GĐ 5 — hiện chỉ /health)
pip install -r apps/api/requirements.txt
npm run api                          # → http://localhost:8000/health
```

## Đường dẫn quan trọng

- App legacy (dùng hằng ngày): `apps/web/public/legacy/index.html` — mở bằng
  file:// hoặc qua dev server tại `/legacy/index.html`.
- App React mới: `apps/web/src/` (GĐ 3: Picker/Home/Vocab/Games/Stats — xem
  docs/DESIGN.md).
- Dữ liệu thô: `data/raw/english-dictionary.jsonl` (41MB — git-ignored).
