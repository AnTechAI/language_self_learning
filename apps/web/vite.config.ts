/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite build app React. App legacy nằm trong public/legacy/ được copy nguyên
// trạng vào dist/ (chạy tại /legacy/). Xem docs/LEGACY-APP.md.
// Test (vitest): chạy trên Node với fake-indexeddb — xem src/db/db.test.ts.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
