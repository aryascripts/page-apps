import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Look for test files in spec/ directory
    include: ["spec/**/*.test.js"],
  },
});
