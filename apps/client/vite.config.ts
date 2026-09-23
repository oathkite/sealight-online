import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Tauri / Capacitor から読み込むため相対パスで出力する
  base: "./",
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // API（wrangler dev）への要求を中継し、本番と同じく同一オリジンで呼べるようにする
    proxy: { "^/me(/|$)": "http://localhost:8787" },
  },
});
