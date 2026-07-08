import { TypeormDatabase, type Store } from "@subsquid/typeorm-store";

import * as ERC721 from "./abi/erc721";
import { env } from "./env";
import { PieceCollection, PieceToken, PieceTransfer, RubyTransfer } from "./model";
import { parseBlocks, type PieceTransferEvent } from "./parser";
import { processor, type Block, type ProcessorContext } from "./processor";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const database = new TypeormDatabase({ supportHotBlocks: true });

processor.run(database, async (ctx) => {
  const { pieceTransfers, rubyTransfers } = parseBlocks(ctx.blocks, env.INDEXER_RUBY_ADDRESS);

  // ---- Ruby (ERC-20) transfers: append-only ----
  if (rubyTransfers.length > 0) {
    ctx.log.info(`Processing ${rubyTransfers.length} Ruby transfers`);
    await ctx.store.insert(
      rubyTransfers.map(
        (t) =>
          new RubyTransfer({
            id: `${t.blockNumber}-${t.logIndex}`,
            from: t.from,
            to: t.to,
            value: t.value,
            timestamp: new Date(t.timestamp),
            blockNumber: t.blockNumber,
            logIndex: t.logIndex,
            hash: t.hash,
          }),
      ),
    );
  }

  // ---- Piece (ERC-721) transfers: register collections, track tokens, append transfers ----
  if (pieceTransfers.length === 0) {
    return;
  }
  ctx.log.info(`Processing ${pieceTransfers.length} Piece transfers`);

  // Real block headers, needed for on-chain name()/symbol() eth_calls.
  const headerByHeight = new Map<number, Block>(ctx.blocks.map((b) => [b.header.height, b.header]));

  const collectionBuffer = new Map<string, PieceCollection>();
  const tokenBuffer = new Map<string, PieceToken>();
  const transferRows: PieceTransfer[] = [];

  for (const t of pieceTransfers) {
    const collection = await getOrRegisterCollection(ctx, collectionBuffer, headerByHeight, t);

    const tokenKey = `${t.contract}-${t.tokenId}`;
    let token = tokenBuffer.get(tokenKey) ?? (await ctx.store.get(PieceToken, tokenKey));
    const isMint = t.from === ZERO_ADDRESS;
    const isBurn = t.to === ZERO_ADDRESS;

    if (!token) {
      token = new PieceToken({
        id: tokenKey,
        collection,
        contractAddress: t.contract,
        tokenId: t.tokenId,
        serial: BigInt(t.tokenId),
        owner: t.to,
        mintedAt: new Date(t.timestamp),
        lastTransferAt: new Date(t.timestamp),
        lastTransferBlock: t.blockNumber,
      });
      if (isMint) {
        collection.totalSupply += 1;
      }
    } else {
      token.owner = t.to;
      token.lastTransferAt = new Date(t.timestamp);
      token.lastTransferBlock = t.blockNumber;
      token.collection = collection;
    }

    if (isBurn) {
      collection.totalSupply = Math.max(0, collection.totalSupply - 1);
    }

    tokenBuffer.set(tokenKey, token);
    collectionBuffer.set(collection.id, collection);

    transferRows.push(
      new PieceTransfer({
        id: `${t.blockNumber}-${t.logIndex}`,
        collection,
        contractAddress: t.contract,
        tokenId: t.tokenId,
        from: t.from,
        to: t.to,
        timestamp: new Date(t.timestamp),
        blockNumber: t.blockNumber,
        logIndex: t.logIndex,
        hash: t.hash,
      }),
    );
  }

  if (collectionBuffer.size > 0) {
    await ctx.store.upsert([...collectionBuffer.values()]);
  }
  if (tokenBuffer.size > 0) {
    await ctx.store.upsert([...tokenBuffer.values()]);
  }
  if (transferRows.length > 0) {
    await ctx.store.insert(transferRows);
  }
});

/**
 * Return the Piece collection for a transfer, auto-registering it on first
 * sight. Registration reads on-chain name()/symbol() once (deterministic,
 * replayable); failures degrade to empty strings so a flaky read never blocks
 * indexing — the worker can backfill edition/symbol later.
 */
async function getOrRegisterCollection(
  ctx: ProcessorContext<Store>,
  buffer: Map<string, PieceCollection>,
  headerByHeight: Map<number, Block>,
  t: PieceTransferEvent,
): Promise<PieceCollection> {
  const existing = buffer.get(t.contract) ?? (await ctx.store.get(PieceCollection, t.contract));
  if (existing) {
    return existing;
  }

  const header = headerByHeight.get(t.blockNumber);
  let edition = "";
  let symbol = "";
  if (header) {
    const contract = new ERC721.Contract(ctx, header, t.contract);
    try {
      edition = await contract.name();
    } catch {
      ctx.log.warn(`name() failed for ${t.contract}`);
    }
    try {
      symbol = await contract.symbol();
    } catch {
      ctx.log.warn(`symbol() failed for ${t.contract}`);
    }
  }

  const collection = new PieceCollection({
    id: t.contract,
    edition,
    symbol,
    firstSeenBlock: t.blockNumber,
    totalSupply: 0,
  });
  buffer.set(t.contract, collection);
  return collection;
}
