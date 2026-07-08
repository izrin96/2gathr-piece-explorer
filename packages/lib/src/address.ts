export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isAddress(addr: string): boolean {
  return ADDRESS_RE.test(addr);
}

export function normalizeAddress(addr: string): string {
  if (!isAddress(addr)) {
    throw new Error(`Invalid EVM address: ${addr}`);
  }
  return addr.toLowerCase();
}
