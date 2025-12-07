// vite.config.js
import { defineConfig } from "file:///C:/Users/Fernando01/twbot_desktop_app/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Fernando01/twbot_desktop_app/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/Fernando01/twbot_desktop_app/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///C:/Users/Fernando01/twbot_desktop_app/node_modules/autoprefixer/lib/autoprefixer.js";
var vite_config_default = defineConfig({
  // Adiciona a configuração de servidor para garantir que o Electron
  // saiba onde o dev:vite está rodando (porta 5173).
  server: {
    port: 5173
  },
  // 1. Crucial para o Electron: garante que os caminhos sejam relativos.
  base: "./",
  plugins: [react()],
  // === NOVA SEÇÃO: Configuração do PostCSS diretamente no Vite ===
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        // Chama o plugin TailwindCSS
        autoprefixer()
        // Chama o plugin Autoprefixer
      ]
    }
  },
  // =============================================================
  // 2. Configurações para o build final
  build: {
    // Diretório onde o Vite colocará o build final (frontend)
    outDir: "dist-renderer",
    emptyOutDir: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxGZXJuYW5kbzAxXFxcXHR3Ym90X2Rlc2t0b3BfYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxGZXJuYW5kbzAxXFxcXHR3Ym90X2Rlc2t0b3BfYXBwXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9GZXJuYW5kbzAxL3R3Ym90X2Rlc2t0b3BfYXBwL3ZpdGUuY29uZmlnLmpzXCI7ICAgIC8vIHZpdGUuY29uZmlnLmpzXHJcblxyXG4gICAgaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuICAgIGltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuICAgIGltcG9ydCB0YWlsd2luZGNzcyBmcm9tICd0YWlsd2luZGNzcycgLy8gSW1wb3J0YSBvIFRhaWx3aW5kQ1NTXHJcbiAgICBpbXBvcnQgYXV0b3ByZWZpeGVyIGZyb20gJ2F1dG9wcmVmaXhlcicgLy8gSW1wb3J0YSBvIEF1dG9wcmVmaXhlclxyXG5cclxuICAgIC8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbiAgICBleHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gICAgICAvLyBBZGljaW9uYSBhIGNvbmZpZ3VyYVx1MDBFN1x1MDBFM28gZGUgc2Vydmlkb3IgcGFyYSBnYXJhbnRpciBxdWUgbyBFbGVjdHJvblxyXG4gICAgICAvLyBzYWliYSBvbmRlIG8gZGV2OnZpdGUgZXN0XHUwMEUxIHJvZGFuZG8gKHBvcnRhIDUxNzMpLlxyXG4gICAgICBzZXJ2ZXI6IHtcclxuICAgICAgICBwb3J0OiA1MTczLFxyXG4gICAgICB9LFxyXG5cclxuICAgICAgLy8gMS4gQ3J1Y2lhbCBwYXJhIG8gRWxlY3Ryb246IGdhcmFudGUgcXVlIG9zIGNhbWluaG9zIHNlamFtIHJlbGF0aXZvcy5cclxuICAgICAgYmFzZTogJy4vJyxcclxuXHJcbiAgICAgIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuXHJcbiAgICAgIC8vID09PSBOT1ZBIFNFXHUwMEM3XHUwMEMzTzogQ29uZmlndXJhXHUwMEU3XHUwMEUzbyBkbyBQb3N0Q1NTIGRpcmV0YW1lbnRlIG5vIFZpdGUgPT09XHJcbiAgICAgIGNzczoge1xyXG4gICAgICAgIHBvc3Rjc3M6IHtcclxuICAgICAgICAgIHBsdWdpbnM6IFtcclxuICAgICAgICAgICAgdGFpbHdpbmRjc3MoKSwgLy8gQ2hhbWEgbyBwbHVnaW4gVGFpbHdpbmRDU1NcclxuICAgICAgICAgICAgYXV0b3ByZWZpeGVyKCksIC8vIENoYW1hIG8gcGx1Z2luIEF1dG9wcmVmaXhlclxyXG4gICAgICAgICAgXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgICAvLyAyLiBDb25maWd1cmFcdTAwRTdcdTAwRjVlcyBwYXJhIG8gYnVpbGQgZmluYWxcclxuICAgICAgYnVpbGQ6IHtcclxuICAgICAgICAvLyBEaXJldFx1MDBGM3JpbyBvbmRlIG8gVml0ZSBjb2xvY2FyXHUwMEUxIG8gYnVpbGQgZmluYWwgKGZyb250ZW5kKVxyXG4gICAgICAgIG91dERpcjogJ2Rpc3QtcmVuZGVyZXInLFxyXG4gICAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgfSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVJLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLGtCQUFrQjtBQUd6QixJQUFPLHNCQUFRLGFBQWE7QUFBQTtBQUFBO0FBQUEsRUFHMUIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQTtBQUFBLEVBR0EsTUFBTTtBQUFBLEVBRU4sU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBO0FBQUEsRUFHakIsS0FBSztBQUFBLElBQ0gsU0FBUztBQUFBLE1BQ1AsU0FBUztBQUFBLFFBQ1AsWUFBWTtBQUFBO0FBQUEsUUFDWixhQUFhO0FBQUE7QUFBQSxNQUNmO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQTtBQUFBO0FBQUEsRUFJQSxPQUFPO0FBQUE7QUFBQSxJQUVMLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxFQUNmO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
