import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'NyayaAI — Indian Law Assistant',
        short_name: 'NyayaAI',
        description: 'Free Indian legal research with an offline-first design.',
        theme_color: '#102a43',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: []
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}']
      }
    })
  ]
});