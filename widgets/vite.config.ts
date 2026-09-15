import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const widgetRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: widgetRoot,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // The SPA imports the shared contract from ../src/widgets/contract.ts.
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    // Hosts that render MCP Apps support light-dark(); keep it untranspiled so the
    // host-applied color-scheme on <html> switches the fallback palette.
    cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5"],
  },
});
