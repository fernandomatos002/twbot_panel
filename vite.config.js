    // vite.config.js

    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'
    import tailwindcss from 'tailwindcss' // Importa o TailwindCSS
    import autoprefixer from 'autoprefixer' // Importa o Autoprefixer

    // https://vitejs.dev/config/
    export default defineConfig({
      // Adiciona a configuração de servidor para garantir que o Electron
      // saiba onde o dev:vite está rodando (porta 5173).
      server: {
        port: 5173,
      },

      // 1. Crucial para o Electron: garante que os caminhos sejam relativos.
      base: './',

      plugins: [react()],

      // === NOVA SEÇÃO: Configuração do PostCSS diretamente no Vite ===
      css: {
        postcss: {
          plugins: [
            tailwindcss(), // Chama o plugin TailwindCSS
            autoprefixer(), // Chama o plugin Autoprefixer
          ],
        },
      },
      // =============================================================

      // 2. Configurações para o build final
      build: {
        // Diretório onde o Vite colocará o build final (frontend)
        outDir: 'dist-renderer',
        emptyOutDir: true,
      },
    })
