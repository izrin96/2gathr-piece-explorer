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
    name: text("name"),
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

// Live session credential for a bearer-authed third-party API (e.g. the 2GATHR app backend),
// refreshed on a schedule by the worker. Single row per `service`. Unlike the rest of this DB
// (derived/cache data), this holds real account credentials — DATABASE_URL access means account
// access too. *ExpiresAt are observability-only (nothing reads them in control flow); they let a
// human check db:studio for remaining runway before a manual re-seed would ever be needed.
export const appCredential = pgTable("app_credential", {
  service: text("service").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessExpiresAt: timestamp("access_expires_at", { mode: "string", withTimezone: true }).notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

// Cached 2GATHR Piece Book definitions (fetched + resolved by the worker's sync-piece-books
// job from the bearer-authed app API — see app_credential above). "known" for that job's
// new-book detection is just "already has a row here", not a hardcoded id list.
export const pieceBook = pgTable("piece_book", {
  id: text("id").primaryKey(), // 2gathr's own cuid
  title: text("title").notNull(),
  rewardType: text("reward_type"),
  totalSlots: integer("total_slots").notNull(),
  startAt: timestamp("start_at", { mode: "string", withTimezone: true }),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

// One row per required slot plus one for the hidden reward slot (isHiddenReward=true,
// displayOrder=null). contractAddress is resolved by the worker at cache-write time (the
// hidden slot's collectionId is a TopPort id, not a contract address — joined against our own
// piece_design_meta.topport_id) so nothing downstream needs to know about TopPort ids.
export const pieceBookSlot = pgTable(
  "piece_book_slot",
  {
    id: text("id").primaryKey(), // 2gathr's slotId / rewardSlotId
    bookId: text("book_id").notNull(),
    contractAddress: citext("contract_address", { length: 42 }).notNull(),
    displayOrder: integer("display_order"),
    isHiddenReward: boolean("is_hidden_reward").notNull(),
  },
  (t) => [index("piece_book_slot_book_id_idx").on(t.bookId)],
);

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
