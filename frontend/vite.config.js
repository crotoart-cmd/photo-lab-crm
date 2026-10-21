import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { renderPublicSeo } = require('../backend/lib/publicSeoMetadata');

export default defineConfig({
  plugins: [react(), {
    name: 'public-seo-html',
    transformIndexHtml: (html) => renderPublicSeo(html, { hostname: 'hdtlabx.com' }),
  }],
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
