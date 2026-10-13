import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.CAPACITOR_BUILD === 'true' ? './' : process.env.GITHUB_ACTIONS === 'true' ? '/NyayaAI/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['nyayaai-logo.png', 'nyayaai.svg'],
      manifest: {
        name: 'NyayaAI — Indian Law Assistant',
        short_name: 'NyayaAI',
        description: 'Free Indian legal research with an offline-first design.',
        theme_color: '#102a43',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        icons: [
          { src: 'nyayaai-logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'nyayaai-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webp,ico}']
      }
    })
  ]
});