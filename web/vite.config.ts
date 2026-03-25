import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Akses dari HP/tablet di WiFi yang sama: http://<IP-LAN-laptop>:5173
    host: true,
    proxy: {
      // Satukan origin dengan dev server → tidak perlu VITE_API_URL / CORS untuk tes di jaringan lokal
      '/api': { target: 'http://127.0.0.1:8081', changeOrigin: true },
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8081', changeOrigin: true },
    },
  },
})
