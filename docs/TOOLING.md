# Tooling — ESLint · Prettier · TypeScript · CI

> Giai đoạn 1: công cụ phát triển chuẩn hóa + CI tự động trên GitHub.

## 1. Làm gì

| Công cụ | Việc | Lệnh |
|---|---|---|
| **TypeScript** | Kiểm tra kiểu toàn repo (web + shared) — `tsc --noEmit` | `npm run typecheck` |
| **ESLint** | Bắt lỗi code (biến chưa dùng, globals sai, quy tắc React hooks) | `npm run lint` |
| **Prettier** | Format code nhất quán | `npm run format` / `npm run format:check` |
| **GitHub Actions** | Chạy 4 bước trên mỗi push/pull-request | `.github/workflows/ci.yml` |

## 2. Lợi ích

- **Bắt lỗi sớm**: TS + ESLint tìm lỗi trước khi chạy — đặc biệt quan trọng khi port
  app legacy sang React (GĐ 3).
- **Code thống nhất**: Prettier định dạng tự động — không còn tranh cãi style.
- **CI = cửa kiểm tra tự động**: mỗi commit phải qua lint → typecheck → 142 test →
  build. Sai là đỏ, không cho merge — giữ cho bạn bè cùng đóng góp cũng an toàn.
- **Nhất quán web ↔ api**: cả hai cùng dùng types từ `packages/shared`.

## 3. Phạm vi (format & config)

- **ESLint/Prettier chỉ áp dụng** cho: `apps/web/src/`, `packages/shared/`, config files.
- **Ngoại lệ cố ý** (`eslint.config.mjs` ignores + `.prettierignore`):
  - `apps/web/public/` (app legacy — JS thuần, đã có 142 test bảo vệ, format sẽ gây nhiễu diff)
  - `data/scripts/`, `_e2e.js`, `data/`, `docs/` (giữ nguyên format hiện tại)
  - `**/dist/**`, `**/node_modules/**`, `package-lock.json`

## 4. CI — `.github/workflows/ci.yml`

```
Job "web"  (Node 22):  npm ci → lint → typecheck → test (142) → build
Job "api"  (Python 3.13): pip install → import FastAPI + assert
```

- Chạy khi push vào `main` hoặc mở pull-request.
- `npm ci` dựa trên `package-lock.json` (đã commit) — cài nhanh, khớp bản.
- App legacy không cần file sinh ra (bank/lessons git-ignored) — test dùng stub trong
  bộ nhớ, chạy được ngay trên clone sạch.

## 5. Format config

### ESLint (flat config — `eslint.config.mjs`)

```js
js.configs.recommended                    // quy tắc JS cơ bản
+ tseslint.configs.recommended            // quy tắc TS
+ eslint-plugin-react-hooks               // rules chuẩn cho hooks
+ eslint-plugin-react-refresh             // chỉ export component từ file
```

### Prettier (`.prettierrc.json`)

```json
{ "semi": true, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

### TypeScript

- `apps/web/tsconfig.json` — strict, JSX react-jsx, moduleResolution bundler.
- `packages/shared/tsconfig.json` — strict, noEmit (dùng làm thư viện type thuần).
- Lệnh `npm run typecheck` chạy cả hai (shared trước, web sau).

## 6. Chuẩn bị trước khi push (cho mọi thay đổi)

```bash
npm run lint          # hết lỗi
npm run typecheck     # hết lỗi kiểu
npm test              # 142/142 pass
npm run build         # build được
git push              # CI sẽ xác nhận lại từ đầu
```
