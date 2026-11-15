import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  optimizeDeps: { include: ['manifold-3d','three/examples/jsm/loaders/STLLoader.js','three/examples/jsm/loaders/OBJLoader.js'] }
});
