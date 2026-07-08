import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { citext } from "./custom-type.js";

// Worker-enriched Piece design metadata (from the TopPort catalog), keyed by contract address.
export const pieceDesignMeta = pgTable(
  "piece_design_meta",
  {
    contractAddress: citext("contract_address", { length: 42 }).primaryKey(),
    member: text("member"),
    designNumber: integer("design_number"),
    edition: text("edition").notNull(),
    rarity: integer("rarity"),
    classLetter: text("class"),
    imageUrl: text("image_url"),
    thumbnailUrl: text("thumbnail_url"),
    animationUrl: text("animation_url"),
    mediaType: text("media_type"),
    isHidden: boolean("is_hidden"),
    artist: text("artist"),
    series: text("series"),
    type: text("type"),
    serial: integer("serial"),
    topportId: integer("topport_id"),
    releaseDatetime: timestamp("release_datetime", { mode: "string", withTimezone: true }),
    price: integer("price"),
    rawMetadata: jsonb("raw_metadata"),
    fetchedAt: timestamp("fetched_at", { mode: "string", withTimezone: true }),
  },
  (t) => [
    index("piece_design_meta_member_idx").on(t.member),
    index("piece_design_meta_series_idx").on(t.series),
    index("piece_design_meta_type_idx").on(t.type),
  ],
);

// Cached address -> 2gathr nickname + profile prefs.
export const addressProfile = pgTable("address_profile", {
  address: citext("address", { length: 42 }).primaryKey(),
  nickname: text("nickname"),
  avatarUrl: text("avatar_url"),
  hiddenFromLeaderboard: text("hidden_from_leaderboard"),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }),
});

// Generic rollup cache (holder counts, class distribution, etc.), keyed by a string key.
export const rollupStat = pgTable(
  "rollup_stat",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.scope, t.key] })],
);
