/**
 * make-icons.js — SINH ICON PWA (PNG) cho app: nền brand + dấu ✓ trắng.
 * Dùng zlib của Node (không cần thư viện ngoài). Chạy lại bất cứ lúc nào.
 *
 *   node tools/make-icons.js            # ghi public/icons/icon-192.png + icon-512.png
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.resolve(__dirname, '..', 'apps', 'web', 'public', 'icons');
const BRAND = [0x10, 0xb9, 0x81]; // #10b981
const CHECK = [255, 255, 255];

/* ---------- PNG encoder (chuẩn, ít dòng) ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- vẽ ---------- */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const pad = size * 0.10; // vùng an toàn cho maskable
  const r = size * 0.22;   // bo góc
  // dấu ✓: 2 đoạn thẳng, dày ~7%
  const t = size * 0.07;
  const segs = [
    [size * 0.28, size * 0.52, size * 0.44, size * 0.68],
    [size * 0.44, size * 0.68, size * 0.73, size * 0.34],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-rect đầy nền
      const cx = Math.max(pad, Math.min(size - pad, x));
      const cy = Math.max(pad, Math.min(size - pad, y));
      const inRect = Math.hypot(x - cx, y - cy) <= r || (x >= pad && x < size - pad && y >= pad && y < size - pad);
      if (!inRect) { px[i + 3] = 0; continue; }
      // dấu ✓ trắng
      let onCheck = false;
      for (const s of segs) if (distToSegment(x + 0.5, y + 0.5, ...s) < t) { onCheck = true; break; }
      const c = onCheck ? CHECK : BRAND;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
  }
  return px;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = path.join(OUT_DIR, 'icon-' + size + '.png');
  fs.writeFileSync(file, encodePNG(size, drawIcon(size)));
  console.log('✓ ' + file + ' (' + fs.statSync(file).size + ' bytes)');
}
