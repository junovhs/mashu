import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    // Relative asset paths let the same build work on the default Pages URL
    // and a future custom domain without a repo-specific base override.
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        open: true,
    },
});
