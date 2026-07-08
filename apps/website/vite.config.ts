import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, "../.."), "");
  process.env.DATABASE_URL ??= env.DATABASE_URL;
  process.env.INDEXER_DATABASE_URL ??= env.INDEXER_DATABASE_URL;

  return {
    plugins: [
      tanstackStart(),
      // Skip under Vitest: nitro() leaves a resource open that Vite never
      // closes, hanging `vitest run` for ~10s per invocation. Vitest sets
      // this env var itself; the plugin is only needed for `vite build`.
      ...(process.env.VITEST ? [] : [nitro()]),
      react(),
      tailwindcss(),
    ],
    server: { port: 3000 },
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
  };
});
