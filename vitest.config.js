import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Look for test files in spec/ directories across all projects
    include: ["**/spec/**/*.test.js", "**/*.test.js"],
  },
});
