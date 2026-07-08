import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/indexer/schema.ts",
  out: "./src/indexer",
  dialect: "postgresql",
  dbCredentials: { url: process.env.INDEXER_DATABASE_URL! },
  tablesFilter: ["piece_collection", "piece_token", "piece_transfer", "ruby_transfer"],
});
