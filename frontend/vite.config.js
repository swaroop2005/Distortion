import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/admin': 'http://localhost:8001',
      '/donors': 'http://localhost:8001',
      '/patients': 'http://localhost:8001',
      '/agent': 'http://localhost:8001',
      '/supply': 'http://localhost:8001',
      '/chat': 'http://localhost:8001',
      '/community': 'http://localhost:8001',
    }
  }
})
