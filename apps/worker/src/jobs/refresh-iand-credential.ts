import { createIandClient, decodeJwtExpiry, FetchError, refreshIandToken } from "@repo/2gathr";
import { db } from "@repo/db";
import { appCredential } from "@repo/db/schema";
import { eq } from "drizzle-orm";

import { env } from "../env.js";

const SERVICE = "2gathr";

// The only job that touches /v2/auth/refresh. Keeps the 2GATHR app session alive indefinitely
// (refreshToken is a sliding 6-day window, renewed on every successful call here) so the
// interactive Google-OAuth login (apps/worker/src/seed-credential.ts) never needs re-running
// unless this job goes dark for 6+ consecutive days.
export async function refreshIandCredential(): Promise<{ refreshed: boolean }> {
  const [row] = await db.select().from(appCredential).where(eq(appCredential.service, SERVICE));

  if (!row) {
    console.warn("[refresh-iand-credential] no credential seeded — run seed-credential.ts");
    return { refreshed: false };
  }

  const client = createIandClient(env.IAND_BASE_URL);
  let result: Awaited<ReturnType<typeof refreshIandToken>>;
  try {
    result = await refreshIandToken(client, row.refreshToken);
  } catch (err) {
    if (err instanceof FetchError && err.response?.status === 401) {
      console.warn(
        "[refresh-iand-credential] credential dead (refresh token expired) — re-seed via app login",
      );
      return { refreshed: false };
    }
    throw err;
  }

  const now = new Date().toISOString();
  const newRow = {
    service: SERVICE,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessExpiresAt: decodeJwtExpiry(result.accessToken),
    refreshExpiresAt: decodeJwtExpiry(result.refreshToken),
    updatedAt: now,
  };
  await db
    .insert(appCredential)
    .values(newRow)
    .onConflictDoUpdate({ target: appCredential.service, set: newRow });

  return { refreshed: true };
}
