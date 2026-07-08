import { classLetter, normalizeMember, parsePieceName } from "@repo/lib";
import { ofetch } from "ofetch";

import { type TopportBox, titleText, topportBoxSchema } from "./types/topport.js";

const TITAN_CHAIN_ID = 84358;

export interface ParsedTopportDesign {
  contractAddress: string | null;
  member: string | null;
  designNumber: number | null;
  rarity: number;
  classLetter: string | null;
  edition: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  animationUrl: string | null;
  mediaType: string;
  isHidden: boolean;
  artist: string | null;
  series: string | null;
  type: string | null;
  serial: number | null;
  topportId: number | null;
  releaseDatetime: string | null;
  price: number | null;
}

function extension(url: string): string {
  const clean = url.split("?")[0] ?? "";
  const match = /\.([a-z0-9]+)$/i.exec(clean);
  return match?.[1]?.toLowerCase() ?? "";
}

export function parseTopportBox(box: TopportBox, fallbackEdition: string): ParsedTopportDesign {
  const item = box.mysteryboxItems[0];
  const name = item?.name ?? "";
  const parsed = parsePieceName(name);
  const imageUrl = item?.originalImage || item?.imageLink || "";
  const originalExt = extension(item?.originalImage ?? "");

  // The item `properties` array is authoritative for member/hidden (it mirrors the IPFS
  // `attributes`), which is essential for special editions whose display name doesn't follow
  // `MEMBER #NNN` (e.g. "2026 ARIN DAY", "KEKE (for KATELYN)"). Fall back to the parsed name.
  const props = item?.properties ?? [];
  const memberProp = props.find((p) => p.type === "Member")?.name;
  const hiddenProp = props.find((p) => p.type === "Hidden")?.name;
  const member = memberProp ?? parsed.member;
  const artistProp = props.find((p) => p.type === "Artist")?.name;
  const seriesProp = props.find((p) => p.type === "Series")?.name;
  const typeProp = props.find((p) => p.type === "Type")?.name;
  const serialProp = props.find((p) => p.type === "Serial")?.name;
  const serial = serialProp !== undefined ? Number.parseInt(serialProp, 10) : Number.NaN;

  // The per-design class is the item's `rarity` (varies 1/2/3), NOT box `rarityLevel`
  // (a uniform box-level value). Fall back to rarityLevel only if the item lacks `rarity`.
  const rarity = item?.rarity ?? box.rarityLevel ?? 0;

  return {
    contractAddress: box.boxContractAddress ? box.boxContractAddress.toLowerCase() : null,
    member: member ? normalizeMember(member) : null,
    designNumber: parsed.designNumber,
    rarity,
    classLetter: classLetter(rarity),
    edition: titleText(box.title) || fallbackEdition,
    imageUrl,
    thumbnailUrl: item?.itemImage || null,
    // best-effort: TopPort serves 3D pieces as an mp4 in originalImage
    animationUrl: originalExt === "mp4" ? (item?.originalImage ?? null) : null,
    // imageUrl is usually an extensionless IPFS gateway link; originalImage keeps the real
    // file extension, so prefer it and only fall back to imageUrl's own extension.
    mediaType: originalExt || extension(imageUrl),
    isHidden: hiddenProp === "True" || parsed.hidden,
    artist: artistProp ?? null,
    series: seriesProp ?? box.symbol ?? null,
    type: typeProp ?? null,
    serial: Number.isNaN(serial) ? null : serial,
    topportId: box.id ?? null,
    releaseDatetime: box.releaseDatetime ?? null,
    price: box.price ?? null,
  };
}

export function createTopportClient(baseURL: string) {
  return ofetch.create({ baseURL, retry: 2, timeout: 20_000 });
}

type OFetchClient = ReturnType<typeof createTopportClient>;

// The list may be wrapped as { data: { list: [...] } } or returned bare; handle both.
export async function listMysteryboxIds(
  client: OFetchClient,
  chainId = TITAN_CHAIN_ID,
): Promise<number[]> {
  const body = (await client("/api/service/mysterybox", {
    query: { isCollection: true, chainId, page: 1, limit: 300, sortBy: "createdAt:ASC" },
  })) as { data?: { list?: unknown[] }; list?: unknown[] };
  const list = body.data?.list ?? body.list ?? [];
  const ids: number[] = [];
  for (const raw of list) {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === "number") ids.push(id);
  }
  return ids;
}

export async function getMysterybox(client: OFetchClient, id: number): Promise<TopportBox> {
  const body = (await client(`/api/service/mysterybox/${id}`)) as { data?: unknown };
  return topportBoxSchema.parse(body.data ?? body);
}

// Fetch the whole catalog and index it by lowercase on-chain contract address.
export async function buildContractCatalog(
  client: OFetchClient,
  chainId = TITAN_CHAIN_ID,
): Promise<Map<string, TopportBox>> {
  const ids = await listMysteryboxIds(client, chainId);
  const map = new Map<string, TopportBox>();
  for (const id of ids) {
    try {
      const box = await getMysterybox(client, id);
      if (box.boxContractAddress) {
        map.set(box.boxContractAddress.toLowerCase(), box);
      }
    } catch (err) {
      // A fetch/parse failure here is DISTINCT from a genuinely-unlisted contract:
      // log it (with the box id) so a systemic TopPort schema/endpoint change is visible
      // instead of silently making many designs look "unlisted". Still skip this one box.
      console.warn(`[topport] failed to fetch/parse mysterybox ${id}:`, err);
    }
  }
  return map;
}
