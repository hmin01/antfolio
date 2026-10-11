import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '개미굴',
        short_name: '개미굴',
        description: '잠들지 않는 모의 주식 시장',
        lang: 'ko',
        display: 'standalone',
        theme_color: '#09090b',
        background_color: '#09090b',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: { port: 5180, strictPort: true },
});
