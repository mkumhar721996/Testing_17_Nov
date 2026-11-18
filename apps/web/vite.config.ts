/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The design system lives outside apps/web, so it is aliased and allowed to be served.
const designSystem = fileURLToPath(new URL('../../design-system', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@design-system': designSystem } },
  server: { fs: { allow: ['.', designSystem] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
