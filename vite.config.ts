import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    root: '.',
    base: process.env.VITE_BASE_URL ?? '/',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                docs: resolve(__dirname, 'docs.html'),
            },
        },
    },
    server: {
        open: true,
    },
});
