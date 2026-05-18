import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages: https://magicnlove.github.io/banner-editor/
// 로컬 dev는 base '/' — 루트(http://localhost:5173/)에서 열림
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'serve' ? '/' : '/banner-editor/',
  optimizeDeps: {
    include: ['pdf-lib', '@pdf-lib/fontkit', 'fabric'],
  },
}))
