import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { addressProfile, pieceDesignMeta } from "./schema.js";

describe("app schema", () => {
  it("names the piece_design_meta table and keys it by contract address", () => {
    const cfg = getTableConfig(pieceDesignMeta);
    expect(cfg.name).toBe("piece_design_meta");
    const pk = cfg.columns.find((c) => c.primary);
    expect(pk?.name).toBe("contract_address");
  });

  it("names the address_profile table", () => {
    const cfg = getTableConfig(addressProfile);
    expect(cfg.name).toBe("address_profile");
  });

  it("has the added TopPort columns on piece_design_meta", () => {
    const cfg = getTableConfig(pieceDesignMeta);
    const names = new Set(cfg.columns.map((c) => c.name));
    for (const col of [
      "artist",
      "series",
      "type",
      "serial",
      "topport_id",
      "release_datetime",
      "price",
    ]) {
      expect(names.has(col)).toBe(true);
    }
  });
});
