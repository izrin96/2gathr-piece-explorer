import { decodeJwtExpiry } from "@repo/2gathr";
import { db } from "@repo/db";
import { appCredential } from "@repo/db/schema";

// One-time bootstrap: seeds app_credential from a freshly captured access/refresh token pair
// (interactive Google-OAuth login in the 2GATHR app, e.g. via a mitmproxy capture of
// gathr://auth/callback?access_token=...&refresh_token=...). After this, refresh-iand-credential
// keeps the session alive indefinitely — this only needs re-running if that job goes dark for
// 6+ consecutive days. Reads straight from process.env (not env.ts's envSchema) so these
// one-off secrets don't become part of the long-running worker's required startup env.
const accessToken = process.env.IAND_SEED_ACCESS_TOKEN;
const refreshToken = process.env.IAND_SEED_REFRESH_TOKEN;

if (!accessToken || !refreshToken) {
  console.error(
    "usage: IAND_SEED_ACCESS_TOKEN=... IAND_SEED_REFRESH_TOKEN=... tsx src/seed-credential.ts",
  );
  process.exit(1);
}

const now = new Date().toISOString();
const row = {
  service: "2gathr",
  accessToken,
  refreshToken,
  accessExpiresAt: decodeJwtExpiry(accessToken),
  refreshExpiresAt: decodeJwtExpiry(refreshToken),
  updatedAt: now,
};

await db
  .insert(appCredential)
  .values(row)
  .onConflictDoUpdate({ target: appCredential.service, set: row });

console.log(
  `[seed-credential] stored — access expires ${row.accessExpiresAt}, refresh expires ${row.refreshExpiresAt}`,
);
process.exit(0);
