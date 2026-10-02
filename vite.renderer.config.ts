import { fileURLToPath } from 'node:url';
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
    // Runs once per HTML entry, so both pages get the policy.
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
    rollupOptions: {
      // Two pages in one renderer bundle: the app window and the floating overlay. The
      // overlay is loaded by the main process as `overlay.html` under the app origin.
      input: {
        index: fileURLToPath(new URL('index.html', import.meta.url)),
        overlay: fileURLToPath(new URL('overlay.html', import.meta.url)),
      },
    },
  },
});

