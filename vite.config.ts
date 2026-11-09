import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

function appBase(): string {
  const raw = process.env.VITE_BASE_PATH?.trim() || './';
  if (raw === '.' || raw === './') return './';
  const rooted = raw.startsWith('/') ? raw : `/${raw}`;
  return rooted.endsWith('/') ? rooted : `${rooted}/`;
}

const base = appBase();

const csp = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'သွေးမှတ်တမ်း',
        short_name: 'သွေးမှတ်',
        description: 'ဖုန်းထဲတွင်သာ သိမ်းသော သွေးဂလူးကို့စ်နှင့် သွေးပေါင်ချိန် မှတ်တမ်း',
        lang: 'my',
        dir: 'ltr',
        display: 'standalone',
        background_color: '#F3F5F9',
        theme_color: '#3B5BF5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,wasm,gz,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: base === './' ? 'index.html' : `${base}index.html`,
      },
    }),
    {
      name: 'prod-csp',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
      },
    },
  ],
  server: { host: '0.0.0.0', port: 47231, strictPort: true },
  preview: { host: '0.0.0.0', port: 47231, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 180000,
    hookTimeout: 180000,
  },
});
