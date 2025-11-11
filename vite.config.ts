import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import path from "path";
import { codeInspectorPlugin } from "code-inspector-plugin";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    // Code inspector must be placed before @vitejs/plugin-react
    process.env.NODE_ENV !== 'production' && codeInspectorPlugin({
      bundler: 'vite',
      behavior: {
        defaultAction: 'copy',  // Copy mode for AI workflow
      },
      showSwitch: true,         // Show toggle button
    }),
    react(),
  ].filter(Boolean),
  
  resolve: {
    alias: {
      "@/components/ui": path.resolve(__dirname, "./src/components/ui"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: [
        "**/src-tauri/**",
        "**/package.json",
        "**/CHANGELOG.md",
      ],
    },
  },
  // 单入口配置，通过 URL 参数控制渲染
  // build: {},
}));
