export type PieceClass = "S" | "A" | "B";

// One Piece design (one ERC-721 contract), joined from the indexer DB
// (piece_collection) and the app DB (piece_design_meta). Collections with no
// meta row (early test contracts) are excluded before this type is built —
// remaining nullable fields reflect metas whose values are genuinely absent
// (e.g. empty member, no release date).
export interface Design {
  contractAddress: string; // normalized lowercase 0x…
  name: string; // "Bome #005", or "<edition> · <symbol>" when member is empty
  member: string | null;
  designNumber: number | null;
  pieceClass: PieceClass | null;
  edition: string; // "2025 Season 1" … (meta edition, else indexer edition)
  series: string | null;
  type: string | null;
  totalSupply: number;
  firstSeenBlock: number;
  releaseDatetime: string | null; // ISO
  price: number | null; // Ruby units, not wei; 0 means free
  imageUrl: string | null; // original image — never the thumbnail
  animationUrl: string | null; // mp4 when present
  isHidden: boolean;
}

export interface SerialRow {
  serial: number;
  owner: string;
  mintedAt: string; // ISO
}

// A design an address currently owns, with its serials (piece_token.owner is
// the current owner, maintained by the indexer).
export interface OwnedDesign {
  design: Design;
  count: number;
  serials: number[]; // asc
}

// Shared base for a holder's activity feed rows.
interface HolderActivityBase {
  id: string; // `${kind}:${transfer.id}`, unique React key
  direction: "in" | "out"; // "in" when to === address (self-transfer counts as in)
  counterparty: string | null; // lowercase; null for mint/burn (zero address)
  timestamp: string; // ISO
  hash: string;
}

export type HolderActivityItem =
  | (HolderActivityBase & {
      kind: "piece";
      contractAddress: string;
      designName: string;
      serial: number;
      priceWei: string | null; // Ruby paid in the same tx (e.g. gacha mint cost), else null
    })
  | (HolderActivityBase & { kind: "ruby"; amountWei: string });

export interface HolderSummary {
  address: string; // normalized lowercase
  rubyBalanceWei: string; // "0" when no rollup row
  totalOwned: number;
  ownedDesigns: OwnedDesign[];
}

export interface HolderActivityPage {
  items: HolderActivityItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
