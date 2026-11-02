import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        server: {
            port: Number(env.CLIENT_PORT || 5173),
            // the browser only ever talks to the vite origin, so the session cookie stays same-origin (no cors needed)
            proxy: {
                '/api': env.API_PROXY_TARGET || 'http://127.0.0.1:5001',
            },
        },
    };
});
