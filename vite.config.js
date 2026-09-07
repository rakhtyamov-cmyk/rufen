import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // API остаётся на Express (server.js, порт 4173) — Vite dev-сервер
    // проксирует /api туда же, чтобы `npm run dev` не требовал двух портов в голове.
    proxy: {
      '/api': 'http://localhost:4173',
    },
  },
  build: {
    outDir: 'dist',
  },
});
