import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = fileURLToPath(new URL(".", import.meta.url));

// Source page: src/index.html. `npm run build` writes ONE self-contained file to the project
// root (./index.html). Double-click it to read; it also works as a claude.ai artifact.
export default defineConfig({
  root: "src",
  publicDir: false,
  plugins: [viteSingleFile()],
  build: { target: "es2020", outDir: "..", emptyOutDir: false },
  test: { root: here, environment: "node", include: ["tests/**/*.test.ts"] },
});
