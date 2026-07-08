import type { BlockData } from "@subsquid/evm-processor";

import * as ERC20 from "./abi/erc20";
import * as ERC721 from "./abi/erc721";
import type { Fields, Log } from "./processor";

const TRANSFER_TOPIC = ERC721.events.Transfer.topic;

export type PieceTransferEvent = {
  contract: string;
  tokenId: string;
  from: string;
  to: string;
  timestamp: number;
  blockNumber: number;
  logIndex: number;
  hash: string;
};

export type RubyTransferEvent = {
  from: string;
  to: string;
  value: bigint;
  timestamp: number;
  blockNumber: number;
  logIndex: number;
  hash: string;
};

/**
 * Classify a Transfer log by topic arity: ERC-721 indexes tokenId (4 topics),
 * ERC-20 carries value in data (3 topics). Only the known Ruby ERC-20 is kept;
 * all other ERC-20s are ignored.
 */
export function classifyTransferLog(
  log: Pick<Log, "topics" | "address">,
  rubyAddress: string,
): "erc721" | "ruby" | "ignore" {
  if (log.topics[0] !== TRANSFER_TOPIC) {
    return "ignore";
  }
  if (log.topics.length === 4) {
    return "erc721";
  }
  if (log.topics.length === 3 && log.address.toLowerCase() === rubyAddress.toLowerCase()) {
    return "ruby";
  }
  return "ignore";
}

export function parsePieceTransfer(log: Log): PieceTransferEvent | undefined {
  try {
    const { from, to, tokenId } = ERC721.events.Transfer.decode(log);
    return {
      contract: log.address.toLowerCase(),
      tokenId: tokenId.toString(),
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      timestamp: log.block.timestamp,
      blockNumber: log.block.height,
      logIndex: log.logIndex,
      hash: log.transactionHash,
    };
  } catch {
    return undefined;
  }
}

export function parseRubyTransfer(log: Log): RubyTransferEvent | undefined {
  try {
    const { from, to, value } = ERC20.events.Transfer.decode(log);
    return {
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      value,
      timestamp: log.block.timestamp,
      blockNumber: log.block.height,
      logIndex: log.logIndex,
      hash: log.transactionHash,
    };
  } catch {
    return undefined;
  }
}

/**
 * Walk every log in the batch (block + log order preserved) and split into
 * classified Piece / Ruby transfer events.
 */
export function parseBlocks(blocks: BlockData<Fields>[], rubyAddress: string) {
  const pieceTransfers: PieceTransferEvent[] = [];
  const rubyTransfers: RubyTransferEvent[] = [];

  for (const block of blocks) {
    for (const log of block.logs) {
      switch (classifyTransferLog(log, rubyAddress)) {
        case "erc721": {
          const e = parsePieceTransfer(log);
          if (e) {
            pieceTransfers.push(e);
          }
          break;
        }
        case "ruby": {
          const e = parseRubyTransfer(log);
          if (e) {
            rubyTransfers.push(e);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return { pieceTransfers, rubyTransfers };
}
