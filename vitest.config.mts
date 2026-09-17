import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Every suite here covers framework-free logic, so the fast node
    // environment is enough; none of it touches the DOM.
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
