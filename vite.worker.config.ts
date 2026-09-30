import { defineConfig } from 'vite';
import { alias, nativeExternals } from './vite.shared';

// https://vitejs.dev/config
export default defineConfig({
  resolve: { alias },
  build: {
    rollupOptions: { external: nativeExternals },
  },
});
