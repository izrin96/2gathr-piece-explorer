import { ofetch } from "ofetch";
import { z } from "zod";

export { FetchError } from "ofetch";

// Client for api.iand-dev.com, the bearer-authed 2GATHR app backend. Endpoints confirmed via
// live mitmproxy inspection (docs/superpowers/research/2gathr-api-findings.md).
export function createIandClient(baseURL: string) {
  return ofetch.create({ baseURL, retry: 1, timeout: 15_000 });
}

type OFetchClient = ReturnType<typeof createIandClient>;

const refreshResponseSchema = z.object({ accessToken: z.string(), refreshToken: z.string() });

// POST /v2/auth/refresh — success is HTTP 201 (not 200), but ofetch treats any 2xx as success
// so that needs no special-casing. Reusing an already-rotated refreshToken still worked in
// live testing (no hard single-use invalidation observed), but callers should always persist
// and reuse the latest pair returned here.
export async function refreshIandToken(client: OFetchClient, refreshToken: string) {
  return refreshResponseSchema.parse(
    await client("/v2/auth/refresh", { method: "POST", body: { refreshToken } }),
  );
}

const pieceBookListSchema = z.object({
  items: z.array(z.object({ id: z.string(), title: z.string() }).passthrough()),
});

export interface IandPieceBook {
  id: string;
  title: string;
}

export async function listPieceBooks(
  client: OFetchClient,
  accessToken: string,
): Promise<IandPieceBook[]> {
  return pieceBookListSchema.parse(
    await client("/v1/piece-book", {
      query: { lang: "en" },
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ).items;
}

const pieceBookDetailSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    rewardType: z.string().nullish(),
    totalSlots: z.number(),
    startAt: z.string().nullish(),
    slots: z.array(
      z
        .object({ slotId: z.string(), contractAddress: z.string(), displayOrder: z.number() })
        .passthrough(),
    ),
    hiddenPieceSlots: z
      .array(z.object({ rewardSlotId: z.string(), collectionId: z.string() }).passthrough())
      .default([]),
  })
  .passthrough();

export type IandPieceBookDetail = z.infer<typeof pieceBookDetailSchema>;

export async function getPieceBookDetail(
  client: OFetchClient,
  accessToken: string,
  id: string,
): Promise<IandPieceBookDetail> {
  return pieceBookDetailSchema.parse(
    await client(`/v1/piece-book/${id}`, {
      query: { lang: "en" },
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

// Shared by the refresh job (after every refresh) and the seed script (initial pair) — both
// need to persist accessExpiresAt/refreshExpiresAt without duplicating JWT decoding.
export function decodeJwtExpiry(token: string): string {
  const payload = token.split(".")[1] ?? "";
  const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number };
  return new Date(exp * 1000).toISOString();
}
