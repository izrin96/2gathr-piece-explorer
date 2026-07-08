import { address, string as abiString, uint256 } from "@subsquid/evm-codec";

import { ContractBase, event, func, indexed } from "./abi.support";

export const events = {
  /** Transfer(address indexed from, address indexed to, uint256 indexed tokenId) */
  Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", {
    from: indexed(address),
    to: indexed(address),
    tokenId: indexed(uint256),
  }),
};

export const functions = {
  /** name() -> string */
  name: func("0x06fdde03", {}, abiString),
  /** symbol() -> string */
  symbol: func("0x95d89b41", {}, abiString),
};

export class Contract extends ContractBase {
  name(): Promise<string> {
    return this.eth_call(functions.name, {});
  }

  symbol(): Promise<string> {
    return this.eth_call(functions.symbol, {});
  }
}
