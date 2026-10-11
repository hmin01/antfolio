import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { applyVersionPlugin } from './plugins/applyVersion.ts';

export default defineConfig({
    plugins: [react(), tailwindcss(), applyVersionPlugin()],
    server: { port: 5181, strictPort: true },
});
