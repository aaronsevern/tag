import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Phaser is linked from ../phaser, outside the project root.
  server: { fs: { allow: ['..'] } },
  optimizeDeps: { include: ['phaser'] },
  build: { chunkSizeWarningLimit: 2000 },
});
