import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // Zwei Seiten: das Spiel (index.html) und die eigenständige Bot-Seite (bot.html)
        main: resolve(__dirname, 'index.html'),
        bot: resolve(__dirname, 'bot.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
