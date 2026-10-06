import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const zlibShim = fileURLToPath(new URL('./src/akcp/bashmissions/node-zlib-shim.ts', import.meta.url))

/** Pages deploy keeps `/prompt-trapdoor/`. Capacitor sets CAPACITOR=1 for a relative base. */
const capacitor = process.env.CAPACITOR === '1'

export default defineConfig({
  base: capacitor ? './' : '/prompt-trapdoor/',
  resolve: {
    alias: {
      'node:zlib': zlibShim,
    },
  },
  root: '.',
  server: { port: 5173, host: true },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
})
