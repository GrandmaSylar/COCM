/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Letting Vite handle chunks automatically to avoid circular dependency
        // and React execution order issues from manual chunking.
      },
    },
  },
  server: {
    port: 8080,
    open: true,
  },
});