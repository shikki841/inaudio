import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { alias } from './vite.shared';
import { buildContentSecurityPolicy } from './src/shared/security/csp';

function contentSecurityPolicy(): Plugin {
  let isDev = false;
  return {
    name: 'inaudio-csp',
    configResolved(config) {
      isDev = config.command === 'serve';
    },
    transformIndexHtml(html) {
      return html.replace('%INAUDIO_CSP%', buildContentSecurityPolicy({ dev: isDev }));
    },
  };
}

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  resolve: { alias },
  build: {
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
