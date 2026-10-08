import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  plugins: [tailwindcss(), react()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
