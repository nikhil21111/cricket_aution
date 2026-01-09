import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Increase chunk size warning threshold for production builds
    chunkSizeWarningLimit: 1000, // in kBs
  },
})
