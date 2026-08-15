import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/core/config/environment.ts',
        'src/core/errors/app-error.ts',
        'src/core/localization/translator.ts',
        'src/core/security/*.ts',
        'src/application/services/rate-limiter.ts',
        'src/infrastructure/cache/ttl-cache.ts',
        'src/infrastructure/http/safe-http-client.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
