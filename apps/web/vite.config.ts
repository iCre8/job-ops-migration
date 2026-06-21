import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.{test,spec}.{js,ts}",
      "tests/**/*.{test,spec}.{js,ts}",
    ],
    exclude: [
      "tests/e2e/**",
      "**/node_modules/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/lib/**"],
      exclude: [
        "src/lib/components/**", // UI components tested via Playwright
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    // Give MongoDB memory server enough time to start
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Run integration tests serially to avoid port conflicts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
