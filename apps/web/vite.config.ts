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
                name: 'Antfolio',
                short_name: 'Antfolio',
                description: '잠들지 않는 모의 주식 시장',
                lang: 'ko',
                display: 'standalone',
                theme_color: '#f2f4f6',
                background_color: '#f2f4f6',
                icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            },
        }),
    ],
    server: { port: 5180, strictPort: true },
});
