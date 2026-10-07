import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import path from 'path';

export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  server: {
    watch: {
      ignored: ['**/android/**', '**/dist/**']
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,onnx,json,yaml}'],
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024 // 100 MB for ONNX models
      },
      manifest: {
        name: 'Maize Advisor',
        short_name: 'Advisor',
        description: 'Offline-first conversational maize advisory',
        theme_color: '#1a1a2e',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
