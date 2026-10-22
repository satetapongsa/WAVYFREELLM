import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose to LAN (0.0.0.0) so phone can access via Wi-Fi
    port: 5174,
  }
})
