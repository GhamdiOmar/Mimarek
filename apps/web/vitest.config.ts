import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "__tests__/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      // `server-only` is a Next.js boundary marker — no-op in the node test env, so server-only
      // libs (lib/buyer-routing.ts, …) can be unit-tested without the real package.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
});
