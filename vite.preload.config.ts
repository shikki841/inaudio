import { defineConfig } from 'vite';
import { alias } from './vite.shared';

// https://vitejs.dev/config
export default defineConfig({
  resolve: { alias },
});
