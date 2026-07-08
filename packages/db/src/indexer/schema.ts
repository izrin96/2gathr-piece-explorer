import {
  pgSchema,
  pgTable,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const squidProcessor = pgSchema("squid_processor");

export const pieceCollection = pgTable(
  "piece_collection",
  {
    id: varchar().primaryKey(),
    edition: text().notNull(),
    symbol: text().notNull(),
    firstSeenBlock: integer("first_seen_block").notNull(),
    totalSupply: integer("total_supply").notNull(),
  },
  (table) => [
    index("idx_piece_collection_first_seen_block_be93318a").using(
      "btree",
      table.firstSeenBlock.asc().nullsLast(),
    ),
  ],
);

export const pieceToken = pgTable(
  "piece_token",
  {
    id: varchar().primaryKey(),
    contractAddress: text("contract_address").notNull(),
    tokenId: text("token_id").notNull(),
    serial: numeric().notNull(),
    owner: text().notNull(),
    mintedAt: timestamp("minted_at", { withTimezone: true }).notNull(),
    lastTransferAt: timestamp("last_transfer_at", { withTimezone: true }).notNull(),
    lastTransferBlock: integer("last_transfer_block").notNull(),
    collectionId: varchar("collection_id").references(() => pieceCollection.id),
  },
  (table) => [
    index("idx_piece_token_collection_4db847cc").using(
      "btree",
      table.collectionId.asc().nullsLast(),
    ),
    index("idx_piece_token_contract_address_336969f5").using(
      "btree",
      table.contractAddress.asc().nullsLast(),
    ),
    index("idx_piece_token_last_transfer_at_2eb0caf6").using(
      "btree",
      table.lastTransferAt.asc().nullsLast(),
    ),
    index("idx_piece_token_owner_253d152c").using("btree", table.owner.asc().nullsLast()),
    index("idx_piece_token_serial_c87b1c3e").using("btree", table.serial.asc().nullsLast()),
  ],
);

export const pieceTransfer = pgTable(
  "piece_transfer",
  {
    id: varchar().primaryKey(),
    contractAddress: text("contract_address").notNull(),
    tokenId: text("token_id").notNull(),
    from: text().notNull(),
    to: text().notNull(),
    timestamp: timestamp({ withTimezone: true }).notNull(),
    blockNumber: integer("block_number").notNull(),
    logIndex: integer("log_index").notNull(),
    hash: text().notNull(),
    collectionId: varchar("collection_id").references(() => pieceCollection.id),
  },
  (table) => [
    index("idx_piece_transfer_block_number_76e63e97").using(
      "btree",
      table.blockNumber.asc().nullsLast(),
    ),
    index("idx_piece_transfer_collection_58e26a18").using(
      "btree",
      table.collectionId.asc().nullsLast(),
    ),
    index("idx_piece_transfer_contract_address_0dcd2e55").using(
      "btree",
      table.contractAddress.asc().nullsLast(),
    ),
    index("idx_piece_transfer_from_176b982e").using("btree", table.from.asc().nullsLast()),
    index("idx_piece_transfer_hash_9ddcfa89").using("btree", table.hash.asc().nullsLast()),
    index("idx_piece_transfer_timestamp_8975d08e").using(
      "btree",
      table.timestamp.asc().nullsLast(),
    ),
    index("idx_piece_transfer_to_dcf3def6").using("btree", table.to.asc().nullsLast()),
    index("idx_piece_transfer_token_id_679f8bc4").using("btree", table.tokenId.asc().nullsLast()),
  ],
);

export const rubyTransfer = pgTable(
  "ruby_transfer",
  {
    id: varchar().primaryKey(),
    from: text().notNull(),
    to: text().notNull(),
    value: numeric().notNull(),
    timestamp: timestamp({ withTimezone: true }).notNull(),
    blockNumber: integer("block_number").notNull(),
    logIndex: integer("log_index").notNull(),
    hash: text().notNull(),
  },
  (table) => [
    index("idx_ruby_transfer_block_number_79876a55").using(
      "btree",
      table.blockNumber.asc().nullsLast(),
    ),
    index("idx_ruby_transfer_from_1c95d546").using("btree", table.from.asc().nullsLast()),
    index("idx_ruby_transfer_hash_62355050").using("btree", table.hash.asc().nullsLast()),
    index("idx_ruby_transfer_timestamp_18d85315").using("btree", table.timestamp.asc().nullsLast()),
    index("idx_ruby_transfer_to_dcb8b618").using("btree", table.to.asc().nullsLast()),
  ],
);
