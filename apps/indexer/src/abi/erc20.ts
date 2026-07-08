import { address, uint256 } from "@subsquid/evm-codec";

import { event, indexed } from "./abi.support";

export const events = {
  /** Transfer(address indexed from, address indexed to, uint256 value) */
  Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", {
    from: indexed(address),
    to: indexed(address),
    value: uint256,
  }),
};
