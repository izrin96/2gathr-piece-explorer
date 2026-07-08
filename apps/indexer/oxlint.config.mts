import baseConfig from "@repo/lint/oxlint.config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: ["node_modules", ".turbo", "lib", "src/model/generated/**", "db/migrations/**"],
  // The base config disables no-unused-vars repo-wide. This package relaxes
  // noUnusedLocals in tsconfig.json for vendor-generated Subsquid models, which
  // removes TypeScript's unused-var guard package-wide too. Re-enable it here via
  // oxlint for hand-written code — ignorePatterns above already excludes the
  // generated output, so this only enforces on src/env.ts, src/abi/**, and
  // upcoming parser.ts/processor.ts/main.ts.
  rules: {
    "eslint/no-unused-vars": "error",
  },
});
