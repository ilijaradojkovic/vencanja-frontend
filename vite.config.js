import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // relativne putanje da build radi i iz podfoldera / statičkog hostinga
  base: './',
  server: { port: 5173 },
});
