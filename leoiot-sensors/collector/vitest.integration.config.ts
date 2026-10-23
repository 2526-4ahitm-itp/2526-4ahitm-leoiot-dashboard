import { defineConfig } from 'vitest/config';

// Needs Docker: starts a throwaway Mosquitto and InfluxDB (integration/README in
// the sub-project README). Not part of "npm test" and not run by CI.
export default defineConfig({
  test: {
    include: ['integration/**/*.integration.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 180_000,
    // One stack per file, files one after the other.
    fileParallelism: false,
  },
});
