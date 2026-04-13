import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    globals: true,
    include: ["__tests__/**/*.{test,spec}.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});