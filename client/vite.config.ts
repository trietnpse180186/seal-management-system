import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'xlsx-js-style': 'xlsx-js-style/dist/xlsx.bundle.js',
    },
  },
})
