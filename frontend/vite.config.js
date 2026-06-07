import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/admin': 'http://localhost:8000',
      '/donors': 'http://localhost:8000',
      '/patients': 'http://localhost:8000',
      '/agent': 'http://localhost:8000',
      '/supply': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/community': 'http://localhost:8000',
    }
  }
})
