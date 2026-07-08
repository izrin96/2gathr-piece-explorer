import { ZERO_ADDRESS } from "@repo/lib";

export function computeRubyBalances(
  transfers: { from: string; to: string; value: bigint }[],
): Map<string, bigint> {
  const balances = new Map<string, bigint>();
  const add = (addr: string, delta: bigint) => {
    if (addr === ZERO_ADDRESS) return;
    balances.set(addr, (balances.get(addr) ?? 0n) + delta);
  };
  for (const t of transfers) {
    add(t.from, -t.value);
    add(t.to, t.value);
  }
  for (const [addr, bal] of balances) {
    if (bal === 0n) balances.delete(addr);
  }
  return balances;
}

export function computeClassDistribution(
  designs: { rarity: number | null }[],
): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const d of designs) {
    const key = d.rarity === null ? "unknown" : String(d.rarity);
    dist[key] = (dist[key] ?? 0) + 1;
  }
  return dist;
}
