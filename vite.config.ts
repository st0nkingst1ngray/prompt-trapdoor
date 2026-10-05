import { defineConfig } from 'vitest/config'

/** Pages deploy keeps `/prompt-trapdoor/`. Capacitor sets CAPACITOR=1 for a relative base. */
const capacitor = process.env.CAPACITOR === '1'

export default defineConfig({
  base: capacitor ? './' : '/prompt-trapdoor/',
  root: '.',
  server: { port: 5173, host: true },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
})
