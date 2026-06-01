import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Testes rodam em Node (as funções testadas são puras — sem DOM).
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    reporters: 'default'
  }
});
