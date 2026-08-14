/**
 * App React — GĐ 0 (khung trống).
 * Mục tiêu: sẵn sàng để port từng màn hình từ app legacy
 * (xem docs/WEB-REACT.md + docs/PRODUCTION-PLAN.md).
 */
export default function App() {
  return (
    <main style={{ maxWidth: 640, margin: '48px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>🇬🇧 English Learning — React</h1>
      <p style={{ color: '#555' }}>
        Đây là ứng dụng React mới (giai đoạn 0). App đang dùng hằng ngày vẫn nằm tại{' '}
        <a href="/legacy/">/legacy/</a> và hoạt động đầy đủ.
      </p>
      <ul>
        <li>GĐ 0: khung Vite + React + TS ✅</li>
        <li>GĐ 1: TypeScript hóa data model (types ở packages/shared)</li>
        <li>GĐ 2: localStorage → IndexedDB</li>
        <li>GĐ 3: port từng màn hình sang React</li>
        <li>GĐ 5: đồng bộ FastAPI (apps/api)</li>
      </ul>
    </main>
  );
}
