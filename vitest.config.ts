import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Use pool: "forks" to avoid ESM module cache issues with vi.stubGlobal
    pool: "forks",
  },
});
