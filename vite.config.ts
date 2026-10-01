import { defineConfig } from 'vite'

export default defineConfig({
  base: '/prompt-trapdoor/',
  root: '.',
  server: { port: 5173, host: true },
})
