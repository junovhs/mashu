import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    base: process.env.VITE_BASE_URL ?? '/',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        open: true,
    },
});
