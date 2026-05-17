import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages: 저장소 이름에 맞게 base 경로를 수정하세요.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/editor/',
})
