import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'หน้าร้าน POS',
        short_name: 'POS',
        lang: 'th',
        display: 'standalone',
        start_url: '/',
        background_color: '#F1F4F0',
        theme_color: '#0E7A4F',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // แอปเปิดได้แม้ไม่มีเน็ต; ข้อมูลมาจาก IndexedDB ไม่ใช่ HTTP cache
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 20 } } },
        ],
      },
    }),
  ],
  server: { host: true, proxy: { '/api': 'http://localhost:3001' } },
});
