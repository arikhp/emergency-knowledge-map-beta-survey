import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base matches the GitHub Pages project-site path (repo name); harmless for local dev.
// Vercel serves from the domain root, so use '/' there (VERCEL=1 is set during Vercel builds).
export default defineConfig({
  base: process.env.VERCEL ? '/' : '/emergency-knowledge-map-beta-survey/',
  plugins: [react()],
})
