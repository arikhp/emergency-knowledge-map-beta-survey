import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base matches the GitHub Pages project-site path (repo name); harmless for local dev.
export default defineConfig({
  base: '/emergency-knowledge-map-beta-survey/',
  plugins: [react()],
})
