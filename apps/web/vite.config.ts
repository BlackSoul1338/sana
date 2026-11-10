import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  // Single repo-root .env; only VITE_* variables reach the browser.
  envDir: '../..',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
