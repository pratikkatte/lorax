import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Don't use @vitejs/plugin-react in tests - use esbuild's JSX transform instead
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', 'dist/'],
    },
  },
});

