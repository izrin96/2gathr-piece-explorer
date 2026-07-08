// All date formatting is pinned to UTC: SSR and client must produce identical
// strings or React hydration fails (the old mockup hit exactly this).
const utcDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const utcDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatUtcDate(iso: string): string {
  return utcDate.format(new Date(iso));
}

export function formatUtcDateTime(iso: string): string {
  return `${utcDateTime.format(new Date(iso))} UTC`;
}

// Local-timezone variants for client-side use only (see LocalDateTime): the
// viewer's zone isn't known during SSR, so these must never run on the server.
const localDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const localDateTime = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h12",
});

export function formatLocalDate(iso: string): string {
  return localDate.format(new Date(iso));
}

export function formatLocalDateTime(iso: string): string {
  return localDateTime.format(new Date(iso));
}

// Ruby is assumed to be an 18-decimal ERC-20 (no on-chain decimals() read exists
// anywhere in this repo yet — sanity-checked during verification). Pure BigInt
// math + a fixed locale keeps SSR/client identical, same as the date formatters.
const RUBY_DECIMALS = 18n;
const RUBY_SCALE = 10n ** RUBY_DECIMALS;

const rubyIntegerFormat = new Intl.NumberFormat("en-US");

export function formatRubyAmount(wei: string): string {
  const value = BigInt(wei);
  const whole = value / RUBY_SCALE;
  const fraction = ((value % RUBY_SCALE) * 100n) / RUBY_SCALE; // truncated to 2 dp

  const wholeStr = rubyIntegerFormat.format(whole);
  return fraction === 0n ? wholeStr : `${wholeStr}.${String(fraction).padStart(2, "0")}`;
}
