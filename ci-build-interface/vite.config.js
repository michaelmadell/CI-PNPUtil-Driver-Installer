import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    origin: 'http://10.50.0.107:5173',
    hmr: {
      host: '10.50.0.107',
      port: 5173,
      protocol: 'ws',
    }
  }
})
