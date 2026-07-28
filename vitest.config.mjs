import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./jsconfig.json"] }), react()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./src/__tests__/utils/serverOnlyStub.js", import.meta.url),
      ),
    },
  },
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    css: true,
  },
});
