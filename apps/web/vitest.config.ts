import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "__tests__/**/*.test.ts"],
    environment: "node",
  },
});
