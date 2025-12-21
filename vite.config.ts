import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import path from "path";
import { LovinspPlugin } from "lovinsp";
import { DEV_SERVER_PORT } from "./src/constants/window";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    // lovinsp must be placed before @vitejs/plugin-react
    process.env.NODE_ENV !== 'production' && LovinspPlugin({
      bundler: 'vite',
      behavior: {
        defaultAction: 'copy',  // Copy mode for AI workflow
      },
      showSwitch: false,         // Show toggle button
    }),
    react(),
  ].filter(Boolean),
  
  resolve: {
    alias: {
      "@/components/ui": path.resolve(__dirname, "./src/components/ui"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['jotai', 'react', 'react-dom'],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: DEV_SERVER_PORT + 1,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: [
        "**/src-tauri/**",
        "**/CHANGELOG.md",
      ],
    },
  },
  // 单入口配置，通过 URL 参数控制渲染
  // build: {},
}));
