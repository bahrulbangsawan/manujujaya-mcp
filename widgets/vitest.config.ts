import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15_000,
  },
});
