/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Vite build app React. App legacy nằm trong public/legacy/ được copy nguyên
// trạng vào dist/ (chạy tại /legacy/). Xem docs/LEGACY-APP.md.
// PWA (GĐ 4): service worker precache asset build + legacy (TRỪ bank 25MB và
// lessons — tải theo nhu cầu, cache-first khi chạy). Cài đặt app, dùng offline.
// Test (vitest): chạy trên Node với fake-indexeddb — xem src/db/db.test.ts.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // dùng public/manifest.webmanifest tĩnh
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest,woff2}'],
        // KHÔNG precache bank 25MB + lessons on-demand (chỉ runtime cache)
        globIgnores: ['**/legacy/js/bank/**', '**/legacy/js/lessons/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/legacy\//],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          // từ điển: tải đúng chunk cần tra, giữ tối đa 110 (đủ 104 chunk)
          {
            urlPattern: /\/legacy\/js\/bank\/.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vocab-bank',
              expiration: { maxEntries: 110, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // bài học: file bài tải khi mở, cache-first
          {
            urlPattern: /\/legacy\/js\/lessons\/.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vocab-lessons',
              expiration: { maxEntries: 200 },
            },
          },
          // các file legacy còn lại (seed, ui, css…)
          {
            urlPattern: /\/legacy\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vocab-legacy',
              expiration: { maxEntries: 120 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
