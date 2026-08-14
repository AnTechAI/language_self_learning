import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite build app React. App legacy nằm trong public/legacy/ được copy nguyên
// trạng vào dist/ (chạy tại /legacy/). Xem docs/LEGACY-APP.md.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
