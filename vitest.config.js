import { defineConfig } from 'vitest/config';

// Component tests: real game modules in a simulated DOM (happy-dom), driven step by step.
// Browser tests live in tests/browser and run with Playwright (npm run test:browser).
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/component/**/*.test.js'],
    setupFiles: ['tests/component/setup.js'],
    restoreMocks: true,
  },
});
