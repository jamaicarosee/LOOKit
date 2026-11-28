import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/features/admin/')) {
            return 'admin-chunk';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: false,
      includeAssets: [
        'favicon.svg',
        'icons.svg',
        'lookit_logo_desktop.png',
        'lookit_logo_mobile.png',
      ],
      workbox: {
        // Mapbox GL bundle & GeoJSON datasets exceed Workbox's default 2MB cap
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,geojson,json}'],
        // Never precache lazy-loaded admin code for guest/student visitors
        globIgnores: ['**/admin-chunk-*.js'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // 1. Strict Network-Only: Auth, Supabase, Admin, Staff Directory, and AI Smart Search
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') ||
              url.pathname.startsWith('/api/auth') ||
              url.pathname.startsWith('/api/users') ||
              url.pathname.startsWith('/api/audit') ||
              url.pathname.startsWith('/api/staff') ||
              url.pathname.startsWith('/api/ai-search'),
            handler: 'NetworkOnly',
          },
          // 2. Public Read-Only Campus Locations
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.pathname.startsWith('/api/navigation/locations'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'lookit-api-read-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 3. Mapbox Styles, Sprites, Glyphs, and Tiles
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lookit-mapbox-cache',
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});