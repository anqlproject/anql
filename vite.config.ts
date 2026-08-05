import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from 'vite-plugin-static-copy';

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(), 
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'docs/Help/Assets',
          dest: 'docs/Help'
        }
      ]
    })
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "docs": path.resolve(__dirname, "./docs"),
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
