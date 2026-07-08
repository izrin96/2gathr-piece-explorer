import {
  type BlockHeader,
  type DataHandlerContext,
  EvmBatchProcessor,
  type EvmBatchProcessorFields,
  type Log as _Log,
  type Transaction as _Transaction,
} from "@subsquid/evm-processor";

import * as ERC721 from "./abi/erc721";
import { env } from "./env";

// Shared ERC Transfer topic0 (ERC-20 and ERC-721 both emit it).
const TRANSFER_TOPIC = ERC721.events.Transfer.topic;

const processor = new EvmBatchProcessor()
  // RPC-only: Titan L1 has no Subsquid archive/gateway.
  .setRpcEndpoint({
    url: env.INDEXER_RPC_ENDPOINT,
    rateLimit: env.INDEXER_RPC_RATE_LIMIT,
  })
  // NOTE: the installed @subsquid/evm-processor (1.30.1) `RpcDataIngestionSettings`
  // has no `strideSize` option (checked node_modules/.pnpm/@subsquid+evm-processor@1.30.1/
  // .../lib/processor.d.ts) — there is no "stride" concept in this version at all, so
  // `.setRpcDataIngestionSettings({ strideSize: ... })` was dropped. `INDEXER_GETLOGS_RANGE`
  // is kept in env.ts for when/if this lands, but is otherwise unused here. The processor's
  // default eth_getLogs window is already under Titan's 2048-block cap, so this is an
  // efficiency knob, not a correctness one.
  .setFinalityConfirmation(env.INDEXER_RPC_FINALITY)
  .setBlockRange({ from: env.INDEXER_START_BLOCK })
  .setFields({
    log: {
      address: true,
      topics: true,
      data: true,
      transactionHash: true,
      logIndex: true,
    },
  })
  // Wildcard: every Transfer log on the chain, regardless of contract address.
  .addLog({ topic0: [TRANSFER_TOPIC] });

export { processor };
export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
