# 2GATHR / TopPort API — HTTP Inspection Findings

**Date:** 2026-07-04
**Method:** mitmproxy capture of the 2GATHR iOS app (~3,000 flows), streamed through a
`mitmdump` addon. Personal data (the captured wallet address, bearer/access tokens, OAuth
codes, per-user progress) is redacted below; structural shapes are preserved.

> **Headline:** TopPort exposes a **public, unauthenticated** catalog that maps every Piece
> collection to its **on-chain contract address**, **class**, edition, member/number, images,
> and supply. This is a cleaner metadata + contract-discovery source than IPFS-per-contract.
> The 2GATHR app API (`api.iand-dev.com`) is **bearer-authenticated and user-scoped**; there is
> **no public address→nickname lookup**.

## Hosts & auth

| Host                                      | Role                                          | Auth                     | Notes                                                |
| ----------------------------------------- | --------------------------------------------- | ------------------------ | ---------------------------------------------------- |
| `api.topport.io`                          | **NFT/collection catalog** (TopPort platform) | **None (public)**        | The key source. Filter by `chainId=84358`.           |
| `topport.s3.ap-northeast-2.amazonaws.com` | Media/thumbnails                              | None (public)            | `alt_url` thumbnails, mp4 animations.                |
| `gateway.pinata.cloud/ipfs/…`             | Canonical NFT metadata + images               | None (public)            | `tokenURI` / `imageLink` / `metaLink`.               |
| `api.iand-dev.com`                        | **2GATHR app backend**                        | **Bearer** (user-scoped) | Piece Books, members, shop balances, missions, auth. |
| `api.waas.myabcwallet.com`                | ABC Wallet WaaS (custodial wallets)           | Bearer                   | `walletscan/nfts` lists a wallet's NFTs.             |
| `auth.privy.io`                           | Privy embedded-wallet infra                   | —                        | Present but secondary to ABC WaaS.                   |
| `imagedelivery.net`                       | Cloudflare Images                             | None                     | Member/artist avatars, banners, post images.         |

**Auth flow:** `GET /v2/auth/google` → returns a Google OAuth `authUrl`
(client_id `676217792592-…apps.googleusercontent.com`, scope `profile email`, redirect
`https://api.iand-dev.com/v2/auth/google/callback`). `POST /v2/auth/abc/token` → `{ accessToken }`
(the ABC WaaS custodial-wallet → app token). `POST /v2/auth/refresh` rotates it. All `/v1/*`
app endpoints require `Authorization: Bearer …`.

**Implication:** we cannot read arbitrary users' app data. But we don't need to — we index
ownership on-chain ourselves, and the public TopPort catalog + IPFS cover design metadata.

## TopPort public catalog (primary enrichment source)

### `GET https://api.topport.io/api/service/mysterybox` (public)

Query: `?isCollection=true&page=1&limit=300&chainId=84358&sortBy=createdAt:ASC`
Returns `{ status, data: { list: [ … ] } }`. Each list item (one per Piece **collection/design**):

```jsonc
{
  "id": 96, // TopPort numeric collection id
  "title": { "ko": "", "en": "Welcome" }, // edition label (matches on-chain name())
  "introduction": { "en": "2GATHR - Welcome Piece" },
  "price": 0,
  "quote": "ruby",
  "fiatPrice": null,
  "symbol": "2GATHR",
  "rarityLevel": 3, // CLASS (integer) — matches IPFS `rarity`
  "packageImage": "https://topport.s3…/package/…welcome_piece_thumbnail.mp4",
  "imageLink": "https://gateway.pinata.cloud/ipfs/bafybei…", // media (IPFS)
  "metaLink": "https://gateway.pinata.cloud/ipfs/Qm…", // metadata JSON (IPFS)
  "releaseDatetime": "2025-10-20T07:15:48.435Z",
}
```

### `GET https://api.topport.io/api/service/mysterybox/{id}` (public)

Collection detail. **This is the collection→contract map.** Key fields:

```jsonc
{
  "id": 258,
  "title": { "en": "2026 Season 3" }, // edition
  "rarityLevel": 3, // class
  "quote": "ruby",
  "price": 20,
  "boxContractAddress": "0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884", // ON-CHAIN ERC-721
  "keyContractAddress": null,
  "chainId": 84358,
  "totalAmount": 10000,
  "usedAmount": 0, // supply cap / minted-so-far
  "isSoldOut": false,
  "dropsOpen": true,
  "releaseDatetime": "2026-06-30T14:00:00.000Z",
  "creatorAddress": "0xcd70A782C64e65b748b74e8dc40305068Aa0EA39", // 2GATHR platform
  "paymentAddress": "0xcd70A782C64e65b748b74e8dc40305068Aa0EA39",
  "mysteryboxItems": [
    // the design(s) in this box (itemAmount=1)
    {
      "no": 1,
      "name": "BOME #022", // MEMBER #designNumber
      "originalImage": "https://topport.s3…/item/…BOME %23022.png",
      "itemImage": "https://topport.s3…/item/thumbnail/…BOME %23022.jpeg",
      "imageLink": "https://gateway.pinata.cloud/ipfs/bafybei…",
      "metaLink": "https://gateway.pinata.cloud/ipfs/Qm…",
    },
  ],
}
```

**Confirmed cross-check:** mysterybox 258 → `boxContractAddress 0x2E0D…7884` and item
`metaLink Qm…3457…`, which exactly matches the on-chain `name()="2026 Season 3"` and
`tokenURI` observed during design probing. So **TopPort id ↔ boxContractAddress ↔ on-chain
contract ↔ one Piece design** is a reliable join.

**What this gives us publicly, keyed by contract address, for all ~150+ collections:**
edition, class (`rarityLevel`), member + design number (item `name`), IPFS metadata/media,
S3 thumbnails, supply cap (`totalAmount`), minted count (`usedAmount`), release date, price.

## Piece Books (`api.iand-dev.com`, bearer-authed; definitions are global)

- `GET /v1/piece-book?lang=en` → `{ items: [ { id (cuid), artistId, title:"NAHYUN Piece Book #001",
rewardType:"HIDDEN_PIECE", totalSlots:9, coverImageUrl, startAt, … + per-user progress } ] }`
- `GET /v1/piece-book/banners` → banner list (id, imageUrl, bannerTitle/Subtitle, rewardType).
- `GET /v1/piece-book/{id}?lang=en` → detail with **`slots[]`** — the required Pieces:

```jsonc
{
  "id": "cmqou7d5l12my5m01gv0k20f6",
  "title": "NAHYUN Piece Book #001",
  "rewardType": "HIDDEN_PIECE",
  "totalSlots": 9,
  "slots": [
    {
      "collectionId": "179", // TopPort id
      "contractAddress": "0x39995A127b916a2df2C538CEA5977F4B75193851", // required Piece
      "title": "NAHYUN #012",
      "imageUrl": "https://topport.s3…/package/…NAHYUN 012.png",
      "displayOrder": 1,
      "isCollected": false,
      "rewardOnly": false, // isCollected = per-user
    },
    // … 9 slots
  ],
}
```

**We can compute Piece-Book progress ourselves** from on-chain ownership + the slot
`contractAddress` list. Only the book _definitions_ need the app API (or a captured snapshot);
the per-user `isCollected`/`collectedSlots` fields we recompute. Books observed: MICHI, ARIN,
KATELYN, BOME, SEOHYUN, NAHYUN — each `#001`, 9 slots, HIDDEN_PIECE reward. (Note the banner
spells "SEOHYUN" vs the member "SEOHYEON" — watch casing.)

## Members / artists (`api.iand-dev.com`, bearer-authed; global)

`GET /v1/users/artists` → 7 members (+ the "AtHeart" OFFICIAL group), stable roster:

| displayOrder | name     | id (cuid)                 |
| ------------ | -------- | ------------------------- |
| 1            | MICHI    | cmgokq05r002j3y01vgmys20q |
| 2            | ARIN     | cmgoktrw9002m3y01ivz1gimy |
| 3            | KATELYN  | cmgokuy27002p3y013aiukzla |
| 4            | BOME     | cmgol4crt002s3y01dfhq6m0a |
| 5            | SEOHYEON | cmgol51eo002v3y0166s9nbgz |
| 6            | AURORA   | cmgol5pno002y3y01wrsgzwnk |
| 7            | NAHYUN   | cmgol6f8s00313y011r15pg8f |

Each has `imageUrl` on `imagedelivery.net`. Group `AtHeart` = `fbbb29fb-b470-4af6-9ea4-86630d6740e7`.
`GET /v1/artist-groups` returns the group. Member names in Piece metadata use title-case
("Arin", "Bome"); this roster is uppercase — normalize when joining.

## Wallet NFT scan (`api.waas.myabcwallet.com`, bearer-authed)

`GET /wapi/v2/walletscan/nfts?walletAddress=<addr>&networks=avax_titan&minimalInfo=false`
→ array of the wallet's NFTs. Confirms our on-chain model:

```jsonc
{
  "name": "ARIN #002",
  "symbol": "AtHeart",
  "type": "ERC-721",
  "platform": "Titan L1",
  "collectionName": "2025 Season 1", // edition
  "contractAddress": "0x0FBAD81112eAC229aC41Cf309A6CBf123acBa99A",
  "network": "avax_titan",
  "balance": 1.0,
  "last_transfer_at": "2026-01-31T17:02:59+00:00",
  "tokenId": "<redacted>",
  "tokenUri": "<redacted>",
  "image": "https://gateway.pinata.cloud/ipfs/bafybei…",
  "animationUrl": "https://topport.s3…/item/…ARIN %23002.mp4",
  "meta": {
    "data": {
      /* full IPFS metadata incl. "rarity": 2, attributes[] */
    },
  },
}
```

Takes an arbitrary `walletAddress` param but is bearer-authed (this run scanned the
authenticated user's own custodial wallet). **We do not depend on this** — our indexer is the
source of truth for ownership. It's useful only as a cross-check.

## Off-chain economy (confirms spec: Heart/Ruby/Piece-Point are NOT on-chain-only balances)

`GET /v1/shop/balance` (Heart/Ruby), `GET /v1/piece-point/{artistGroupId}/balance`,
`GET /v1/missions/checks/month` + `POST /v1/missions/checks` (daily check-in),
`GET /v1/rewards/history`. All bearer-authed, user-scoped. Ruby also has an on-chain ERC-20
(`0x16ac9…`), so Ruby is dual-surface; Heart & Piece-Point appear app-only.

## Class mapping (resolved 2026-07-05)

The per-design class is the **item's `rarity`** — `mysteryboxItems[].rarity` (== the IPFS metadata
`rarity`), an integer that varies 1/2/3. **Do NOT use the box-level `rarityLevel`** — across all
150 Titan designs it is a **uniform 3** and is not the class (a real bug avoided: reading
`box.rarityLevel` made every design class 3).

**Confirmed int → in-app class letter** (verified against the app): **1 = B, 2 = A, 3 = S**.
Distribution across the live catalog: `1/B` = 129 standard image designs; `2/A` = 13 (the animated
Season-1 pieces — 12 of 13 have video); `3/S` = 8 (all Welcome/Puppy specials, all video/3D). Implemented
as `classLetter()` in `@repo/lib` and stored in `piece_design_meta.class`.

## What this changes for the build (feeds Plan 2 / Indexer + Worker)

1. **Contract discovery + design metadata come from the TopPort public catalog**, keyed by
   `boxContractAddress`, filtered by `chainId=84358`. The worker can page
   `/api/service/mysterybox?isCollection=true&chainId=84358&limit=300` and fetch
   `/mysterybox/{id}` for `boxContractAddress` + `rarityLevel` + supply. This is cheaper and
   richer than wildcard-discovering contracts and fetching IPFS per contract.
   - Keep the **on-chain wildcard `Transfer` indexer** as the source of truth for
     ownership/serials/transfers and as a safety net for any contract missing from the catalog.
   - Keep **IPFS `tokenURI`** as the canonical metadata fallback.
2. **Class** is available as an int (`rarityLevel`) directly from the public catalog — no need
   to derive it only from IPFS. Letter mapping still TBD.
3. **Piece Books** are buildable (Phase 3): definitions via `/v1/piece-book/{id}` slots
   (contract lists); progress computed from on-chain ownership. Needs a bearer token to fetch
   definitions (or a periodically-refreshed captured snapshot).
4. **Nicknames are not publicly resolvable** → the explorer shows addresses (as the spec's MVP
   already assumed). Revisit only if a public source appears.
5. **Members**: hardcode/seed the 7-member roster (stable) with canonical names + display order
   - `imagedelivery.net` avatars from `/v1/users/artists`.

## On-chain ↔ TopPort catalog reconciliation (verified 2026-07-05)

After the Plan 2 indexer completed a full Titan backfill (25,563 blocks), we diffed our on-chain
`piece_collection` (bucketed by contract `name()`) against the public TopPort catalog (bucketed by
`title`, `chainId=84358`). **Every edition matches exactly except `2025 Season 1`:**

| Edition       | On-chain designs | TopPort designs |
| ------------- | ---------------- | --------------- |
| 2025 Season 1 | **58**           | **54**          |
| Welcome       | 8                | 8               |
| 2026 Season 1 | 12               | 12              |
| 2026 Season 2 | 60               | 60              |
| 2026 HBD      | 3                | 3               |
| Hidden Piece  | 6                | 6               |
| 2026 Season 3 | 7                | 7               |

The 4-design gap is fully explained: 4 on-chain contracts carry `name()="2025 Season 1"` but are
**absent from the TopPort catalog entirely**. They are the 4 **earliest** contracts on the chain
(`0x76e79fbf…`, `0x98c126c3…`, `0xb937d442…`, `0xa105cf3d…`, blocks 105–156, _before_ the real
Season 1 designs start at block 249), each **minted exactly once to the same deployer wallet**
`0x51169afd1cd5765a57514ecad0e71513cd394bfd` on **2025-10-13** within ~3 hours — i.e. **pre-launch
test deploys** of the ERC-721 template (default `name`/`symbol="AtHeart"`). Real designs are minted
to hundreds of distinct public buyers.

**Rule (drives Plan 3 worker + website):** _catalog membership_ (`boxContractAddress` present for
`chainId=84358`) is the app's source of truth for a **real, listed design**. The worker enriches
(writes `piece_design_meta` for) only cataloged contracts and **skips catalog-absent test/unlisted
deploys**; the explorer lists designs from `piece_design_meta`, so its counts match the 2GATHR app.
To reconcile any edition later: `on-chain piece_collection WHERE edition=X` vs `TopPort boxes WHERE
title=X` — the on-chain-only remainder is unlisted/test contracts.

## Gaps / still unknown

- Exact `rarityLevel` int → letter (A/B/…) mapping.
- Whether `/api/service/mysterybox` pagination exposes a total count (used `limit=300`; ~150+
  collections exist, so one page likely covers all today).
- Whether TopPort has a public per-token (serial/owner) endpoint (owner "Shah189" seen in-app
  came from an authed context; no public owner-by-token endpoint observed).
- ABC WaaS `walletscan` behavior for a _non-owned_ address under a valid token (not tested; not
  needed).
