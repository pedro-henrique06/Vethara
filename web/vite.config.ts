import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, /api vai para a API local. Em produção quem roteia
    // é o Caddy, e front e API ficam na mesma origem — sem CORS em lugar nenhum.
    proxy: { '/api': 'http://localhost:8080' }
  }
})
