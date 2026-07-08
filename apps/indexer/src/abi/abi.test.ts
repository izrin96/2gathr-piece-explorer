import { describe, expect, it } from "vitest";

import * as ERC20 from "./erc20";
import * as ERC721 from "./erc721";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ADDR_TOPIC = "0x00000000000000000000000016ac90358d5f8610a85fa5270659356afdc48a9e";
const TOKEN_258 = "0x0000000000000000000000000000000000000000000000000000000000000102";
const VALUE_1E18 = "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000";

describe("erc721 Transfer", () => {
  it("exposes the canonical Transfer topic0", () => {
    expect(ERC721.events.Transfer.topic).toBe(TRANSFER_TOPIC);
  });

  it("decodes a 4-topic ERC-721 Transfer (tokenId indexed)", () => {
    const decoded = ERC721.events.Transfer.decode({
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258],
      data: "0x",
    });
    expect(decoded.from.toLowerCase()).toBe("0x0000000000000000000000000000000000000000");
    expect(decoded.to.toLowerCase()).toBe("0x16ac90358d5f8610a85fa5270659356afdc48a9e");
    expect(decoded.tokenId).toBe(258n);
  });
});

describe("erc20 Transfer", () => {
  it("decodes a 3-topic ERC-20 Transfer (value in data)", () => {
    const decoded = ERC20.events.Transfer.decode({
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC],
      data: VALUE_1E18,
    });
    expect(decoded.from.toLowerCase()).toBe("0x0000000000000000000000000000000000000000");
    expect(decoded.to.toLowerCase()).toBe("0x16ac90358d5f8610a85fa5270659356afdc48a9e");
    expect(decoded.value).toBe(1000000000000000000n);
  });
});
