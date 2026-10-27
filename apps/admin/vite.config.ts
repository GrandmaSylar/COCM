import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Env comes from apps/admin/.env only (the default). Do not point envDir at the
// repo root: its .env holds a service-role key under a VITE_ name.
export default defineConfig({
  plugins: [react()],
  // The repo root hoists a different React; make hoisted libraries (lucide-react)
  // use this app's copy.
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { outDir: path.resolve(__dirname, 'build') },
  server: { port: 8083, strictPort: true, open: true },
});
