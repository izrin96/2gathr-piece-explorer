import type { BlockData } from "@subsquid/evm-processor";
import { describe, expect, it } from "vitest";

import { classifyTransferLog, parseBlocks, parsePieceTransfer, parseRubyTransfer } from "./parser";
import type { Fields, Log } from "./processor";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const OTHER_TOPIC = "0x1111111111111111111111111111111111111111111111111111111111111111";
const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ADDR_TOPIC = "0x00000000000000000000000016ac90358d5f8610a85fa5270659356afdc48a9e";
const TOKEN_258 = "0x0000000000000000000000000000000000000000000000000000000000000102";
const VALUE_1E18 = "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000";
const RUBY = "0x16ac90358d5f8610a85fa5270659356afdc48a9e";
const TOKEN_7 = "0x0000000000000000000000000000000000000000000000000000000000000007";

function log(partial: Partial<Log>): Log {
  return {
    address: "0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884",
    topics: [],
    data: "0x",
    logIndex: 3,
    transactionHash: "0xdeadbeef",
    block: { height: 1000, timestamp: 1_700_000_000_000 },
    ...partial,
  } as unknown as Log;
}

// Test-only stand-in for a Subsquid BlockHeader; only height/timestamp matter here.
function blockAt(height: number, timestamp: number): Log["block"] {
  return { height, timestamp } as unknown as Log["block"];
}

describe("classifyTransferLog", () => {
  it("classifies a 4-topic Transfer as erc721", () => {
    expect(
      classifyTransferLog(
        log({ topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258] }),
        RUBY,
      ),
    ).toBe("erc721");
  });

  it("classifies a 3-topic Transfer from the Ruby address as ruby", () => {
    expect(
      classifyTransferLog(
        log({ address: RUBY, topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC] }),
        RUBY,
      ),
    ).toBe("ruby");
  });

  it("classifies a 3-topic Transfer as ruby even when the rubyAddress param is mixed-case", () => {
    const MIXED_CASE_RUBY = "0x16Ac90358D5f8610a85fA5270659356AFdc48A9e";
    expect(
      classifyTransferLog(
        log({ address: RUBY, topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC] }),
        MIXED_CASE_RUBY,
      ),
    ).toBe("ruby");
  });

  it("ignores a 3-topic Transfer from a non-Ruby ERC-20", () => {
    expect(
      classifyTransferLog(log({ topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC] }), RUBY),
    ).toBe("ignore");
  });

  it("ignores a non-Transfer topic0", () => {
    expect(
      classifyTransferLog(log({ topics: [OTHER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258] }), RUBY),
    ).toBe("ignore");
  });
});

describe("parsePieceTransfer", () => {
  it("parses a mint, lowercasing addresses and stringifying tokenId", () => {
    const e = parsePieceTransfer(
      log({
        address: "0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884",
        topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258],
      }),
    );
    expect(e).toEqual({
      contract: "0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884",
      tokenId: "258",
      from: "0x0000000000000000000000000000000000000000",
      to: "0x16ac90358d5f8610a85fa5270659356afdc48a9e",
      timestamp: 1_700_000_000_000,
      blockNumber: 1000,
      logIndex: 3,
      hash: "0xdeadbeef",
    });
  });

  it("returns undefined instead of throwing for a malformed (3-topic) log", () => {
    const e = parsePieceTransfer(
      log({
        address: "0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884",
        topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC],
      }),
    );
    expect(e).toBeUndefined();
  });
});

describe("parseRubyTransfer", () => {
  it("parses the value from data as a bigint", () => {
    const e = parseRubyTransfer(
      log({ address: RUBY, topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC], data: VALUE_1E18 }),
    );
    expect(e).toEqual({
      from: "0x0000000000000000000000000000000000000000",
      to: "0x16ac90358d5f8610a85fa5270659356afdc48a9e",
      value: 1_000_000_000_000_000_000n,
      timestamp: 1_700_000_000_000,
      blockNumber: 1000,
      logIndex: 3,
      hash: "0xdeadbeef",
    });
  });
});

describe("parseBlocks", () => {
  it("routes logs across a 2-block batch into pieceTransfers/rubyTransfers, dropping the rest, preserving order", () => {
    const pieceLog1 = log({
      address: "0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884",
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258],
      logIndex: 0,
      block: blockAt(1000, 1_700_000_000_000),
    });
    const rubyLog1 = log({
      address: RUBY,
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC],
      data: VALUE_1E18,
      logIndex: 1,
      block: blockAt(1000, 1_700_000_000_000),
    });
    const nonRubyErc20Log = log({
      address: "0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884",
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC],
      logIndex: 0,
      block: blockAt(1001, 1_700_000_100_000),
    });
    const nonTransferLog = log({
      topics: [OTHER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258],
      logIndex: 1,
      block: blockAt(1001, 1_700_000_100_000),
    });
    const pieceLog2 = log({
      address: "0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884",
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_7],
      logIndex: 2,
      block: blockAt(1001, 1_700_000_100_000),
    });

    const blocks = [
      { logs: [pieceLog1, rubyLog1] },
      { logs: [nonRubyErc20Log, nonTransferLog, pieceLog2] },
    ] as unknown as BlockData<Fields>[];

    const { pieceTransfers, rubyTransfers } = parseBlocks(blocks, RUBY);

    expect(pieceTransfers).toHaveLength(2);
    expect(rubyTransfers).toHaveLength(1);

    // Ordering across the two blocks is preserved: block 1's piece transfer
    // (tokenId 258) comes before block 2's (tokenId 7).
    expect(pieceTransfers.map((e) => e.tokenId)).toEqual(["258", "7"]);
    expect(pieceTransfers[0]).toMatchObject({
      contract: "0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884",
      tokenId: "258",
    });
    expect(pieceTransfers[1]).toMatchObject({
      contract: "0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884",
      tokenId: "7",
    });

    expect(rubyTransfers[0]).toMatchObject({
      value: 1_000_000_000_000_000_000n,
    });
  });
});
