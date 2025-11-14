/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@/components/ui": path.resolve(__dirname, "./src/components/ui"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    css: {
      include: /.+/,
    },
    server: {
      deps: {
        inline: [/./],  // Inline all dependencies to prevent CSS import issues
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.config.{ts,js}',
        'src-tauri/',
      ],
    },
  },
});
